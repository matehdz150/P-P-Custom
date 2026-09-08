/**
 * Idempotencia y fallo controlado, contra AWS real.
 *
 * LO QUE SE PRUEBA Y POR QUÉ IMPORTA. Cada preparación arranca un contenedor y
 * hasta setenta y cinco segundos de motor; si pedir dos veces lo mismo lo
 * ejecutara dos veces, cada recarga de página del comprador costaría dinero. Y
 * al revés: si un diseño cambiado reutilizara el resultado viejo, se bordaría
 * lo que el comprador borró.
 *
 * El fallo se provoca corrompiendo el objeto de entrada en S3 DESPUÉS de crear
 * el trabajo. No se rompe nada de la infraestructura: se cambia un fichero de
 * un trabajo de prueba, que es lo mismo que pasaría si S3 devolviera basura.
 */

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const ejecutar = promisify(execFile);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const disenos = path.join(aqui, "disenos");

const PERFIL = "kustto-admin";
const REGION = "us-east-1";
const FUNCION = "kustto-embroidery-api-e2e";
const TABLA = "kustto-embroidery-jobs";
const BUCKET = "kustto-embroidery-218897024535-us-east-1";
const PRODUCTO = "e2e-bordado-0001";
const DUENO = "e2e-comprador-0001";

async function aws(args) {
	const { stdout } = await ejecutar(
		"aws",
		[...args, "--profile", PERFIL, "--region", REGION],
		{ maxBuffer: 64 * 1024 * 1024, env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
	);
	return stdout;
}

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
	const archivo = `/tmp/idem-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
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
		`${archivo}.out`,
	]);
	const crudo = JSON.parse(await readFile(`${archivo}.out`, "utf8"));
	return {
		statusCode: crudo.statusCode,
		body: crudo.body ? JSON.parse(crudo.body) : null,
	};
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function fila(jobId) {
	const salida = await aws([
		"dynamodb",
		"get-item",
		"--table-name",
		TABLA,
		"--key",
		JSON.stringify({ pk: { S: `JOB#${jobId}` } }),
	]);
	const item = JSON.parse(salida || "{}").Item;
	if (!item) return null;
	const plano = {};
	for (const [k, v] of Object.entries(item))
		plano[k] = v.S ?? (v.N ? Number(v.N) : v.BOOL);
	return plano;
}

async function esperar(jobId, maximoMs = 180_000) {
	const desde = Date.now();
	while (Date.now() - desde < maximoMs) {
		const f = await fila(jobId);
		if (f && !["QUEUED", "PROCESSING"].includes(f.status)) return f;
		await dormir(3000);
	}
	return await fila(jobId);
}

async function disenoDe(nombre) {
	const design = JSON.parse(
		await readFile(path.join(disenos, `${nombre}.json`), "utf8"),
	);
	design.productId = PRODUCTO;
	return design;
}

