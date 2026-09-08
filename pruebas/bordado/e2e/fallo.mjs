/**
 * Fallo controlado, reintento y DLQ.
 *
 * POR QUÉ SE INYECTA EN VEZ DE CORROMPER DESPUÉS. El primer intento fue crear
 * el trabajo por la API y estropear su entrada en S3 acto seguido; no sirve,
 * porque el worker la lee en menos de un segundo y gana la carrera. Aquí se
 * escribe la fila, se sube una entrada que NO cuadra con su hash y se manda el
 * mensaje: es exactamente lo que hace la API, con la única diferencia de que el
 * contenido está roto a propósito. Nada de la infraestructura se toca.
 */

import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const ejecutar = promisify(execFile);
const aqui = path.dirname(fileURLToPath(import.meta.url));

const PERFIL = "kustto-admin";
const REGION = "us-east-1";
const TABLA = "kustto-embroidery-jobs";
const BUCKET = "kustto-embroidery-218897024535-us-east-1";
const DUENO = "e2e-comprador-0001";

async function aws(args) {
	const { stdout } = await ejecutar(
		"aws",
		[...args, "--profile", PERFIL, "--region", REGION],
		{ maxBuffer: 64 * 1024 * 1024, env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
	);
	return stdout;
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

async function esperarEstado(jobId, estados, maximoMs) {
	const desde = Date.now();
	let ultima = null;
	while (Date.now() - desde < maximoMs) {
		ultima = await fila(jobId);
		if (ultima && estados.includes(ultima.status)) return ultima;
		await dormir(4000);
	}
	return ultima;
}

async function colas() {
	const url = async (nombre) =>
		(
			await aws(["sqs", "get-queue-url", "--queue-name", nombre, "--query", "QueueUrl", "--output", "text"])
		).trim();
	const atributos = async (u, nombres) =>
		JSON.parse(
			await aws(["sqs", "get-queue-attributes", "--queue-url", u, "--attribute-names", ...nombres, "--output", "json"]),
		).Attributes;
	return {
		principal: await atributos(await url("kustto-embroidery-jobs"), [
			"ApproximateNumberOfMessages",
			"ApproximateNumberOfMessagesNotVisible",
		]),
		dlq: await atributos(await url("kustto-embroidery-jobs-dlq"), [
			"ApproximateNumberOfMessages",
		]),
	};
}

async function main() {
	const salida = { antes: await colas() };

	/* El worker exige `emb_` + 40 caracteres hexadecimales y rechaza cualquier
	   otra cosa con INVALID_MESSAGE antes de tocar nada. La primera version de
	   esta prueba metia "e2efallo" en el id y nunca llegaba a probar el fallo
	   que pretendia: probaba la validacion del mensaje. */
	const jobId = `emb_${createHash("sha256").update(randomUUID()).digest("hex").slice(0, 40)}`;
	// La entrada esta rota A PROPOSITO: su sha256 no sera el designHash que se
	// declara, que es la comprobacion que el worker hace antes de nada.
	const contenido = Buffer.from('{"schemaVersion":1,"roto":true}');
	const hashReal = createHash("sha256").update(contenido).digest("hex");
	const hashDeclarado = createHash("sha256")
		.update(`${hashReal}-declarado-distinto`)
		.digest("hex");
	const inputKey = `inputs/${hashDeclarado}/${jobId}/design.json`;

	await writeFile("/tmp/entrada-rota.json", contenido);
	await aws([
		"s3api",
		"put-object",
		"--bucket",
		BUCKET,
		"--key",
		inputKey,
		"--body",
		"/tmp/entrada-rota.json",
		"--content-type",
		"application/json",
	]);

	const ahora = new Date().toISOString().replace(/\.\d+Z$/, "Z");
	await aws([
		"dynamodb",
		"put-item",
		"--table-name",
		TABLA,
		"--item",
		JSON.stringify({
			pk: { S: `JOB#${jobId}` },
			jobId: { S: jobId },
			ownerId: { S: DUENO },
			designHash: { S: hashDeclarado },
			status: { S: "QUEUED" },
			attempts: { N: "0" },
			inputKey: { S: inputKey },
			createdAt: { S: ahora },
			expiresAt: { N: String(Math.floor(Date.now() / 1000) + 86400) },
		}),
	]);

	const colaUrl = (
		await aws(["sqs", "get-queue-url", "--queue-name", "kustto-embroidery-jobs", "--query", "QueueUrl", "--output", "text"])
	).trim();
	await aws([
		"sqs",
		"send-message",
		"--queue-url",
		colaUrl,
		"--message-body",
		JSON.stringify({ jobId, designHash: hashDeclarado }),
	]);

	const tras = await esperarEstado(jobId, ["FAILED", "READY", "REVIEW", "REJECTED"], 240_000);
	salida.fallo = {
		jobId,
		estado: tras?.status,
		errorCode: tras?.errorCode,
		attempts: tras?.attempts,
		// Un FAILED no puede dejar artefactos a medias.
		sinArtefactos: !tras?.dstKey && !tras?.previewKey && !tras?.metadataKey,
		startedAt: tras?.startedAt,
		completedAt: tras?.completedAt,
	};
	console.log("fallo:", JSON.stringify(salida.fallo));

	/* El mensaje vuelve a la cola tras el fallo y se reintenta hasta tres veces;
	   a la cuarta entrega va a la DLQ. El worker NO reprocesa: la adquisicion es
	   condicional a que el estado siga en QUEUED, y ya esta en FAILED. Aqui se
	   comprueba justamente eso: que reintentar el MENSAJE no duplica trabajo. */
	console.log("esperando a que se agoten las entregas...");
	await dormir(150_000);
	salida.despues = await colas();
	const filaFinal = await fila(jobId);
	salida.trasReintentos = {
		estado: filaFinal?.status,
		attempts: filaFinal?.attempts,
		attemptsNoSubio: filaFinal?.attempts === tras?.attempts,
		sinArtefactos: !filaFinal?.dstKey,
	};
	console.log("tras reintentos:", JSON.stringify(salida.trasReintentos));
	console.log("colas:", JSON.stringify(salida.despues));

	await writeFile(
		path.join(aqui, "fallo.json"),
		`${JSON.stringify(salida, null, 2)}\n`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
