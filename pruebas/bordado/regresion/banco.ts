/**
 * Las catorce regresiones de la preparación de bordado.
 *
 * POR QUÉ NO ARRANCA UN NAVEGADOR. Lo único del pipeline que necesita canvas es
 * pintar el objeto del editor sobre una rejilla; a partir de ahí todo son
 * píxeles y milímetros. `prepararPixeles` y `objetosDeMascara` reciben eso
 * directamente, así que las reglas —qué es logo, qué se rechaza, qué asta sale
 * satin— se prueban aquí sin Chrome de por medio y se prueban DE VERDAD, no
 * mirando una captura.
 *
 * LO QUE ESTO NO CUBRE, y hay que decirlo: la conversión de una fuente real a
 * curvas (`textoATrazos`) y el pintado del objeto de Fabric. Lo primero ya está
 * en producción para el láser; lo segundo son cuatro líneas de transformación.
 * Los seis casos de texto usan letras dibujadas como trazados para poder fijar
 * su altura y su asta EN MILÍMETROS, que es lo que se quiere comprobar: con una
 * fuente del sistema el mismo test diría cosas distintas en cada máquina.
 *
 * LAS IMÁGENES SON LAS DEL BANCO DEL LÁSER a propósito. Si una de las dos
 * técnicas cambia de opinión sobre la misma imagen, se quiere ver.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { EMBROIDERY_PROFILE_V2, type Rejilla } from "@kustto/bordado";
import sharp from "sharp";
import { objetosDeMascara } from "@/lib/bordado/formas";
import { prepararPixeles } from "@/lib/bordado/raster";

const perfil = EMBROIDERY_PROFILE_V2;

/* `tsx` compila este archivo a CommonJS —`pruebas/` no es un paquete del
   workspace y ponerle un `package.json` con `type: module` rompería la
   resolución de `@kustto/bordado`—, así que aquí el directorio se lee de
   `__dirname` y no de `import.meta`. */
declare const __dirname: string;
const aqui = __dirname;

const fixtures = path.resolve(aqui, "../../vectorizacion-adaptativa/fixtures");

/* La misma resolución que usa el editor. Está aquí escrita a mano y no
   importada: si alguien la cambia allí, este banco tiene que fallar y obligar a
   revisar los umbrales, no seguirla en silencio. */
const MM_POR_PX = 0.05;
const MARGEN_PX = 2;

/** Una imagen del banco, escalada al tamaño físico al que se bordaría. */
async function rejillaDeImagen(archivo: string, anchoMm: number) {
	const entrada = sharp(path.join(fixtures, archivo));
	const meta = await entrada.metadata();
	const relacion = (meta.height ?? 1) / (meta.width ?? 1);
	const anchoPx = Math.round(anchoMm / MM_POR_PX);
	const altoPx = Math.max(1, Math.round(anchoPx * relacion));

	const { data } = await entrada
		.resize(anchoPx, altoPx, { fit: "fill" })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	// Se enmarca igual que `lienzoEnMm`: la transformada de distancia trata lo de
	// fuera como fondo y una forma pegada al borde se mediría cortada.
	const ancho = anchoPx + MARGEN_PX * 2;
	const alto = altoPx + MARGEN_PX * 2;
	const datos = new Uint8ClampedArray(ancho * alto * 4);
	for (let y = 0; y < altoPx; y++) {
		datos.set(
			data.subarray(y * anchoPx * 4, (y + 1) * anchoPx * 4),
			((y + MARGEN_PX) * ancho + MARGEN_PX) * 4,
		);
	}

	return { datos, ancho, alto };
}

async function prepararImagen(archivo: string, anchoMm: number) {
	const { datos, ancho, alto } = await rejillaDeImagen(archivo, anchoMm);
	return prepararPixeles({
		datos,
		ancho,
		alto,
		mmPorPx: MM_POR_PX,
		desplazamientoMm: MARGEN_PX * MM_POR_PX,
		profile: perfil,
		sourceObjectId: archivo,
		prefijo: "r",
	});
}

/** Una letra dibujada como trazado, rasterizada al tamaño físico que se pida. */
async function rejillaDeTrazado(
	d: string,
	viewBox: string,
	altoMm: number,
): Promise<Rejilla> {
	const [, , vbAncho, vbAlto] = viewBox.split(/\s+/).map(Number);
	const altoPx = Math.round(altoMm / MM_POR_PX);
	const anchoPx = Math.max(1, Math.round((altoPx * vbAncho) / vbAlto));

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${anchoPx}" height="${altoPx}" viewBox="${viewBox}"><path d="${d}" fill="#000000" fill-rule="nonzero"/></svg>`;
	const { data } = await sharp(Buffer.from(svg))
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const ancho = anchoPx + MARGEN_PX * 2;
	const alto = altoPx + MARGEN_PX * 2;
	const mascara = new Uint8Array(ancho * alto);
	for (let y = 0; y < altoPx; y++) {
		for (let x = 0; x < anchoPx; x++) {
			const a = data[(y * anchoPx + x) * 4 + 3];
			if (a >= 128) mascara[(y + MARGEN_PX) * ancho + (x + MARGEN_PX)] = 1;
		}
	}

	return { datos: mascara, ancho, alto, mmPorPx: MM_POR_PX };
}

