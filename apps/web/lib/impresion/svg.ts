"use client";

import type { Canvas, FabricObject } from "fabric";
import { esTexto, textoATrazos } from "./curvas";

/**
 * El arte de un lado como SVG, para las técnicas que piden trazos.
 *
 * ES EL GEMELO DE `exportarArteDeLado`, con otro formato: el mismo recorte al
 * área imprimible, el mismo sangrado y la misma medida física, pero en vectores
 * en vez de píxeles. Un láser no imprime, sigue un recorrido.
 *
 * NO HACE FALTA ESCONDER NADA, y por eso esto sí puede ser asíncrono mientras
 * que el PNG no. Aquél llama a `canvas.toDataURL`, que pinta la escena entera
 * —fondo incluido—, así que tiene que quitar el mockup y volver a ponerlo en el
 * mismo tick o el watcher de `useFabricMockup` lo repone a media exportación y
 * la prenda dibujada acaba dentro del archivo de producción. Aquí se recorren
 * los OBJETOS uno por uno: el mockup es `backgroundImage`, no es un objeto, y
 * no entra ni queriendo. Eso es lo que deja esperar a que carguen las fuentes.
 *
 * LAS MEDIDAS SON LAS MISMAS QUE LAS DEL PNG, a propósito: el archivo mide los
 * centímetros declarados más el sangrado, y el `viewBox` lleva las unidades del
 * lienzo. Así el taller abre el SVG y la pieza sale del tamaño que pidió, sin
 * escalar a ojo.
 */

export type ArteVectorial = {
	svg: string;
	blob: Blob;
	anchoCm: number;
	altoCm: number;
	sangradoCm: number;
	/**
	 * Los textos cuya fuente no se pudo leer y que van SIN convertir.
	 *
	 * No es un detalle: un `<text>` en el archivo es una letra que el taller no
	 * va a poder cortar. Sube hasta quien exporta para que pueda avisar en vez
	 * de mandar a producir un diseño incompleto.
	 */
	textosSinConvertir: number;
	/**
	 * Cuántas imágenes RÁSTER quedaron dentro.
	 *
	 * En un producto de grabado deberían ser cero: el editor vectoriza al
	 * agregar. Pero un diseño guardado ANTES de que eso existiera trae su
	 * `FabricImage`, y al exportarlo se colaría un `<image>` con la foto en
	 * base64 — un archivo que se ve bien y que la máquina no puede grabar. Sube
	 * para que se pueda avisar en vez de mandarlo a producir.
	 */
	imagenesSinTrazar: number;
};

/**
 * Mete las imágenes dentro del archivo.
 *
 * `toSVG()` de una imagen escribe la URL de donde salió —`/medios/…` o un
 * `blob:` del navegador—, y las dos se rompen igual: la primera obliga al
 * taller a tener conexión con nosotros para abrir un archivo que ya descargó, y
 * la segunda deja de existir en cuanto se cierra la pestaña. Un archivo de
 * producción tiene que valerse solo.
 *
 * Se hace sobre el marcado y no sobre el objeto porque cambiarle el `src` a una
 * `FabricImage` obliga a recargar su elemento, y eso es volver a esperar por
 * algo que ya está cargado.
 */
async function conImagenesDentro(marcado: string) {
	const enlaces = [...marcado.matchAll(/(xlink:href|href)="([^"]+)"/g)].filter(
		([, , url]) => url && !url.startsWith("data:"),
	);

	let salida = marcado;

	for (const [entero, atributo, url] of enlaces) {
		try {
			const blob = await (await fetch(url)).blob();
			const datos = await new Promise<string>((listo, falla) => {
				const lector = new FileReader();
				lector.onload = () => listo(String(lector.result));
				lector.onerror = () => falla(lector.error);
				lector.readAsDataURL(blob);
			});
			salida = salida.replace(entero, `${atributo}="${datos}"`);
		} catch {
			/* Si una imagen no se deja leer se queda su URL: el archivo sale
			   incompleto, que es malo, pero mejor que no salir. El taller ve el
			   hueco; un pedido caído no lo ve nadie hasta que reclaman. */
		}
	}

	return salida;
}

export async function exportarSvgDeLado(
	canvas: Canvas,
	areas: FabricObject[],
	medidas: { widthCm: number },
): Promise<ArteVectorial | null> {
	const area = areas[0];
	if (!area) return null;

	// Lo que no es área es diseño del cliente. Sin nada suyo no hay archivo.
	const objetos = canvas.getObjects().filter((o) => !areas.includes(o));
	if (objetos.length === 0) return null;

	const recorte = area.getBoundingRect();
	if (!(recorte.width > 0 && recorte.height > 0)) return null;

	const sangradoPx =
		Number((area as { sangradoPx?: number }).sangradoPx ?? 0) || 0;

	const x = recorte.left - sangradoPx;
	const y = recorte.top - sangradoPx;
	const ancho = recorte.width + sangradoPx * 2;
	const alto = recorte.height + sangradoPx * 2;

	/* El centímetro por píxel del lienzo sale del ÁREA, no del recorte: lo
	   impreso tiene que medir lo declarado y lo que crece es el archivo. Misma
	   regla que el multiplicador del PNG. */
	const cmPorPx = medidas.widthCm / recorte.width;

	let textosSinConvertir = 0;
	let imagenesSinTrazar = 0;
	const partes: string[] = [];

	for (const objeto of objetos) {
		if (esTexto(objeto)) {
			const trazos = await textoATrazos(objeto);
			if (trazos === null) {
				/* La fuente no se pudo leer. Se deja el `<text>` de Fabric antes que
				   perder la palabra, y se cuenta para poder avisar. */
				textosSinConvertir++;
				partes.push(objeto.toSVG());
			} else {
				partes.push(trazos);
			}
			continue;
		}

		// `image` es el tipo de una `FabricImage`. Ver el comentario del campo.
		if (
			typeof (objeto as { isType?: (t: string) => boolean }).isType ===
				"function" &&
			(objeto as { isType: (t: string) => boolean }).isType("image")
		) {
			imagenesSinTrazar++;
		}

		partes.push(objeto.toSVG());
	}

	const cuerpo = await conImagenesDentro(partes.join("\n"));

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${(ancho * cmPorPx).toFixed(4)}cm" height="${(alto * cmPorPx).toFixed(4)}cm" viewBox="${x.toFixed(4)} ${y.toFixed(4)} ${ancho.toFixed(4)} ${alto.toFixed(4)}">
${cuerpo}
</svg>`;

	return {
		svg,
		blob: new Blob([svg], { type: "image/svg+xml" }),
		anchoCm: ancho * cmPorPx,
		altoCm: alto * cmPorPx,
		sangradoCm: sangradoPx * cmPorPx,
		textosSinConvertir,
		imagenesSinTrazar,
	};
}
