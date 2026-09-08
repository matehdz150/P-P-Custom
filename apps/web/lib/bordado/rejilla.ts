"use client";

import type { Rejilla } from "@kustto/bordado";

/**
 * Pasar de lo que hay en el editor a una máscara medible en milímetros.
 *
 * TODO EL BORDADO SE DECIDE SOBRE UNA MÁSCARA, venga de un texto convertido a
 * curvas o de un PNG. Es lo que permite que "asta demasiado fina" signifique lo
 * mismo en los dos casos, y lo que hace que las reglas se puedan probar en node
 * sin un navegador delante.
 *
 * LA RESOLUCIÓN NO ES UN DETALLE. El asta más fina que el perfil admite mide
 * 1.2 mm; si se rasterizara a 0.2 mm/px serían seis píxeles de ancho y la
 * transformada de distancia daría un grosor con un 17 % de error, que es la
 * diferencia entre satin y relleno. A 0.05 mm/px son 24 px y el error baja al
 * 4 %. El tope de píxeles está para que un área grande no reviente la pestaña.
 */

const MM_POR_PX_OBJETIVO = 0.05;
const PIXELES_MAXIMOS = 6_000_000;

/* Un borde de fondo alrededor del dibujo. La transformada de distancia trata lo
   que hay fuera de la rejilla como fondo, así que una forma pegada al borde se
   mediría como si estuviera cortada; con el margen eso no puede pasar. */
const MARGEN_PX = 2;

export type Lienzo = {
	ctx: OffscreenCanvasRenderingContext2D;
	ancho: number;
	alto: number;
	mmPorPx: number;
	/** Cuánto hay que restar a las coordenadas para volver al origen del área. */
	desplazamientoMm: number;
};

export function lienzoEnMm(anchoMm: number, altoMm: number): Lienzo {
	const escala = Math.min(
		1,
		Math.sqrt(
			PIXELES_MAXIMOS /
				((anchoMm / MM_POR_PX_OBJETIVO) * (altoMm / MM_POR_PX_OBJETIVO)),
		),
	);
	const mmPorPx = MM_POR_PX_OBJETIVO / escala;

	const ancho = Math.max(4, Math.ceil(anchoMm / mmPorPx) + MARGEN_PX * 2);
	const alto = Math.max(4, Math.ceil(altoMm / mmPorPx) + MARGEN_PX * 2);

	const lienzo = new OffscreenCanvas(ancho, alto);
	const ctx = lienzo.getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("No pudimos preparar el lienzo de bordado");

	// El dibujo se hace en MILÍMETROS: la escala y el margen quedan puestos aquí
	// y quien pinte no vuelve a pensar en píxeles.
	ctx.setTransform(1 / mmPorPx, 0, 0, 1 / mmPorPx, MARGEN_PX, MARGEN_PX);

	return {
		ctx,
		ancho,
		alto,
		mmPorPx,
		desplazamientoMm: MARGEN_PX * mmPorPx,
	};
}

/**
 * La máscara de lo que se pintó.
 *
 * El umbral va sobre el ALFA y no sobre el color: quien pinta ya decidió qué es
 * diseño, aquí sólo se recoge. El 128 deja el antialias del canvas repartido a
 * medias, que es lo que menos engorda y menos adelgaza los trazos.
 */
export function aRejilla(lienzo: Lienzo, umbralAlfa = 128): Rejilla {
	const imagen = lienzo.ctx.getImageData(0, 0, lienzo.ancho, lienzo.alto);
	const datos = new Uint8Array(lienzo.ancho * lienzo.alto);
	for (let i = 0; i < datos.length; i++) {
		datos[i] = imagen.data[i * 4 + 3] >= umbralAlfa ? 1 : 0;
	}
	return {
		datos,
		ancho: lienzo.ancho,
		alto: lienzo.alto,
		mmPorPx: lienzo.mmPorPx,
	};
}

/** Una rejilla vacía con la misma forma y escala que otra. */
export function comoLa(rejilla: Rejilla, datos: Uint8Array): Rejilla {
	return {
		datos,
		ancho: rejilla.ancho,
		alto: rejilla.alto,
		mmPorPx: rejilla.mmPorPx,
	};
}
