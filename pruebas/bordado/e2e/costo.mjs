/**
 * Costo real por trabajo, a partir de las ejecuciones del E2E.
 *
 * Sale de las líneas REPORT de CloudWatch —duración facturada y memoria máxima
 * usada de verdad—, no de una estimación. La proyección NO cuenta capa gratuita
 * en la cifra principal: un servicio que sólo es rentable dentro del Free Tier
 * deja de serlo justo cuando empieza a funcionar.
 */

import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const ejecutar = promisify(execFile);
const aqui = path.dirname(fileURLToPath(import.meta.url));

const PERFIL = "kustto-admin";
const REGION = "us-east-1";

/* Precios de us-east-1, bajo demanda, a la fecha de la prueba. Arm64 es más
   barato que x86 y por eso el worker es arm64. */
const PRECIOS = {
	gbSegundoArm: 0.0000133334,
	peticionArm: 0.0000002,
	gbSegundoX86: 0.0000166667,
	// El resto por trabajo: 1 escritura y ~20 lecturas de DynamoDB (el sondeo
	// del frontend), 1 mensaje de SQS, 3 objetos en S3 y su almacenamiento.
	dynamoEscritura: 0.00000125,
	dynamoLectura: 0.00000025,
	sqsPeticion: 0.0000004,
	s3Put: 0.000005,
	s3GbMes: 0.023,
};

async function aws(args) {
	const { stdout } = await ejecutar(
		"aws",
		[...args, "--profile", PERFIL, "--region", REGION],
		{ maxBuffer: 64 * 1024 * 1024, env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
	);
	return stdout;
}

function pct(valores, p) {
	if (!valores.length) return 0;
	const v = [...valores].sort((a, b) => a - b);
	return v[Math.min(v.length - 1, Math.max(0, Math.round((v.length - 1) * p)))];
}

async function informesDe(grupo) {
	const flujos = JSON.parse(
		await aws([
			"logs",
			"describe-log-streams",
			"--log-group-name",
			grupo,
			"--order-by",
			"LastEventTime",
			"--descending",
			"--max-items",
			"12",
			"--output",
			"json",
		]),
	).logStreams;

	const informes = [];
	for (const flujo of flujos) {
		const eventos = JSON.parse(
			await aws([
				"logs",
				"get-log-events",
				"--log-group-name",
				grupo,
				"--log-stream-name",
				flujo.logStreamName,
				"--limit",
				"200",
				"--output",
				"json",
			]),
		).events;
		for (const evento of eventos) {
			const m = evento.message.match(
				/Billed Duration: (\d+) ms\s+Memory Size: (\d+) MB\s+Max Memory Used: (\d+) MB(?:\s+Init Duration: ([\d.]+) ms)?/,
			);
			if (!m) continue;
			informes.push({
				facturadoMs: Number(m[1]),
				memoriaMb: Number(m[2]),
				usadaMb: Number(m[3]),
				initMs: m[4] ? Number(m[4]) : null,
				cuando: evento.timestamp,
			});
		}
	}
	return informes;
}

function resumen(informes) {
	const ms = informes.map((r) => r.facturadoMs);
	const usada = informes.map((r) => r.usadaMb);
	const fríos = informes.filter((r) => r.initMs !== null);
	return {
		ejecuciones: informes.length,
		msMedia: Math.round(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length)),
		msP50: pct(ms, 0.5),
		msP95: pct(ms, 0.95),
		msMax: Math.max(0, ...ms),
		memoriaMb: informes[0]?.memoriaMb ?? 0,
		usadaMaxMb: Math.max(0, ...usada),
		arranquesEnFrio: fríos.length,
		initMsMedia: fríos.length
			? Math.round(
					fríos.reduce((a, b) => a + (b.initMs ?? 0), 0) / fríos.length,
				)
			: null,
	};
}

async function main() {
	const crudos = await informesDe("/aws/lambda/kustto-embroidery-worker");
	/* Los que agotaron el motor se sacan del calculo por trabajo y se cuentan
	   aparte. Mezclarlos hace que el p95 sea el timeout —75 s— y eso no es lo
	   que cuesta un trabajo, es lo que cuesta un fallo. Los dos numeros
	   importan, pero no son el mismo numero. */
	const agotados = crudos.filter((r) => r.facturadoMs >= 74_000);
	const worker = resumen(crudos.filter((r) => r.facturadoMs < 74_000));
	worker.agotaronElMotor = agotados.length;
	worker.costoDeUnAgotado = Number(
		(
			(2048 / 1024) * 75 * PRECIOS.gbSegundoArm +
			PRECIOS.peticionArm
		).toFixed(6),
	);
	// La API del E2E: mismo codigo que la productiva.
	const api = resumen(await informesDe("/aws/lambda/kustto-embroidery-api-e2e"));

	/* Sólo los trabajos que llegan al motor cuestan de verdad. Los que se
	   rechazan en el navegador no crean trabajo ni tocan AWS: no aparecen aquí
	   porque no existen, y esa es justamente la razón de rechazarlos allí. */
	const gbWorker = (worker.memoriaMb / 1024) * (worker.msP50 / 1000);
	const gbWorkerP95 = (worker.memoriaMb / 1024) * (worker.msP95 / 1000);
	const gbApi = ((api.memoriaMb || 512) / 1024) * ((api.msP50 || 200) / 1000);

	// Un trabajo son varias llamadas a la API: 1 POST y unos 20 GET de sondeo.
	const llamadasApi = 21;
	const costoWorker =
		gbWorker * PRECIOS.gbSegundoArm + PRECIOS.peticionArm;
	const costoWorkerP95 =
		gbWorkerP95 * PRECIOS.gbSegundoArm + PRECIOS.peticionArm;
	const costoApi =
		llamadasApi * (gbApi * PRECIOS.gbSegundoX86 + PRECIOS.peticionArm);
	const costoDatos =
		2 * PRECIOS.dynamoEscritura +
		llamadasApi * PRECIOS.dynamoLectura +
		PRECIOS.sqsPeticion * 2 +
		4 * PRECIOS.s3Put;

	const porTrabajo = costoWorker + costoApi + costoDatos;
	const porTrabajoP95 = costoWorkerP95 + costoApi + costoDatos;

	const salida = {
		worker,
		api,
		desglosePorTrabajo: {
			workerLambda: Number(costoWorker.toFixed(6)),
			apiLambda: Number(costoApi.toFixed(6)),
			dynamoSqsS3: Number(costoDatos.toFixed(6)),
			total: Number(porTrabajo.toFixed(6)),
			totalConWorkerEnP95: Number(porTrabajoP95.toFixed(6)),
		},
		proyeccionSinCapaGratuita: Object.fromEntries(
			[100, 1000, 10_000, 100_000].map((n) => [
				`${n} trabajos/mes`,
				{
					usd: Number((porTrabajo * n).toFixed(2)),
					usdEnP95: Number((porTrabajoP95 * n).toFixed(2)),
				},
			]),
		),
		nota: "Sin capa gratuita. No incluye CloudWatch Logs ni transferencia de salida.",
	};

	await writeFile(
		path.join(aqui, "costo.json"),
		`${JSON.stringify(salida, null, 2)}\n`,
	);
	console.log(JSON.stringify(salida, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
