"use client";

import { coeficientes, type Punto } from "./perspectiva";

/**
 * La prenda con el diseño encima, rasterizada en un PNG.
 *
 * POR QUÉ NO SIRVE LO DE PANTALLA. En el editor la proyección la hace CSS con
 * `matrix3d`, y eso no se puede exportar: el navegador no deja leer píxeles de
 * una capa transformada. Para descargarla hay que rehacerla en un lienzo.
 *
 * SE RECORRE EL DESTINO, NO EL ORIGEN. La otra forma de rasterizar una
 * homografía es partir el cuadrilátero en triángulos y dibujarlos con
 * transformadas afines; es más rápida, pero deja costuras finas entre triángulo
 * y triángulo y hay que ir dilatándolos para taparlas. Recorriendo los píxeles
 * del destino e invirtiendo la matriz no hay costuras que tapar, y con el
 * muestreo bilineal el borde del arte queda limpio. Se paga en tiempo: unas
 * décimas de segundo para el recuadro de una prenda, y esto corre una vez, al
 * pulsar descargar.
 */

export type MezclaDeTinta = "multiply" | "normal";

/** El tope de ancho del PNG. Una foto de estudio llega a 4000 px y no hace falta. */
const ANCHO_MAXIMO = 1600;

export async function componerPrenda({
	fotoUrl,
	arteUrl,
	esquinas,
	mezcla,
}: {
	fotoUrl: string;
	/** El arte solo, recortado al área imprimible y con fondo transparente. */
	arteUrl: string;
	/** Las cuatro esquinas en fracciones de 0 a 1 de la foto. */
	esquinas: Punto[];
	mezcla: MezclaDeTinta;
}): Promise<Blob | null> {
	const [foto, arte] = await Promise.all([cargar(fotoUrl), cargar(arteUrl)]);
	if (!foto || !arte) return null;

	const escala = Math.min(1, ANCHO_MAXIMO / foto.naturalWidth);
	const ancho = Math.max(1, Math.round(foto.naturalWidth * escala));
	const alto = Math.max(1, Math.round(foto.naturalHeight * escala));

	const salida = lienzo(ancho, alto);
	const ctx = salida.getContext("2d", { willReadFrequently: true });
	if (!ctx) return null;

	ctx.drawImage(foto, 0, 0, ancho, alto);

	const k = coeficientes(
		esquinas.map((p) => ({ x: p.x * ancho, y: p.y * alto })),
	);
	// Cuadrilátero degenerado: se devuelve la prenda sola antes que una mancha.
	if (!k) return aBlob(salida);

	const inversa = invertir(k);
	if (!inversa) return aBlob(salida);

	/* El arte se lee UNA vez a su resolución nativa. Redibujarlo por píxel sería
	   millones de `drawImage`; lo que se necesita es su tabla de colores. */
	const fuente = lienzo(arte.naturalWidth, arte.naturalHeight);
	const ctxArte = fuente.getContext("2d", { willReadFrequently: true });
	if (!ctxArte) return aBlob(salida);
	ctxArte.drawImage(arte, 0, 0);

	let pixelesArte: ImageData;
	let destino: ImageData;
	try {
		pixelesArte = ctxArte.getImageData(0, 0, fuente.width, fuente.height);
		destino = ctx.getImageData(0, 0, ancho, alto);
	} catch {
		// Lienzo contaminado por una imagen de otro origen. No debería pasar —las
		// fotos son nuestras y el arte es un data URL— pero si pasa, sin diseño
		// encima antes que reventar.
		return aBlob(salida);
	}

	pintar(destino, pixelesArte, inversa, esquinas, ancho, alto, mezcla);

	ctx.putImageData(destino, 0, 0);
	return aBlob(salida);
}

/**
 * Recorre el rectángulo que envuelve al cuadrilátero y pinta lo que cae dentro.
 *
 * Sólo ese rectángulo y no la imagen entera: el estampado ocupa una fracción de
 * la prenda, y recorrer los cuatro millones de píxeles de la foto para tocar
 * doscientos mil sería tirar el noventa por ciento del trabajo.
 */
