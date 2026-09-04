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
	/**
	 * Cuánto de ese archivo es sangrado, por lado y en centímetros.
	 *
	 * Viaja hasta la ficha del taller para que reste antes de comparar: el
	 * archivo mide a propósito más que el área, y sin esto el aviso de "revisa
	 * el área de la plantilla" saltaría en cada pedido con sangrado.
	 */
	sangradoCm: number;
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
		//
		// EL MULTIPLICADOR SALE DEL ÁREA, NO DEL RECORTE CON SANGRADO. Es lo que
		// mantiene la escala: el estampado tiene que medir los centímetros
		// declarados; lo que crece es el archivo, no lo impreso.
		const multiplicador = anchoObjetivo / recorte.width;

		/* El sangrado, en píxeles del lienzo. Va pegado al objeto del área desde
		   `loadProductTemplate`, que es donde se supo a cuántos píxeles equivale
		   un centímetro en esta plantilla. */
		const sangradoPx =
			Number((area as { sangradoPx?: number }).sangradoPx ?? 0) || 0;

		const dataUrl = canvas.toDataURL({
			format: "png",
			left: recorte.left - sangradoPx,
			top: recorte.top - sangradoPx,
			width: recorte.width + sangradoPx * 2,
			height: recorte.height + sangradoPx * 2,
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
			anchoPx: Math.round((recorte.width + sangradoPx * 2) * multiplicador),
			altoPx: Math.round((recorte.height + sangradoPx * 2) * multiplicador),
			dpi,
			/* Se manda con el archivo para que la ficha del taller pueda restarlo
			   antes de comparar con lo declarado. Sin esto, un sangrado de 3 mm
			   dispara el aviso de "revisa el área de la plantilla" en cada pedido,
			   y un aviso que salta siempre se aprende a ignorar. */
			sangradoCm: (sangradoPx * medidas.widthCm) / recorte.width,
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
 * A qué ancho sale la referencia de colocación.
 *
 * ES MÁS QUE `ANCHO_VISTA_PREVIA` a propósito, y no comparten constante aunque
 * antes la compartían. La miniatura del arte se enseña pequeña y ya está; ésta
 * la mira el TALLER a pantalla completa para decidir dónde plancha, y la
 * enseñan además el carrito y el detalle del pedido. A 700 px se veía pixelada
 * en cuanto alguien la ampliaba o la abría en una pantalla retina.
 */
const ANCHO_COLOCACION = 1600;

/**
 * Cuánto se deja ampliar por encima del lienzo.
 *
 * El multiplicador de Fabric NO es un reescalado de bitmap: vuelve a
 * rasterizar la escena, así que el texto y las formas salen nítidos a 2×. Lo
 * que no mejora es el mockup, que ya es una imagen; por eso hay tope. Sin él,
 * un lienzo pequeño pediría un 4× que sólo interpola píxeles del mockup y
 * multiplica el peso del PNG por dieciséis.
 */
const AMPLIACION_MAXIMA = 2;

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
	const colorFondo = canvas.backgroundColor;

	try {
		// El zoom y el desplazamiento son de quien diseña, no de la imagen.
		canvas.viewportTransform = [1, 0, 0, 1, 0, 0];

		/* FONDO BLANCO, y no transparente como el arte de producción.

		   Aquí el PNG es una FOTO de cómo queda, no un archivo para imprimir.
		   Con alfa, cada quien le pone detrás lo que tenga: el gris de la ficha
		   del taller, el tablero de cuadros de un visor al descargarlo. La
		   miniatura del carrito ya se defendía sola rellenando blanco antes de
		   pasar a JPEG —que no tiene alfa y lo habría puesto negro—; ahora no
		   tiene que defenderse de nada.

		   El arte de producción sigue saliendo transparente; eso no se toca. */
		canvas.backgroundColor = "#ffffff";

		for (const a of areas) a.visible = false;

		canvas.renderAll();

		const dataUrl = canvas.toDataURL({
			format: "png",
			multiplier: Math.min(
				AMPLIACION_MAXIMA,
				ANCHO_COLOCACION / (canvas.getWidth() || 1),
			),
		});

		return { dataUrl, blob: aBlob(dataUrl) };
	} catch {
		// Sin referencia de colocación se puede pedir igual; el taller tiene el
		// arte y la ficha. No vale la pena tumbar un pedido por una imagen.
		return null;
	} finally {
		canvas.backgroundColor = colorFondo;
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