async function main() {
	const salida = {};

	// ---------------------------------------------------------- 1) repetir
	const design = await disenoDe("01-texto-simple");
	const primero = await invocar(evento("POST", "/bordados/jobs", { design }));
	const filaPrimero = await esperar(primero.body.jobId);

	const repetido = await invocar(evento("POST", "/bordados/jobs", { design }));
	const filaRepetido = await fila(repetido.body.jobId);

	salida.repetir = {
		mismoJobId: primero.body.jobId === repetido.body.jobId,
		mismoDesignHash: primero.body.designHash === repetido.body.designHash,
		// `attempts` es la prueba de que el motor NO volvió a correr.
		attemptsAntes: filaPrimero?.attempts,
		attemptsDespues: filaRepetido?.attempts,
		motorReejecutado: (filaRepetido?.attempts ?? 0) > (filaPrimero?.attempts ?? 0),
		estado: filaRepetido?.status,
		completedAtIgual: filaPrimero?.completedAt === filaRepetido?.completedAt,
		jobId: primero.body.jobId,
	};
	console.log("repetir:", JSON.stringify(salida.repetir));

	// ------------------------------------------------- 2) cambio relevante
	const otro = await disenoDe("08-texto-variante");
	const cambiado = await invocar(evento("POST", "/bordados/jobs", { design: otro }));
	salida.cambioRelevante = {
		hashDistinto: cambiado.body.designHash !== primero.body.designHash,
		jobIdDistinto: cambiado.body.jobId !== primero.body.jobId,
		hashA: primero.body.designHash.slice(0, 16),
		hashB: cambiado.body.designHash.slice(0, 16),
	};
	console.log("cambio relevante:", JSON.stringify(salida.cambioRelevante));

	// ------------------------------------------------------ 3) traslación
	/* Mover el diseño dentro del área SÍ cambia el hash: el bordado se cose en
	   un sitio concreto del bastidor, así que dos posiciones son dos bordados. */
	const movido = await disenoDe("01-texto-simple");
	for (const objeto of movido.objects) {
		objeto.geometry.d = objeto.geometry.d.replace(
			/M([\d.]+) ([\d.]+)/g,
			(_, x, y) => `M${(Number(x) + 2).toFixed(3)} ${Number(y).toFixed(3)}`,
		);
		objeto.bounds.xMm = Number((objeto.bounds.xMm + 2).toFixed(3));
	}
	const trasladado = await invocar(
		evento("POST", "/bordados/jobs", { design: movido }),
	);
	salida.traslacion = {
		hashDistinto: trasladado.body?.designHash !== primero.body.designHash,
		statusCode: trasladado.statusCode,
		hash: trasladado.body?.designHash?.slice(0, 16),
	};
	console.log("traslacion:", JSON.stringify(salida.traslacion));

	// -------------------------------------------- 4) fallo y reintento
	const paraRomper = await disenoDe("05-ilustracion");
	// Un cambio minúsculo para que sea otro trabajo y no reutilice el anterior.
	paraRomper.sourceSnapshotHash = `${"b".repeat(63)}1`;
	const roto = await invocar(evento("POST", "/bordados/jobs", { design: paraRomper }));
	const jobRoto = roto.body.jobId;
	const filaRota = await fila(jobRoto);

	// Se corrompe la entrada en S3: el worker verá que el sha256 no cuadra.
	await writeFile("/tmp/corrupto.json", '{"esto":"no es el diseño"}');
	await aws([
		"s3api",
		"put-object",
		"--bucket",
		BUCKET,
		"--key",
		filaRota.inputKey,
		"--body",
		"/tmp/corrupto.json",
		"--content-type",
		"application/json",
	]);

	const tras = await esperar(jobRoto, 240_000);
	salida.fallo = {
		jobId: jobRoto,
		estado: tras?.status,
		errorCode: tras?.errorCode,
		attempts: tras?.attempts,
		sinArtefactos: !tras?.dstKey && !tras?.previewKey,
	};
	console.log("fallo:", JSON.stringify(salida.fallo));

	// El reintento explícito: sólo se admite desde FAILED.
	if (tras?.status === "FAILED") {
		// Se repone la entrada buena para que el reintento pueda salir bien.
		await aws([
			"s3api",
			"put-object",
			"--bucket",
			BUCKET,
			"--key",
			filaRota.inputKey,
			"--body",
			path.join(disenos, "05-ilustracion.json"),
			"--content-type",
			"application/json",
		]);
		const reintento = await invocar(
			evento("POST", "/bordados/jobs", { design: paraRomper, retry: true }),
		);
		const filaReintento = await esperar(jobRoto, 240_000);
		salida.reintento = {
			statusCode: reintento.statusCode,
			estado: filaReintento?.status,
			attempts: filaReintento?.attempts,
			attemptsSubio: (filaReintento?.attempts ?? 0) > (tras?.attempts ?? 0),
			errorCode: filaReintento?.errorCode ?? null,
		};
		console.log("reintento:", JSON.stringify(salida.reintento));
	}

	// -------------------------------------------------------- 5) las colas
	const cola = JSON.parse(
		await aws([
			"sqs",
			"get-queue-attributes",
			"--queue-url",
			(
				await aws([
					"sqs",
					"get-queue-url",
					"--queue-name",
					"kustto-embroidery-jobs",
					"--query",
					"QueueUrl",
					"--output",
					"text",
				])
			).trim(),
			"--attribute-names",
			"ApproximateNumberOfMessages",
			"ApproximateNumberOfMessagesNotVisible",
			"--output",
			"json",
		]),
	).Attributes;
	const dlq = JSON.parse(
		await aws([
			"sqs",
			"get-queue-attributes",
			"--queue-url",
			(
				await aws([
					"sqs",
					"get-queue-url",
					"--queue-name",
					"kustto-embroidery-jobs-dlq",
					"--query",
					"QueueUrl",
					"--output",
					"text",
				])
			).trim(),
			"--attribute-names",
			"ApproximateNumberOfMessages",
			"--output",
			"json",
		]),
	).Attributes;
	salida.colas = { principal: cola, dlq };
	console.log("colas:", JSON.stringify(salida.colas));

	await writeFile(
		path.join(aqui, "idempotencia.json"),
		`${JSON.stringify(salida, null, 2)}\n`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
