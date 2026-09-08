/**
 * El corpus ampliado contra el algoritmo CONGELADO.
 *
 * Nada de lo que hay aquí puede cambiar una decisión: este archivo mide y
 * escribe un JSON. Si un caso sale mal, sale mal en el informe — no se toca el
 * umbral para que pase.
 *
 * CADA CASO CORRE EN SU PROPIO PROCESO, CON TOPE DE TIEMPO. No es paranoia: en
 * la primera pasada una fotografía posterizada se quedó girando al 99 % de CPU
 * sin terminar, y con todo en un solo proceso eso no es un dato, es un banco
 * que no acaba nunca. Aislado, "no termina en 90 s" ES el dato, se anota y se
 * sigue. El tope es del banco, no del algoritmo: el algoritmo no lleva ninguno.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { EMBROIDERY_PROFILE_V2 } from "@kustto/bordado";
import sharp from "sharp";
import { crearCronometro } from "@/lib/bordado/cronometro";
import { prepararPixeles } from "@/lib/bordado/raster";

declare const __dirname: string;
const aqui = __dirname;
const corpus = path.join(aqui, "corpus");

const MM_POR_PX = 0.05;
const MARGEN_PX = 2;
/** Ancho físico al que se borda cada caso. Es el ancho máximo del perfil. */
const ANCHO_MM = 70;

type Fixture = {
	archivo: string;
	familia: "logo" | "ilustracion" | "foto" | "ambiguo";
	espera: "grafico" | "foto" | "ambiguo";
	nota: string;
};

const ahora = () =>
	typeof performance !== "undefined" ? performance.now() : Date.now();

async function correr(fixture: Fixture) {
	const ruta = path.join(corpus, fixture.archivo);
	const reloj = crearCronometro();

	const inicio = ahora();
	const { datos, ancho, alto } = await (async () => {
		const entrada = sharp(ruta);
		const meta = await entrada.metadata();
		const relacion = (meta.height ?? 1) / (meta.width ?? 1);
		const anchoPx = Math.round(ANCHO_MM / MM_POR_PX);
		const altoPx = Math.max(1, Math.round(anchoPx * relacion));
		const { data } = await entrada
			.resize(anchoPx, altoPx, { fit: "fill" })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });

		const w = anchoPx + MARGEN_PX * 2;
		const h = altoPx + MARGEN_PX * 2;
		const buffer = new Uint8ClampedArray(w * h * 4);
		for (let y = 0; y < altoPx; y++) {
			buffer.set(
				data.subarray(y * anchoPx * 4, (y + 1) * anchoPx * 4),
				((y + MARGEN_PX) * w + MARGEN_PX) * 4,
			);
		}
		return { datos: buffer, ancho: w, alto: h };
	})();
	reloj.sumar("decode", ahora() - inicio);

	const desde = ahora();
	const r = prepararPixeles({
		datos,
		ancho,
		alto,
		mmPorPx: MM_POR_PX,
		desplazamientoMm: MARGEN_PX * MM_POR_PX,
		profile: EMBROIDERY_PROFILE_V2,
		sourceObjectId: fixture.archivo,
		prefijo: "c",
		cronometro: reloj,
	});
	const total = ahora() - desde + reloj.etapas.decode;

	const decision = r.rechazo
		? "REJECTED"
		: r.incidencias.length
			? "REVIEW"
			: "READY";

	return {
		archivo: fixture.archivo,
		familia: fixture.familia,
		espera: fixture.espera,
		nota: fixture.nota,
		clase: r.analisis.classification,
		decision,
		rechazo: r.rechazo?.code ?? null,
		// `earlyReject` es lo que de verdad importa medir: si se paró ANTES de
		// cuantizar, no se gastó paleta, ni limpieza, ni geometría, ni motor.
		earlyReject: r.rechazo?.code === "PHOTO",
		presupuestoAgotado: r.presupuestoAgotado ?? null,
		suavidadInterior: r.diagnostico.suavidadInterior,
		concentracionInterior: r.diagnostico.concentracionInterior,
		entropiaInterior: r.diagnostico.entropiaInterior,
		fraccionInterior: r.diagnostico.fraccionInterior,
		coloresOrigen: r.analisis.sourceColorCount,
		coloresReducidos: r.analisis.reducedColorCount,
		conAlfa: r.analisis.hadAlpha,
		componentesAntes: r.diagnostico.componentesAntes,
		componentesDespues: r.diagnostico.componentesDespues,
		regiones: r.diagnostico.regionesGrandes,
		motas: r.diagnostico.motas,
		areaEnMotas: r.diagnostico.areaEnMotas,
		objetos: r.objetos.length,
		puntadas: r.conteo,
		incidencias: r.incidencias.map((i) => i.code),
		coste: r.coste,
		tiempos: { ...reloj.etapas, total },
	};
}

const TOPE_MS = 90_000;

/** Modo hijo: mide un solo caso y lo escupe como JSON por stdout. */
async function hijo(crudo: string) {
	const fixture: Fixture = JSON.parse(crudo);
	const r = await correr(fixture);
	process.stdout.write(`\u0000${JSON.stringify(r)}`);
}

async function main() {
	const fixtures: Fixture[] = JSON.parse(
		await readFile(path.join(corpus, "manifiesto.json"), "utf8"),
	);
	const { spawn } = await import("node:child_process");
	const salida: unknown[] = [];

	for (const fixture of fixtures) {
		process.stdout.write(`${fixture.archivo} ... `);
		const desde = ahora();
		const resultado = await new Promise<Record<string, unknown>>((resolver) => {
			const proceso = spawn(
				process.execPath,
				[...process.execArgv, __filename, JSON.stringify(fixture)],
				{ cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
			);
			let buffer = "";
			let errores = "";
			const reloj = setTimeout(() => {
				proceso.kill("SIGKILL");
			}, TOPE_MS);

			proceso.stdout.on("data", (trozo) => {
				buffer += String(trozo);
			});
			proceso.stderr.on("data", (trozo) => {
				errores += String(trozo);
			});
			proceso.on("close", (codigo, senal) => {
				clearTimeout(reloj);
				const marca = buffer.indexOf("\u0000");
				if (marca >= 0) {
					try {
						resolver(JSON.parse(buffer.slice(marca + 1)));
						return;
					} catch {}
				}
				resolver({
					...fixture,
					noTermina: senal === "SIGKILL",
					error: senal
						? `no terminó en ${TOPE_MS / 1000}s`
						: errores.trim().split("\n").slice(-1)[0] || `código ${codigo}`,
					tiempos: { total: ahora() - desde },
				});
			});
		});

		salida.push(resultado);
		console.log(
			resultado.error
				? `SIN RESULTADO: ${resultado.error}`
				: `${resultado.clase}/${resultado.decision} suav=${resultado.suavidadInterior} ${(resultado.tiempos as { total: number }).total.toFixed(0)}ms`,
		);
	}

	await writeFile(
		path.join(aqui, "resultados-corpus.json"),
		`${JSON.stringify(salida, null, 2)}\n`,
	);
}

const argumento = process.argv[2];
const arranque = argumento ? hijo(argumento) : main();
arranque.catch((error) => {
	console.error(error);
	process.exit(1);
});