async function prepararTexto(
	d: string,
	viewBox: string,
	altoMm: number,
	nombre: string,
) {
	return objetosDeMascara({
		rejilla: await rejillaDeTrazado(d, viewBox, altoMm),
		profile: perfil,
		colorId: "color-111111",
		sourceObjectId: nombre,
		sourceType: "text",
		classification: "text",
		prefijo: "t",
		desplazamientoMm: MARGEN_PX * MM_POR_PX,
		esTexto: true,
	});
}

/* Las letras. Coordenadas en un viewBox de 100 de alto para poder pedir la
   altura física en milímetros y que el asta salga en la proporción real de una
   tipografía: una grotesca ronda el 14 % de la altura de mayúscula. */
const LETRAS = {
	/** "H" de palo seco: dos astas y un travesaño. El caso que motiva el satin. */
	hachePaloSeco: {
		viewBox: "0 0 76 100",
		d: "M0 0h14v43h48V0h14v100H62V57H14v43H0z",
	},
	/** "O": un anillo, es decir una columna cerrada con contraforma grande. */
	oGrande: {
		viewBox: "0 0 88 100",
		d: "M44 0a44 50 0 1 0 .1 0zm0 14a30 36 0 1 1-.1 0z",
	},
	/** "I" de serif con astas de pelo: el asta vertical mide el 4 % de la altura. */
	iSerifFina: {
		viewBox: "0 0 60 100",
		d: "M8 0h44v9H34v82h18v9H8v-9h18V9H8z",
	},
	/** Una barra gordísima: uniforme y alargada, pero de columna imposible. */
	barraAncha: {
		viewBox: "0 0 60 100",
		d: "M6 0h48v100H6z",
	},
	/** "e" minúscula con la contraforma diminuta que se cierra al bordar. */
	eContraformaChica: {
		viewBox: "0 0 90 100",
		d: "M45 0a45 50 0 1 0 0 100 45 50 0 0 0 40-26H68a28 32 0 1 1 0-48 28 32 0 0 1 6 10H45v14h44a45 50 0 0 0-44-50z",
	},
} as const;

export type Caso = {
	nombre: string;
	esperado: string;
	ejecutar: () => Promise<Record<string, unknown>>;
};

