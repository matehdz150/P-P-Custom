"use client";

import type { MezclaDeTinta } from "./componer";

/**
 * El diseño enrollado sobre una taza o un termo, rasterizado en un PNG.
 *
 * POR QUÉ NO SIRVE `componerPrenda`. Aquél invierte una HOMOGRAFÍA: cuatro
 * esquinas definen un PLANO, y sobre una playera eso es correcto. Una taza es
 * un CILINDRO. Con la homografía el arte queda como una calcomanía pegada
 * plana: las letras de los extremos no se comprimen y el diseño no se va
 * curvando hacia el borde. Falla justo donde se mira.
 *
 * LA MITAD DE LA ENVOLTURA ES LO QUE SE VE. De frente, un cilindro enseña 180°
 * de sus 360°, así que sólo la mitad del arte entra en la imagen — y NO la
 * mitad recortada a tijera, sino comprimida hacia los bordes: dos columnas
 * separadas un milímetro en el centro se ven separadas un milímetro, y en el
 * borde casi se tocan.
 *
 * LA MATEMÁTICA, que es toda la diferencia. Para un píxel a la fracción
 * horizontal `u` del cuerpo visible:
 *
 *     θ = asin(2u − 1)              el ángulo sobre el cilindro, de −90° a 90°
 *     x  = centro + θ / 2π          la columna del arte, en fracción de 0 a 1
 *
 * `asin` es lo que produce la compresión: reparte los 180° visibles sobre el
 * ancho de la foto tal como los reparte el propio cilindro.
 *
 * EL FILO SE COMBA. Una taza fotografiada de frente enseña el borde de arriba
 * como una elipse, no como una recta, y la banda impresa la sigue. `bombeo`
 * dice cuánto baja el centro respecto de los extremos, en fracción del alto de
 * la banda; se aplica arriba y abajo con `cos θ`, que vale 1 en el centro y 0
 * en los bordes.
 *
 * SE RECORRE EL DESTINO, NO EL ORIGEN, igual que en la prenda: recorrer el
 * origen dejaría huecos entre píxeles justo donde el arte se estira.
 */

/** El tope de ancho del PNG. Una foto de estudio llega a 4000 px y no hace falta. */
const ANCHO_MAXIMO = 1600;

export type BandaCilindrica = {
	/** Los bordes visibles del cuerpo, en fracciones de 0 a 1 de la foto. */
	izquierda: number;
	derecha: number;
	/** El alto de la banda imprimible, también en fracciones. */
	arriba: number;
	abajo: number;
	/**
	 * Cuánto se comba el filo, en fracción del alto de la banda. Positivo
	 * hunde el centro, que es lo que se ve cuando la foto está tomada un poco
	 * por encima. Cero deja la banda recta.
	 */
	bombeo: number;
	/**
	 * Qué punto de la envoltura mira a la cámara, en fracción de 0 a 1.
	 *
	 * 0.5 es "el centro del arte va al frente", que es lo normal cuando el asa
	 * queda detrás. Con el asa a un lado, el taller lo corre para que lo que se
	 * ve sea lo que el cliente puso enfrente y no la costura.
	 */
	centro: number;
};

