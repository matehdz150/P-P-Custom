/**
 * Comprueba los artefactos bajando de S3 lo que el worker dejó allí.
 *
 * QUE EL WORKER HAYA DICHO READY NO ES PRUEBA DE NADA. Lo que el taller va a
 * meter en la máquina es el DST, así que el DST se descarga, se reabre con
 * pyembroidery —una lectura independiente de la que hizo el worker— y se
 * comprueba byte a byte que es Tajima. Después se contrasta lo que dice el
 * fichero con lo que dice el metadata: si no coinciden, uno de los dos miente.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const ejecutar = promisify(execFile);
const aqui = path.dirname(fileURLToPath(import.meta.url));
const bajados = path.join(aqui, "artefactos");

const PERFIL = "kustto-admin";
const REGION = "us-east-1";
const BUCKET = "kustto-embroidery-218897024535-us-east-1";

async function aws(args) {
	const { stdout } = await ejecutar(
		"aws",
		[...args, "--profile", PERFIL, "--region", REGION],
		{ maxBuffer: 64 * 1024 * 1024 },
	);
	return stdout;
}

/**
 * Lee el DST con pyembroidery, no con el código del worker.
 *
 * El decodificador Tajima propio del worker ya validó una vez; volver a usarlo
 * aquí sólo comprobaría que es consistente consigo mismo.
 */
async function leerDst(archivo) {
	const script = `
import json, sys
import pyembroidery as pe
patron = pe.read(sys.argv[1])
puntadas = patron.stitches
saltos = sum(1 for p in puntadas if p[2] == pe.JUMP)
cortes = sum(1 for p in puntadas if p[2] == pe.TRIM)
cambios = sum(1 for p in puntadas if p[2] == pe.COLOR_CHANGE)
reales = [p for p in puntadas if p[2] in (pe.STITCH, pe.SEQUIN_MODE)]
xs = [p[0] for p in reales] or [0]
ys = [p[1] for p in reales] or [0]
print(json.dumps({
    "puntadas": len(reales),
    "totalOrdenes": len(puntadas),
    "saltos": saltos,
    "cortes": cortes,
    "cambiosDeColor": cambios,
    "hilos": len(patron.threadlist),
    # pyembroidery trabaja en decimas de milimetro.
    "anchoMm": round((max(xs) - min(xs)) / 10.0, 2),
    "altoMm": round((max(ys) - min(ys)) / 10.0, 2),
}))
`;
	const { stdout } = await ejecutar("python3", ["-c", script, archivo], {
		maxBuffer: 32 * 1024 * 1024,
	});
	return JSON.parse(stdout);
}

/** La cabecera de un DST de Tajima: 512 bytes ASCII que empiezan por "LA:". */
function esTajima(buffer) {
	if (buffer.length < 512) return { ok: false, motivo: "menos de 512 bytes" };
	const cabecera = buffer.subarray(0, 512).toString("latin1");
	if (!cabecera.startsWith("LA:"))
		return { ok: false, motivo: "no empieza por LA:" };
	// El cuerpo son ternas de 3 bytes y termina en 0xF3.
	const cuerpo = buffer.subarray(512);
	if ((cuerpo.length - 1) % 3 !== 0 && cuerpo.length % 3 !== 0)
		return { ok: false, motivo: "el cuerpo no son ternas de 3 bytes" };
	const fin = buffer.indexOf(0xf3, 512);
	return {
		ok: fin >= 0,
		motivo: fin >= 0 ? "" : "falta el 0xF3 final",
		cabecera: cabecera.slice(0, 120).replace(/[\s\S]*$/, "").trim(),
	};
}

