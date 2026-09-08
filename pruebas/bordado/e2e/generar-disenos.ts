/**
 * Los siete diseños del E2E, generados con el pipeline real.
 *
 * NO SON JSON ESCRITOS A MANO. Cada uno sale de `preparar()` sobre una imagen o
 * un trazado del corpus, que es exactamente lo que produciría el editor. Un
 * `EmbroideryDesign` inventado probaría que la API acepta un JSON, no que el
 * sistema funciona.
 *
 * Los que el pipeline rechaza en el navegador —la fotografía, la posterizada—
 * también se guardan, con su motivo: forman parte del E2E precisamente porque
 * hay que comprobar que NO llegan al motor.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	canonicalJson,
	EMBROIDERY_PROFILE_V2,
	embroideryDesignHash,
	sha256,
} from "@kustto/bordado";
import sharp from "sharp";
import { BordadoRechazado, preparar } from "@/lib/bordado/preparar";
import type { FuenteCapturada } from "@/lib/bordado/protocolo";

declare const __dirname: string;
const aqui = __dirname;
const corpus = path.join(aqui, "../regresion/corpus");
const destino = path.join(aqui, "disenos");

const MM_POR_PX = 0.05;
const MARGEN_PX = 2;
/** El lado del producto de prueba. Cabe en los límites del perfil (90x60). */
const ANCHO_MM = 70;
const ALTO_MM = 50;

async function fuenteRaster(archivo: string): Promise<FuenteCapturada> {
	const entrada = sharp(path.join(corpus, archivo));
	const meta = await entrada.metadata();
	const anchoPx = Math.round(ANCHO_MM / MM_POR_PX);
	const altoPx = Math.max(
		1,
		Math.round((anchoPx * (meta.height ?? 1)) / (meta.width ?? 1)),
	);
	const { data } = await entrada
		.resize(anchoPx, altoPx, { fit: "fill" })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const ancho = anchoPx + MARGEN_PX * 2;
	const alto = altoPx + MARGEN_PX * 2;
	const datos = new Uint8ClampedArray(ancho * alto * 4);
	for (let y = 0; y < altoPx; y++) {
		datos.set(
			data.subarray(y * anchoPx * 4, (y + 1) * anchoPx * 4),
			((y + MARGEN_PX) * ancho + MARGEN_PX) * 4,
		);
	}
	return {
		tipo: "raster",
		sourceObjectId: archivo,
		datos,
		ancho,
		alto,
		mmPorPx: MM_POR_PX,
		desplazamientoMm: MARGEN_PX * MM_POR_PX,
	};
}

/** Un texto ya en curvas: "KUSTTO" en palo seco, en milímetros. */
function fuenteTexto(alturaMm: number, colorHex = "#111111"): FuenteCapturada {
	const asta = alturaMm * 0.16;
	const hueco = alturaMm * 0.62;
	const y0 = (ALTO_MM - alturaMm) / 2;
	let x = 6;
	const partes: string[] = [];
	const barra = (bx: number, by: number, w: number, h: number) =>
		`M${bx.toFixed(2)} ${by.toFixed(2)}h${w.toFixed(2)}v${h.toFixed(2)}h${(-w).toFixed(2)}z`;

	// Seis astas verticales con travesaños: no pretende ser una tipografía, sino
	// geometría con columnas de grosor conocido para poder comprobarlas.
	for (let i = 0; i < 6; i++) {
		partes.push(barra(x, y0, asta, alturaMm));
		if (i % 2 === 0)
			partes.push(barra(x + asta, y0 + alturaMm / 2 - asta / 2, hueco * 0.5, asta));
		x += asta + hueco * 0.55;
	}
	return {
		tipo: "texto",
		sourceObjectId: "kustto",
		d: partes.join(""),
		colorHex,
	};
}

type Caso = {
	nombre: string;
	espera: string;
	fuentes: () => Promise<FuenteCapturada[]>;
};

const CASOS: Caso[] = [
	{
		nombre: "01-texto-simple",
		espera: "READY o REVIEW: columnas satin de un texto grande",
		fuentes: async () => [fuenteTexto(22)],
	},
	{
		nombre: "02-logo-monocromo",
		espera: "READY o REVIEW: dos tintas",
		fuentes: async () => [await fuenteRaster("logo-bn-simple.png")],
	},
	{
		nombre: "03-logo-multicolor",
		espera: "READY o REVIEW: tres tintas planas",
		fuentes: async () => [await fuenteRaster("logo-multicolor.png")],
	},
	{
		nombre: "04-discovery",
		espera: "REVIEW, nunca PHOTO, con geometría preservada",
		fuentes: async () => [await fuenteRaster("real-01-logo-color-alpha.png")],
	},
	{
		nombre: "05-ilustracion",
		espera: "REVIEW",
		fuentes: async () => [await fuenteRaster("ilustracion-media.png")],
	},
	{
		nombre: "06-fotografia",
		espera: "rechazo en el navegador: no debe llegar al motor",
		fuentes: async () => [await fuenteRaster("real-07-retrato.jpg")],
	},
	{
		nombre: "07-posterizada",
		espera: "presupuesto agotado: acotado, no se cuelga",
		fuentes: async () => [await fuenteRaster("ambiguo-posterizada-8.png")],
	},
];

async function main() {
	await mkdir(destino, { recursive: true });
	const indice: unknown[] = [];

	for (const caso of CASOS) {
		const fuentes = await caso.fuentes();
		const solicitud = {
			revision: 1,
			productId: process.env.E2E_PRODUCT_ID ?? "producto-de-prueba",
			sideId: "front",
			widthMm: ANCHO_MM,
			heightMm: ALTO_MM,
			// El hash del origen lo calcula el editor sobre el lienzo; aquí se
			// deriva de las fuentes para que sea estable y distinto por caso.
			sourceSnapshotHash: await sha256(
				canonicalJson({ caso: caso.nombre, ancho: ANCHO_MM, alto: ALTO_MM }),
			),
			fuentes,
		};

		const desde = Date.now();
		try {
			const { design, tiempos } = preparar(solicitud);
			const designHash = await embroideryDesignHash(design);
			await writeFile(
				path.join(destino, `${caso.nombre}.json`),
				`${JSON.stringify(design, null, 2)}\n`,
			);
			indice.push({
				caso: caso.nombre,
				espera: caso.espera,
				preparado: true,
				designHash,
				objetos: design.objects.length,
				colores: design.colors.length,
				puntadas: design.objects.reduce(
					(c, o) => ({ ...c, [o.stitch.type]: (c[o.stitch.type] ?? 0) + 1 }),
					{} as Record<string, number>,
				),
				msLocal: Date.now() - desde,
				tiempos,
			});
			console.log(
				`${caso.nombre}: ${design.objects.length} objetos, ${design.colors.length} hilos, hash ${designHash.slice(0, 12)}`,
			);
		} catch (error) {
			const motivo =
				error instanceof BordadoRechazado
					? error.incidencias.map((i) => i.code).join(",")
					: String((error as Error).message);
			indice.push({
				caso: caso.nombre,
				espera: caso.espera,
				preparado: false,
				motivo,
				msLocal: Date.now() - desde,
			});
			console.log(`${caso.nombre}: NO PREPARADO (${motivo})`);
		}
	}

	await writeFile(
		path.join(destino, "indice.json"),
		`${JSON.stringify({ profileVersion: EMBROIDERY_PROFILE_V2.version, casos: indice }, null, 2)}\n`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
