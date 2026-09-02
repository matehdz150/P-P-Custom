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
	anchoPx: number;
	altoPx: number;
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
		const altoObjetivo = Math.round((medidas.heightCm / PULGADA_EN_CM) * dpi);

		// El área en pantalla mide lo que mide; el multiplicador la lleva a los
		// píxeles que pidió el taller. Sin esto, el archivo saldría del tamaño
		// del lienzo del navegador, que no imprime nada decente.
		const multiplicador = anchoObjetivo / recorte.width;

		const dataUrl = canvas.toDataURL({
			format: "png",
			left: recorte.left,
			top: recorte.top,
			width: recorte.width,
			height: recorte.height,
			multiplier: multiplicador,
		});

		return {
			lado,
			blob: aBlob(dataUrl),
			anchoPx: anchoObjetivo,
			altoPx: altoObjetivo,
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