function pintar(
	destino: ImageData,
	arte: ImageData,
	inv: number[],
	esquinas: Punto[],
	ancho: number,
	alto: number,
	mezcla: MezclaDeTinta,
) {
	const xs = esquinas.map((p) => p.x * ancho);
	const ys = esquinas.map((p) => p.y * alto);

	const x0 = Math.max(0, Math.floor(Math.min(...xs)));
	const x1 = Math.min(ancho - 1, Math.ceil(Math.max(...xs)));
	const y0 = Math.max(0, Math.floor(Math.min(...ys)));
	const y1 = Math.min(alto - 1, Math.ceil(Math.max(...ys)));

	const d = destino.data;
	const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = inv;

	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			// El centro del píxel, no su esquina: con la esquina el estampado
			// entero queda medio píxel corrido hacia arriba y a la izquierda.
			const px = x + 0.5;
			const py = y + 0.5;

			const w = m6 * px + m7 * py + m8;
			if (w === 0) continue;

			const u = (m0 * px + m1 * py + m2) / w;
			const v = (m3 * px + m4 * py + m5) / w;
			if (u < 0 || u > 1 || v < 0 || v > 1) continue;

			const tinta = muestrear(
				arte,
				u * arte.width - 0.5,
				v * arte.height - 0.5,
			);
			const alfa = tinta[3] / 255;
			if (alfa <= 0) continue;

			const i = (y * ancho + x) * 4;

			for (let canal = 0; canal < 3; canal++) {
				const fondo = d[i + canal];
				/* `multiply` deja pasar los pliegues de la tela; `normal` la tapa.
				   Los dos respetan el alfa del arte, que es lo que hace que el borde
				   de una letra no salga dentado. */
				const puesto =
					mezcla === "multiply" ? (fondo * tinta[canal]) / 255 : tinta[canal];
				d[i + canal] = fondo + (puesto - fondo) * alfa;
			}
		}
	}
}

/**
 * Muestreo bilineal del arte.
 *
 * Sin él, el estampado sale con los bordes dentados: el vecino más cercano
 * decide de golpe y en una letra curva eso se ve a simple vista. Fuera de la
 * imagen devuelve transparente en vez de repetir el borde, que es lo que
 * dibujaría una franja de color a lo largo del cuadro.
 */
function muestrear(img: ImageData, x: number, y: number) {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const fx = x - x0;
	const fy = y - y0;

	const salida = [0, 0, 0, 0];

	for (const [dx, dy, peso] of [
		[0, 0, (1 - fx) * (1 - fy)],
		[1, 0, fx * (1 - fy)],
		[0, 1, (1 - fx) * fy],
		[1, 1, fx * fy],
	]) {
		if (peso === 0) continue;

		const cx = x0 + dx;
		const cy = y0 + dy;
		if (cx < 0 || cy < 0 || cx >= img.width || cy >= img.height) continue;

		const i = (cy * img.width + cx) * 4;
		salida[0] += img.data[i] * peso;
		salida[1] += img.data[i + 1] * peso;
		salida[2] += img.data[i + 2] * peso;
		salida[3] += img.data[i + 3] * peso;
	}

	return salida;
}

/**
 * La inversa de la homografía, en fila mayor.
 *
 * Hace falta porque se recorre el DESTINO: de cada píxel de la prenda hay que
 * saber qué punto del arte le toca, y los coeficientes van al revés.
 *
 * Se exporta para poder comprobarla de verdad: un signo cambiado aquí no se ve
 * en el resultado —el estampado sale colocado casi bien— y se descubre tarde.
 */
export function invertir(k: {
	a: number;
	b: number;
	c: number;
	d: number;
	e: number;
	f: number;
	g: number;
	h: number;
}) {
	// [a b c; d e f; g h 1]
	const m = [k.a, k.b, k.c, k.d, k.e, k.f, k.g, k.h, 1];

	const det =
		m[0] * (m[4] * m[8] - m[5] * m[7]) -
		m[1] * (m[3] * m[8] - m[5] * m[6]) +
		m[2] * (m[3] * m[7] - m[4] * m[6]);

	if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;

	// Adjunta traspuesta entre el determinante. Nueve términos y se acabó: no
	// vale la pena una eliminación gaussiana para una matriz de tres por tres.
	const adj = [
		m[4] * m[8] - m[5] * m[7],
		m[2] * m[7] - m[1] * m[8],
		m[1] * m[5] - m[2] * m[4],
		m[5] * m[6] - m[3] * m[8],
		m[0] * m[8] - m[2] * m[6],
		m[2] * m[3] - m[0] * m[5],
		m[3] * m[7] - m[4] * m[6],
		m[1] * m[6] - m[0] * m[7],
		m[0] * m[4] - m[1] * m[3],
	];

	return adj.map((n) => n / det);
}

function lienzo(w: number, h: number) {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	return c;
}

function cargar(url: string) {
	return new Promise<HTMLImageElement | null>((listo) => {
		const img = new Image();
		// Las fotos son nuestras y el arte es un data URL, así que no hace falta
		// CORS; se pide igual por si un día una foto se sirve desde el CDN.
		img.crossOrigin = "anonymous";
		img.onload = () => listo(img);
		img.onerror = () => listo(null);
		img.src = url;
	});
}

function aBlob(canvas: HTMLCanvasElement) {
	return new Promise<Blob | null>((listo) => {
		canvas.toBlob((b) => listo(b), "image/png");
	});
}