export async function componerCilindro({
	fotoUrl,
	arteUrl,
	banda,
	mezcla,
}: {
	fotoUrl: string;
	/** El arte de la envoltura ENTERA, 360°, tal como se imprime. */
	arteUrl: string;
	banda: BandaCilindrica;
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

	const x0 = banda.izquierda * ancho;
	const x1 = banda.derecha * ancho;

	// Banda degenerada: se devuelve la taza sola antes que una mancha.
	if (!(x1 > x0)) return aBlob(salida);

	/* El arte se lee UNA vez a su resolución nativa. Redibujarlo por píxel
	   serían millones de `drawImage`; lo que se necesita es su tabla de
	   colores. */
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

	pintar(destino, pixelesArte, banda, ancho, alto, mezcla);

	ctx.putImageData(destino, 0, 0);
	return aBlob(salida);
}

/**
 * Recorre el rectángulo de la banda y pinta lo que cae dentro del cilindro.
 *
 * Sólo ese rectángulo y no la foto entera: la banda ocupa una fracción de la
 * taza, y recorrer los cuatro millones de píxeles para tocar doscientos mil
 * sería tirar el noventa por ciento del trabajo.
 */
function pintar(
	destino: ImageData,
	arte: ImageData,
	banda: BandaCilindrica,
	ancho: number,
	alto: number,
	mezcla: MezclaDeTinta,
) {
	const izq = banda.izquierda * ancho;
	const der = banda.derecha * ancho;
	const arribaBase = banda.arriba * alto;
	const abajoBase = banda.abajo * alto;
	const altoBanda = abajoBase - arribaBase;

	if (!(altoBanda > 0)) return;

	const bombeoPx = banda.bombeo * altoBanda;

	const x0 = Math.max(0, Math.floor(izq));
	const x1 = Math.min(ancho - 1, Math.ceil(der));
	/* El recorrido vertical se abre por el bombeo: la banda combada baja del
	   rectángulo recto, y sin este margen se recortaría por el centro. */
	const y0 = Math.max(0, Math.floor(arribaBase - Math.abs(bombeoPx) - 1));
	const y1 = Math.min(alto - 1, Math.ceil(abajoBase + Math.abs(bombeoPx) + 1));

	const d = destino.data;
	const anchoVisible = der - izq;

	for (let x = x0; x <= x1; x++) {
		// El centro del píxel, no su esquina: con la esquina el estampado entero
		// queda medio píxel corrido hacia arriba y a la izquierda.
		const px = x + 0.5;

		const u = (px - izq) / anchoVisible;
		if (u < 0 || u > 1) continue;

		/* El ángulo sobre el cilindro. `2u − 1` va de −1 a 1 y `asin` lo
		   convierte en el ángulo que de verdad ocupa esa columna: cerca del
		   borde, un píxel de foto cubre muchos grados de taza. */
		const seno = Math.min(1, Math.max(-1, 2 * u - 1));
		const theta = Math.asin(seno);
		const coseno = Math.cos(theta);

		/* La columna del arte. Los 180° visibles son la MITAD de la envoltura,
		   así que `θ/2π` recorre un cuarto a cada lado del centro. Se envuelve
		   con módulo porque el centro puede estar cerca de la costura. */
		const sx = envolver(banda.centro + theta / (2 * Math.PI));

		const arribaCol = arribaBase + bombeoPx * coseno;
		const abajoCol = abajoBase + bombeoPx * coseno;
		const altoCol = abajoCol - arribaCol;
		if (!(altoCol > 0)) continue;

		for (let y = y0; y <= y1; y++) {
			const py = y + 0.5;

			const v = (py - arribaCol) / altoCol;
			if (v < 0 || v > 1) continue;

			const tinta = muestrear(
				arte,
				sx * arte.width - 0.5,
				v * arte.height - 0.5,
			);
			const alfa = tinta[3] / 255;
			if (alfa <= 0) continue;

			const i = (y * ancho + x) * 4;

			for (let canal = 0; canal < 3; canal++) {
				const fondo = d[i + canal];
				/* `multiply` deja pasar el brillo y la sombra del cilindro, que es
				   justo lo que hace que parezca impreso y no pegado; `normal` lo
				   tapa, y hace falta sobre una taza oscura. */
				const puesto =
					mezcla === "multiply" ? (fondo * tinta[canal]) / 255 : tinta[canal];
				d[i + canal] = fondo + (puesto - fondo) * alfa;
			}
		}
	}
}

/** El arte es un anillo: pasado el 1 se vuelve al 0 por la costura. */
function envolver(x: number) {
	return x - Math.floor(x);
}

/**
 * Muestreo bilineal. Con el vecino más cercano, el borde de una letra sale
 * dentado justo donde el cilindro más lo estira.
 */
function muestrear(img: ImageData, x: number, y: number) {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const fx = x - x0;
	const fy = y - y0;

	const salida = [0, 0, 0, 0];

	for (let canal = 0; canal < 4; canal++) {
		const a = leer(img, x0, y0, canal);
		const b = leer(img, x0 + 1, y0, canal);
		const c = leer(img, x0, y0 + 1, canal);
		const e = leer(img, x0 + 1, y0 + 1, canal);

		salida[canal] =
			a * (1 - fx) * (1 - fy) +
			b * fx * (1 - fy) +
			c * (1 - fx) * fy +
			e * fx * fy;
	}

	return salida;
}

function leer(img: ImageData, x: number, y: number, canal: number) {
	/* En horizontal se ENVUELVE y en vertical se recorta. No es simetría rota:
	   el arte da la vuelta al cilindro, así que su borde derecho continúa en el
	   izquierdo; arriba y abajo, en cambio, se acaba la taza. */
	const cx = ((x % img.width) + img.width) % img.width;
	const cy = Math.min(img.height - 1, Math.max(0, y));

	return img.data[(cy * img.width + cx) * 4 + canal];
}

function lienzo(ancho: number, alto: number) {
	const el = document.createElement("canvas");
	el.width = ancho;
	el.height = alto;
	return el;
}

function cargar(url: string) {
	return new Promise<HTMLImageElement | null>((listo) => {
		const img = new Image();
		// Sin esto, una foto servida por CloudFront contamina el lienzo y
		// `getImageData` lanza `SecurityError`.
		img.crossOrigin = "anonymous";
		img.onload = () => listo(img);
		img.onerror = () => listo(null);
		img.src = url;
	});
}

function aBlob(el: HTMLCanvasElement): Promise<Blob | null> {
	return new Promise((listo) => el.toBlob((b) => listo(b), "image/png"));
}