async function main() {
	await mkdir(bajados, { recursive: true });
	const e2e = JSON.parse(
		await readFile(path.join(aqui, "resultados-e2e.json"), "utf8"),
	);
	const informe = [];

	for (const caso of e2e.resultados) {
		if (!caso.jobId || !["READY", "REVIEW"].includes(caso.status ?? "")) continue;

		/* Las claves se leen de la FILA del job, no se construyen aqui. El prefijo
		   real lleva el designHash delante del jobId, y adivinarlo hacia que el
		   validador no encontrara nada y diera todo por bueno en silencio: un
		   comprobador que no comprueba es peor que no tenerlo. */
		const claves = [
			caso.fila?.dstKey,
			caso.fila?.previewKey,
			caso.fila?.metadataKey,
		].filter(Boolean);
		const destino = path.join(bajados, caso.caso);
		await mkdir(destino, { recursive: true });

		const archivos = {};
		for (const clave of claves) {
			const nombre = path.basename(clave);
			const local = path.join(destino, nombre);
			await aws(["s3api", "get-object", "--bucket", BUCKET, "--key", clave, local]);
			const cabeza = JSON.parse(
				await aws(["s3api", "head-object", "--bucket", BUCKET, "--key", clave, "--output", "json"]),
			);
			const contenido = await readFile(local);
			archivos[nombre] = {
				key: clave,
				bytes: contenido.length,
				bytesS3: cabeza.ContentLength,
				sha256: createHash("sha256").update(contenido).digest("hex"),
				// El worker guarda el sha256 en el metadata del objeto: si no
				// coincide con el del fichero bajado, algo se corrompio en medio.
				sha256Declarado: cabeza.Metadata?.sha256 ?? null,
				contentType: cabeza.ContentType,
			};
			archivos[nombre].integro =
				archivos[nombre].sha256Declarado === null ||
				archivos[nombre].sha256Declarado === archivos[nombre].sha256;
		}
		if (!claves.length) throw new Error(`sin claves para ${caso.caso}`);

		const fila = { caso: caso.caso, jobId: caso.jobId, status: caso.status, archivos };

		if (archivos["design.dst"]) {
			const buffer = await readFile(path.join(destino, "design.dst"));
			fila.tajima = esTajima(buffer);
			try {
				fila.dst = await leerDst(path.join(destino, "design.dst"));
			} catch (error) {
				fila.dst = { error: String(error.message).slice(0, 200) };
			}
		}
		if (archivos["metadata.json"]) {
			fila.metadata = JSON.parse(
				await readFile(path.join(destino, "metadata.json"), "utf8"),
			);
		}

		// El contraste: lo que dice el fichero contra lo que dice el metadata.
		if (fila.dst && fila.metadata) {
			const m = fila.metadata.metrics ?? fila.metadata;
			fila.coincide = {
				stitchCount: m.stitchCount === fila.dst.puntadas,
				/* Se compara contra los CAMBIOS DE COLOR mas uno, no contra la
				   lista de hilos: el DST de Tajima no guarda tabla de colores
				   —por eso la maquina necesita la secuencia aparte— y
				   `threadlist` sale siempre vacia. Compararlo contra cero daba
				   un falso fallo en todos los casos. */
				colorCount: (m.colorCount ?? null) === fila.dst.cambiosDeColor + 1,
				jumps: (m.jumps ?? null) === fila.dst.saltos,
				trims: (m.trims ?? null) === fila.dst.cortes,
				declarado: {
					stitchCount: m.stitchCount,
					colorCount: m.colorCount,
					jumps: m.jumps,
					trims: m.trims,
					widthMm: m.widthMm,
					heightMm: m.heightMm,
				},
				leido: fila.dst,
			};
		}

		informe.push(fila);
		console.log(
			`${caso.caso}: ${Object.keys(archivos).join(", ")} | tajima=${fila.tajima?.ok} | puntadas fichero=${fila.dst?.puntadas} metadata=${fila.coincide?.declarado?.stitchCount}`,
		);
	}

	await writeFile(
		path.join(aqui, "artefactos.json"),
		`${JSON.stringify(informe, null, 2)}\n`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
