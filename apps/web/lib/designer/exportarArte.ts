import type { Canvas, FabricObject } from "fabric";

/**
 * Saca del lienzo el archivo que el taller manda a máquina.
 *
 * NO es el mockup. El mockup es para que el cliente vea cómo le va a quedar;
 * lo que se imprime es sólo el arte, recortado al área imprimible, con fondo
 * transparente y a la resolución que el taller declaró. Mandar la prenda
 * dibujada obligaría a alguien a recortarla a mano antes de producir.
 */

export type ArteDeLado = {
	lado: string;
	blob: Blob;
	/** Lo que mide el archivo de verdad, no lo que se declaró. */
	anchoPx: number;
	altoPx: number;
	dpi: number;
};

/** Área imprimible declarada por el taller, en centímetros. */
export type MedidasDeLado = {
	widthCm: number;
	heightCm: number;
	dpi?: number;
};

const DPI_POR_DEFECTO = 300;
const PULGADA_EN_CM = 2.54;

/**
 * Exporta el arte de un lado, o `null` si ese lado está vacío.
 *
 * TODO ESTO ES SÍNCRONO A PROPÓSITO. El mockup lo repone un watcher cada
 * 200 ms (`useFabricMockup`): si entre quitarlo y exportar hubiera un `await`,
 * el fondo volvería a aparecer y acabaría dentro del archivo de producción.
 * Quitar, renderizar, exportar y restaurar ocurren en el mismo tick.
 */
export function exportarArteDeLado(
	lado: string,
	canvas: Canvas,
	areas: FabricObject[],
	medidas: MedidasDeLado,
): ArteDeLado | null {
	const area = areas[0];
	if (!area) return null;

	// Lo que no es área ni fondo es diseño del cliente. Sin nada suyo, este
	// lado no lleva arte y no hay archivo que mandar.
	const hayDiseno = canvas.getObjects().some((o) => !areas.includes(o));
	if (!hayDiseno) return null;

	const fondo = canvas.backgroundImage;
	const colorFondo = canvas.backgroundColor;
	const vista = canvas.viewportTransform;
	const visibles = areas.map((a) => a.visible);

	try {
		// El zoom y el desplazamiento son de quien está diseñando, no del
		// archivo: sin poner la vista en identidad, el recorte sale corrido
		// justo cuando alguien exportó con el lienzo movido.
		canvas.viewportTransform = [1, 0, 0, 1, 0, 0];

		canvas.backgroundImage = undefined;
		canvas.backgroundColor = "";
		for (const a of areas) a.visible = false;

		canvas.renderAll();

		const recorte = area.getBoundingRect();

		const dpi = medidas.dpi ?? DPI_POR_DEFECTO;
		const anchoObjetivo = Math.round((medidas.widthCm / PULGADA_EN_CM) * dpi);

		// El área en pantalla mide lo que mide; el multiplicador la lleva a los
		// píxeles que pidió el taller. Sin esto, el archivo saldría del tamaño
		// del lienzo del navegador, que no imprime nada decente.
		//
		// Se escala por ANCHO y el alto sale de la proporción del área. Forzar
		// también el alto deformaría el diseño, y encogerlo para que cupiera en
		// los dos lo dejaría más chico de lo que la persona vio en pantalla.
		const multiplicador = anchoObjetivo / recorte.width;

		const dataUrl = canvas.toDataURL({
			format: "png",
			left: recorte.left,
			top: recorte.top,
			width: recorte.width,
			height: recorte.height,
			multiplier: multiplicador,
		});

		/* Las medidas REALES del archivo, no las declaradas.

		   El alto se calculaba antes desde `heightCm` y podía no coincidir con
		   lo que salía: si el área del lienzo no tiene la misma proporción que
		   los centímetros declarados, la ficha decía 35 cm y el archivo medía
		   36.3. Se mide lo que se produjo. */
		return {
			lado,
			blob: aBlob(dataUrl),
			anchoPx: Math.round(recorte.width * multiplicador),
			altoPx: Math.round(recorte.height * multiplicador),
			dpi,
		};
	} finally {
		// En `finally` para que un fallo al exportar no deje el editor sin
		// prenda y con las guías escondidas.
		canvas.backgroundImage = fondo;
		canvas.backgroundColor = colorFondo;
		if (vista) canvas.viewportTransform = vista;
		areas.forEach((a, i) => {
			a.visible = visibles[i];
		});
		canvas.renderAll();
	}
}

/** Lo ancho que se guarda la vista previa. Es para mirarla, no para imprimir. */
const ANCHO_VISTA_PREVIA = 700;

