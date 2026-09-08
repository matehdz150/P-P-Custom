/**
 * El E2E contra AWS de verdad.
 *
 * Invoca la Lambda de la API igual que lo haría API Gateway —con el mismo
 * evento, incluidos los claims del JWT— y después espera a que el trabajo pase
 * por SQS, el contenedor de Ink/Stitch y S3. No hay ningún doble: la cola es la
 * cola, el bucket es el bucket y el motor es el motor.
 */

import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const ejecutar = promisify(execFile);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const disenos = path.join(aqui, "disenos");

const PERFIL = "kustto-admin";
const REGION = "us-east-1";
/* La prueba post-deploy va contra la API PRODUCTIVA, no contra el arnes: lo que
   hay que comprobar despues de encender es lo que va a usar el comprador. */
const FUNCION = process.env.E2E_FUNCION ?? "kustto-embroidery-api-e2e";
const PRODUCTO = process.env.E2E_PRODUCTO ?? "e2e-bordado-0001";
/** El `sub` de Cognito que hace de dueño. Fijo para poder repetir el E2E. */
const DUENO = "e2e-comprador-0001";

async function aws(args) {
	const { stdout } = await ejecutar(
		"aws",
		[...args, "--profile", PERFIL, "--region", REGION],
		{ maxBuffer: 64 * 1024 * 1024 },
	);
	return stdout;
}

/** Un evento de API Gateway HTTP v2 como el que llega de verdad. */
function evento(metodo, ruta, cuerpo) {
	return {
		requestContext: {
			http: { method: metodo, path: ruta },
			authorizer: { jwt: { claims: { sub: DUENO } } },
		},
		body: cuerpo === undefined ? null : JSON.stringify(cuerpo),
		isBase64Encoded: false,
	};
}

async function invocar(payload) {
	const archivo = `/tmp/e2e-payload-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
	const salida = `${archivo}.out`;
	await writeFile(archivo, JSON.stringify(payload));
	await aws([
		"lambda",
		"invoke",
		"--function-name",
		FUNCION,
		"--cli-binary-format",
		"raw-in-base64-out",
		"--payload",
		`file://${archivo}`,
		salida,
	]);
	const crudo = JSON.parse(await readFile(salida, "utf8"));
	return {
		statusCode: crudo.statusCode,
		body: crudo.body ? JSON.parse(crudo.body) : null,
	};
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarFinal(jobId, maximoMs = 400_000) {
	const desde = Date.now();
	let ultimo = null;
	while (Date.now() - desde < maximoMs) {
		const r = await invocar(evento("GET", `/bordados/jobs/${jobId}`));
		ultimo = r.body;
		if (
			ultimo &&
			!["QUEUED", "PROCESSING"].includes(ultimo.status)
		)
			return { job: ultimo, esperaMs: Date.now() - desde };
		await dormir(3000);
	}
	return { job: ultimo, esperaMs: Date.now() - desde, agotado: true };
}

/** La fila cruda de DynamoDB: tiene los campos que la respuesta pública no. */
async function filaDelJob(jobId) {
	const salida = await aws([
		"dynamodb",
		"get-item",
		"--table-name",
		"kustto-embroidery-jobs",
		"--key",
		JSON.stringify({ pk: { S: `JOB#${jobId}` } }),
	]);
	const item = JSON.parse(salida || "{}").Item;
	if (!item) return null;
	const plano = {};
	for (const [k, v] of Object.entries(item)) {
		plano[k] = v.S ?? (v.N ? Number(v.N) : (v.BOOL ?? v));
	}
	return plano;
}

async function main() {
	const indice = JSON.parse(
		await readFile(path.join(disenos, "indice.json"), "utf8"),
	);
	const archivos = (await readdir(disenos)).filter(
		(f) => f.endsWith(".json") && f !== "indice.json",
	);
	archivos.sort();

	const resultados = [];

	for (const entrada of indice.casos) {
		if (!entrada.preparado) {
			// Los que el navegador rechaza NO se mandan: comprobar que no llegan al
			// motor es justamente el resultado esperado de esos casos.
			resultados.push({
				caso: entrada.caso,
				espera: entrada.espera,
				enviado: false,
				motivoLocal: entrada.motivo,
				msLocal: entrada.msLocal,
			});
			console.log(`${entrada.caso}: NO ENVIADO (${entrada.motivo})`);
			continue;
		}
		if (!archivos.includes(`${entrada.caso}.json`)) continue;

		const design = JSON.parse(
			await readFile(path.join(disenos, `${entrada.caso}.json`), "utf8"),
		);
		design.productId = PRODUCTO;

		const t0 = Date.now();
		const post = await invocar(
			evento("POST", "/bordados/jobs", { design, retry: false }),
		);
		if (post.statusCode !== 202) {
			resultados.push({
				caso: entrada.caso,
				espera: entrada.espera,
				enviado: true,
				postStatus: post.statusCode,
				error: post.body,
			});
			console.log(
				`${entrada.caso}: POST ${post.statusCode} ${JSON.stringify(post.body)}`,
			);
			continue;
		}

		const { jobId, designHash } = post.body;
		const { job, esperaMs, agotado } = await esperarFinal(jobId);
		const fila = await filaDelJob(jobId);

		resultados.push({
			caso: entrada.caso,
			espera: entrada.espera,
			enviado: true,
			postStatus: 202,
			jobId,
			designHash,
			status: job?.status,
			decision: job?.decision,
			confidence: job?.confidence,
			issues: (job?.issues ?? []).map((i) => i.code),
			metrics: job?.metrics ?? null,
			previewUrl: job?.previewUrl ? "(firmada)" : null,
			esperaMs,
			agotado: agotado ?? false,
			msLocal: entrada.msLocal,
			fila,
		});
		console.log(
			`${entrada.caso}: ${job?.status} decision=${job?.decision ?? "-"} conf=${job?.confidence ?? "-"} espera=${(esperaMs / 1000).toFixed(1)}s stitches=${job?.metrics?.stitchCount ?? "-"}`,
		);
	}

	await writeFile(
		path.join(aqui, "resultados-e2e.json"),
		`${JSON.stringify({ producto: PRODUCTO, dueno: DUENO, resultados }, null, 2)}\n`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
