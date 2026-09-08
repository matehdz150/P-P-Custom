import path from "node:path";
import { EMBROIDERY_PROFILE_V2 } from "@kustto/bordado";
import sharp from "sharp";
import { crearCronometro } from "@/lib/bordado/cronometro";
import { prepararPixeles } from "@/lib/bordado/raster";

const corpus =
	"/Users/matehdz/Documents/Software Projects/P-P-Custom/pruebas/bordado/regresion/corpus";
const MM = 0.05,
	M = 2;

async function uno(archivo: string) {
	const e = sharp(path.join(corpus, archivo));
	const meta = await e.metadata();
	const w0 = Math.round(70 / MM);
	const h0 = Math.max(
		1,
		Math.round((w0 * (meta.height ?? 1)) / (meta.width ?? 1)),
	);
	const { data } = await e
		.resize(w0, h0, { fit: "fill" })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const w = w0 + M * 2,
		h = h0 + M * 2;
	const buf = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h0; y++)
		buf.set(data.subarray(y * w0 * 4, (y + 1) * w0 * 4), ((y + M) * w + M) * 4);

	const reloj = crearCronometro();
	const t0 = performance.now();
	const r = prepararPixeles({
		datos: buf,
		ancho: w,
		alto: h,
		mmPorPx: MM,
		desplazamientoMm: M * MM,
		profile: EMBROIDERY_PROFILE_V2,
		sourceObjectId: archivo,
		prefijo: "h",
		cronometro: reloj,
	});
	const total = performance.now() - t0;
	const c = r.coste;
	console.log(`${archivo}
  primerPlano≈${Math.round(r.diagnostico.fraccionInterior * 0)}  regiones=${r.diagnostico.regionesGrandes} compAntes=${r.diagnostico.componentesAntes} compDesp=${r.diagnostico.componentesDespues}
  esqueletoPx=${c.pixelesEsqueleto} ramas=${c.ramas} cruces=${c.cruces} pasadas=${c.pasadasAdelgazado}
  fusiones=${c.fusiones} comparaciones=${c.comparacionesFusion.toLocaleString()}
  msEsqueleto=${c.msEsqueleto.toFixed(0)} msFusion=${c.msFusion.toFixed(0)} total=${total.toFixed(0)}ms objetos=${r.objetos.length}`);
}

async function main() {
	for (const a of process.argv.slice(2)) await uno(a);
}
main().catch((e) => {
	console.error(e);
	process.exit(1);
});