/**
 * El arte solo, en pequeño, para enseñarlo en la pantalla de pedido.
 *
 * Es EXACTAMENTE lo mismo que se manda a producir —recortado al área
 * imprimible, sin prenda y con fondo transparente— pero a tamaño de pantalla.
 * La prenda no va aquí a propósito: al lado se enseña la foto del producto, y
 * repetirla dibujada encima confunde sobre qué es lo que se está imprimiendo.
 *
 * Se queda en un data URL y no en un Blob: viaja a la pantalla de pedido y se
 * pinta en un `<img>`, sin subirse a ningún lado.
 */
export function exportarMiniaturaDelArte(
	canvas: Canvas,
	areas: FabricObject[],
): string | null {
	const area = areas[0];
	if (!area) return null;

	const fondo = canvas.backgroundImage;
	const colorFondo = canvas.backgroundColor;
	const vista = canvas.viewportTransform;
	const visibles = areas.map((a) => a.visible);

	try {
		// Mismo motivo que en el arte de producción: el zoom es de quien diseña,
		// no de la imagen que se guarda.
		canvas.viewportTransform = [1, 0, 0, 1, 0, 0];

		canvas.backgroundImage = undefined;
		canvas.backgroundColor = "";
		for (const a of areas) a.visible = false;

		canvas.renderAll();

		const recorte = area.getBoundingRect();

		return canvas.toDataURL({
			format: "png",
			left: recorte.left,
			top: recorte.top,
			width: recorte.width,
			height: recorte.height,
			multiplier: Math.min(1, ANCHO_VISTA_PREVIA / (recorte.width || 1)),
		});
	} catch {
		// Sin miniatura se puede pedir igual; la pantalla enseña la foto del
		// producto. No vale la pena tumbar un pedido por una imagen chica.
		return null;
	} finally {
		canvas.backgroundImage = fondo;
		canvas.backgroundColor = colorFondo;
		if (vista) canvas.viewportTransform = vista;
		areas.forEach((a, i) => {
			a.visible = visibles[i];
		});
		canvas.renderAll();
	}
}

/**
 * La prenda CON el diseño encima. Es la referencia de colocación.
 *
 * Sirve a los dos lados y por motivos distintos:
 *
 * - al comprador, para confirmar cómo le va a quedar antes de pagar;
 * - al taller, para comprobar DÓNDE va antes de planchar. El archivo de
 *   producción va recortado al área imprimible y no dice nada de en qué parte
 *   de la prenda cae; con él solo, colocar es adivinar.
 *
 * Por eso aquí sí va el mockup y no se recorta nada. Lo que se quita son las
 * guías del área: son andamio del editor y no existen en la prenda.
 *
 * Devuelve el data URL —que se pinta directo— y el mismo contenido en binario
 * para subirlo. Sale de una sola exportación: hacer dos sería pagar el render
 * dos veces por la misma imagen.
 */
export function exportarColocacion(
	canvas: Canvas,
	areas: FabricObject[],
): { dataUrl: string; blob: Blob } | null {
	const vista = canvas.viewportTransform;
	const visibles = areas.map((a) => a.visible);

	try {
		// El zoom y el desplazamiento son de quien diseña, no de la imagen.
		canvas.viewportTransform = [1, 0, 0, 1, 0, 0];

		for (const a of areas) a.visible = false;

		canvas.renderAll();

		const dataUrl = canvas.toDataURL({
			format: "png",
			multiplier: Math.min(1, ANCHO_VISTA_PREVIA / (canvas.getWidth() || 1)),
		});

		return { dataUrl, blob: aBlob(dataUrl) };
	} catch {
		// Sin referencia de colocación se puede pedir igual; el taller tiene el
		// arte y la ficha. No vale la pena tumbar un pedido por una imagen.
		return null;
	} finally {
		if (vista) canvas.viewportTransform = vista;
		areas.forEach((a, i) => {
			a.visible = visibles[i];
		});
		canvas.renderAll();
	}
}

/**
 * Del data URL al binario, sin pasar por la red.
 *
 * `fetch(dataUrl).blob()` haría lo mismo en una línea, pero es asíncrono y
 * aquí hace falta que no lo sea.
 */
function aBlob(dataUrl: string): Blob {
	const base64 = dataUrl.split(",")[1] ?? "";
	const binario = atob(base64);
	const bytes = new Uint8Array(binario.length);

	for (let i = 0; i < binario.length; i++) {
		bytes[i] = binario.charCodeAt(i);
	}

	return new Blob([bytes], { type: "image/png" });
}
