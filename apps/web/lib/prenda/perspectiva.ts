/**
 * Proyectar un rectángulo sobre cuatro esquinas cualesquiera.
 *
 * POR QUÉ NO BASTA CON ESTIRAR. Sobre una foto de verdad la prenda cae, el
 * torso va en ángulo y el cuadro impreso no es un rectángulo: es un
 * cuadrilátero. Un `scale` o un `skew` —que es todo lo que da una transformada
 * afín— no puede llevar un rectángulo a cuatro puntos libres; hace falta una
 * homografía, y para eso están las dos filas de `matrix3d` que CSS reserva a la
 * perspectiva.
 *
 * PARA MIRAR ES CSS; PARA GUARDAR, `componer.ts`. `canvas` 2D sólo sabe
 * transformadas afines, así que rasterizar esto pide recorrer los píxeles del
 * destino a mano —eso hace el otro archivo—. En pantalla no hace falta: la
 * proyección cabe en las dos filas que `matrix3d` reserva a la perspectiva y la
 * hace la GPU, sin bibliotecas y sin coste por fotograma.
 *
 * La fórmula es la del mapeo del cuadrado unidad a un cuadrilátero (Heckbert,
 * "Projective Mappings for Image Warping"): se resuelven los dos coeficientes
 * de perspectiva y de ahí salen los seis afines.
 */

export type Punto = { x: number; y: number };

/** Los ocho coeficientes que llevan el cuadrado unidad a las cuatro esquinas. */
export type Coeficientes = {
	a: number;
	b: number;
	c: number;
	d: number;
	e: number;
	f: number;
	g: number;
	h: number;
};

/**
 * Resuelve la homografía del cuadrado unidad al cuadrilátero.
 *
 * Vive aparte de `matrizDeEsquinas` porque la necesitan dos caminos: pintar
 * —que la convierte en `matrix3d` y deja el trabajo al navegador— y RASTERIZAR,
 * que la tiene que invertir para recorrer los píxeles del destino. Con dos
 * copias, una de las dos se quedaría atrás.
 */
export function coeficientes(esquinas: Punto[]): Coeficientes | null {
	if (esquinas.length !== 4) return null;

	const [p0, p1, p2, p3] = esquinas;
	if (![p0, p1, p2, p3].every((p) => Number.isFinite(p?.x + p?.y))) return null;

	// Cuánto se aparta el cuadrilátero de un paralelogramo. Si los dos son cero,
	// no hay perspectiva que resolver y el mapeo es afín.
	const sx = p0.x - p1.x + p2.x - p3.x;
	const sy = p0.y - p1.y + p2.y - p3.y;

	if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
		const a = p1.x - p0.x;
		const b = p3.x - p0.x;
		const d = p1.y - p0.y;
		const e = p3.y - p0.y;

		/* Área cero: las cuatro esquinas encima de la misma, o los dos lados
		   sobre la misma recta. Es un paralelogramo perfecto según la prueba de
		   arriba y aun así no hay transformada. */
		if (Math.abs(a * e - b * d) < 1e-9) return null;

		return { a, b, c: p0.x, d, e, f: p0.y, g: 0, h: 0 };
	}

	const dx1 = p1.x - p2.x;
	const dx2 = p3.x - p2.x;
	const dy1 = p1.y - p2.y;
	const dy2 = p3.y - p2.y;

	const den = dx1 * dy2 - dx2 * dy1;
	// Determinante cero: los lados son paralelos hasta el límite de la
	// precisión, o dos esquinas coinciden. No hay homografía.
	if (Math.abs(den) < 1e-9) return null;

	const g = (sx * dy2 - dx2 * sy) / den;
	const h = (dx1 * sy - sx * dy1) / den;

	return {
		a: p1.x - p0.x + g * p1.x,
		b: p3.x - p0.x + h * p3.x,
		c: p0.x,
		d: p1.y - p0.y + g * p1.y,
		e: p3.y - p0.y + h * p3.y,
		f: p0.y,
		g,
		h,
	};
}

/**
 * La matriz CSS que lleva la caja de un elemento de `ancho × alto` a las cuatro
 * esquinas dadas, en píxeles y en el orden arriba-izquierda, arriba-derecha,
 * abajo-derecha, abajo-izquierda.
 *
 * Devuelve `null` si el cuadrilátero es degenerado —tres puntos en línea, o dos
 * encima del otro—: ahí el sistema no tiene solución y forzarlo pinta una
 * mancha. Quien llame decide qué enseñar en ese caso.
 *
 * Pide `transform-origin: 0 0` en el elemento. Con el origen al centro, que es
 * lo que CSS hace por defecto, el resultado sale desplazado media caja.
 */
export function matrizDeEsquinas(
	esquinas: Punto[],
	ancho: number,
	alto: number,
): string | null {
	if (ancho <= 0 || alto <= 0) return null;

	const k = coeficientes(esquinas);
	if (!k) return null;

	/* Los coeficientes llevan el cuadrado UNIDAD a las esquinas, y el elemento
	   mide `ancho × alto`: dividir por sus lados es meter esa escala dentro de
	   la misma matriz, en vez de encadenar otra transformada. */
	const m = [
		k.a / ancho,
		k.d / ancho,
		0,
		k.g / ancho,
		k.b / alto,
		k.e / alto,
		0,
		k.h / alto,
		0,
		0,
		1,
		0,
		k.c,
		k.f,
		0,
		1,
	];

	if (!m.every(Number.isFinite)) return null;

	/* Cifras SIGNIFICATIVAS, no decimales fijos. Los dos coeficientes de
	   perspectiva son del orden de 1e-5, así que redondearlos a seis decimales
	   les mete un error relativo de varios por ciento; se dividen por el
	   denominador y las esquinas acababan a cuatro centésimas de píxel de su
	   sitio. Se ve poco, pero era un error nuestro y no del navegador. */
	return `matrix3d(${m.map((n) => Number(n.toPrecision(12))).join(", ")})`;
}

/**
 * Cómo mezclar la tinta con la tela.
 *
 * `multiply` es lo que hace que el estampado se vea IMPRESO y no pegado: deja
 * pasar los pliegues y las sombras de la foto. Pero multiplicar por blanco no
 * cambia nada, así que sobre una prenda oscura la tinta clara desaparecería —
 * justo el caso más común, un logo blanco sobre negro.
 *
 * Así que se decide por la luminancia del color declarado: tela clara,
 * `multiply`; tela oscura, encima y sin mezclar. Se pierde textura en las
 * oscuras, y es preferible a perder el diseño entero.
 */
export function mezclaParaColor(hex: string | null | undefined) {
	return luminancia(hex) > 0.5 ? "multiply" : "normal";
}

/**
 * Sin color reconocible devuelve 0, o sea "trátala como oscura".
 *
 * Es la caída segura: dando por hecho que es clara se elegiría `multiply`, y
 * si la prenda resulta ser negra el diseño se vuelve invisible. Al revés sólo
 * se pierde textura.
 */
function luminancia(hex: string | null | undefined) {
	const limpio = (hex ?? "").trim().replace("#", "");
	if (limpio.length !== 3 && limpio.length !== 6) return 0;

	const ancho =
		limpio.length === 3
			? limpio
					.split("")
					.map((c) => c + c)
					.join("")
			: limpio;

	const n = Number.parseInt(ancho, 16);
	if (!Number.isFinite(n)) return 0;

	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;

	// Luminancia percibida, la misma ponderación que usa el recorte del mockup.
	return r * 0.299 + g * 0.587 + b * 0.114;
}