export const CASOS: Caso[] = [
	// ---------------------------------------------------------------- raster
	{
		nombre: "01 logo PNG con transparencia",
		esperado: "logo, se prepara, sin rechazo",
		ejecutar: async () =>
			resumenRaster(await prepararImagen("01-logo-color-alpha.png", 70)),
	},
	{
		nombre: "02 logo PNG con fondo blanco",
		esperado: "logo, el fondo blanco no se borda",
		ejecutar: async () =>
			resumenRaster(await prepararImagen("02-logo-color-sin-alpha.png", 70)),
	},
	{
		nombre: "03 logo de dos tintas",
		esperado: "logo, paleta corta",
		ejecutar: async () =>
			resumenRaster(await prepararImagen("03-logo-blanco-negro.png", 70)),
	},
	{
		nombre: "04 wordmark con texto pequeño",
		esperado: "logo o ilustración, avisa de detalle perdido",
		ejecutar: async () =>
			resumenRaster(await prepararImagen("04-wordmark-texto-pequeno.png", 70)),
	},
	{
		nombre: "05 icono geométrico",
		esperado: "logo, pocas regiones",
		ejecutar: async () =>
			resumenRaster(await prepararImagen("05-icono-geometrico.png", 60)),
	},
	{
		nombre: "06 ilustración por regiones",
		esperado: "ilustración -> revisión humana",
		ejecutar: async () =>
			resumenRaster(await prepararImagen("06-ilustracion.png", 70)),
	},
	{
		nombre: "07 retrato fotográfico",
		esperado: "foto -> rechazo sin llegar al motor",
		ejecutar: async () =>
			resumenRaster(await prepararImagen("07-retrato.jpg", 70)),
	},
	{
		nombre: "08 fotografía recortada con alfa",
		esperado: "foto -> rechazo; el alfa no la convierte en logo",
		ejecutar: async () =>
			resumenRaster(await prepararImagen("08-fotografia-alpha.png", 70)),
	},
	{
		nombre: "09 degradados",
		esperado: "foto -> rechazo",
		ejecutar: async () =>
			resumenRaster(await prepararImagen("09-degradados.png", 70)),
	},
	{
		nombre: "10 JPEG con ruido de compresión",
		esperado: "foto -> rechazo; el ruido no pasa por logo",
		ejecutar: async () =>
			resumenRaster(await prepararImagen("10-jpeg-ruido-compresion.jpg", 70)),
	},
	// ----------------------------------------------------------------- texto
	{
		nombre: "11 H de palo seco a 25 mm",
		esperado: "tres columnas satin, sin incidencias",
		ejecutar: async () =>
			resumenTexto(
				await prepararTexto(
					LETRAS.hachePaloSeco.d,
					LETRAS.hachePaloSeco.viewBox,
					25,
					"H25",
				),
			),
	},
	{
		nombre: "12 H de palo seco a 7 mm",
		esperado: "sigue siendo legible; astas finas -> running o satin",
		ejecutar: async () =>
			resumenTexto(
				await prepararTexto(
					LETRAS.hachePaloSeco.d,
					LETRAS.hachePaloSeco.viewBox,
					7,
					"H7",
				),
			),
	},
	{
		nombre: "13 H de palo seco a 4 mm",
		esperado: "rechazo por altura insuficiente",
		ejecutar: async () =>
			resumenTexto(
				await prepararTexto(
					LETRAS.hachePaloSeco.d,
					LETRAS.hachePaloSeco.viewBox,
					4,
					"H4",
				),
			),
	},
	{
		nombre: "14 I de serif con asta de pelo a 12 mm",
		esperado: "rechazo por asta demasiado fina",
		ejecutar: async () =>
			resumenTexto(
				await prepararTexto(
					LETRAS.iSerifFina.d,
					LETRAS.iSerifFina.viewBox,
					12,
					"I12",
				),
			),
	},
	{
		nombre: "15 columna de 15 mm de ancho",
		esperado: "relleno, avisando de que la columna es demasiado ancha",
		ejecutar: async () =>
			resumenTexto(
				await prepararTexto(
					LETRAS.barraAncha.d,
					LETRAS.barraAncha.viewBox,
					30,
					"barra",
				),
			),
	},
	{
		nombre: "16 e con contraforma diminuta a 8 mm",
		esperado: "revisión por contraforma que se cierra",
		ejecutar: async () =>
			resumenTexto(
				await prepararTexto(
					LETRAS.eContraformaChica.d,
					LETRAS.eContraformaChica.viewBox,
					8,
					"e8",
				),
			),
	},
	{
		nombre: "17 O grande",
		esperado: "una columna satin cerrada, con la contraforma intacta",
		ejecutar: async () =>
			resumenTexto(
				await prepararTexto(
					LETRAS.oGrande.d,
					LETRAS.oGrande.viewBox,
					25,
					"O25",
				),
			),
	},
];

function resumenRaster(r: Awaited<ReturnType<typeof prepararImagen>>) {
	return {
		clase: r.analisis.classification,
		rechazo: r.rechazo?.code ?? null,
		conAlfa: r.analisis.hadAlpha,
		coloresOrigen: r.analisis.sourceColorCount,
		coloresReducidos: r.analisis.reducedColorCount,
		perdidaDeltaE: r.analisis.quantizationDeltaE,
		regionesEliminadas: r.analisis.removedRegions,
		areaEliminadaMm2: r.analisis.removedAreaMm2,
		objetos: r.objetos.length,
		puntadas: r.conteo,
		incidencias: r.incidencias.map((i) => i.code),
		metricas: r.metricas,
		diagnostico: r.diagnostico,
		hayRaster: r.objetos.some((o) => /<image|<text/.test(o.geometry.d)),
	};
}

function resumenTexto(r: Awaited<ReturnType<typeof prepararTexto>>) {
	const satin = r.objetos.filter((o) => o.stitch.type === "satin");
	return {
		objetos: r.objetos.length,
		puntadas: r.conteo,
		anchosSatinMm: satin.map((o) => o.stitch.strokeWidthMm),
		alturaMm: Number(
			Math.max(0, ...r.objetos.map((o) => o.bounds.heightMm)).toFixed(2),
		),
		incidencias: r.incidencias.map((i) => `${i.severity}:${i.code}`),
		regionesEliminadas: r.eliminadas,
		// Un satin tiene que ser una LÍNEA, no un contorno cerrado.
		satinAbierto: satin.every((o) => !/Z$/.test(o.geometry.d.trim())),
	};
}

export async function correrBanco() {
	const salida: Record<string, unknown> = {};
	for (const caso of CASOS) {
		process.stdout.write(`${caso.nombre} ... `);
		try {
			const r = await caso.ejecutar();
			salida[caso.nombre] = { esperado: caso.esperado, ...r };
			console.log("ok");
		} catch (error) {
			salida[caso.nombre] = { esperado: caso.esperado, error: String(error) };
			console.log(`ERROR: ${(error as Error).message}`);
		}
	}
	await writeFile(
		path.join(aqui, "resultados.json"),
		`${JSON.stringify(salida, null, 2)}\n`,
	);
	return salida;
}
