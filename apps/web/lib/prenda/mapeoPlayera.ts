export type RectDeVista = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export const LADOS_PLAYERA_3D = [
	"front",
	"back",
	"leftmanga",
	"rightmanga",
] as const;
export type MedidaPlayera = {
	sideKey: string;
	widthCm: number;
	heightCm: number;
};

/** La manga izquierda es la izquierda de QUIEN VISTE la prenda (+X vista
 * de frente). Anclajes del modelo, no de la foto seleccionada. La escala usa
 * los centímetros de impresión y el raster completo conserva sus márgenes. */
export function colocacionManga(
	lado: "leftmanga" | "rightmanga",
	proporcion: number,
	frente: RectDeVista | undefined,
	medidas: readonly MedidaPlayera[],
) {
	const frontal = medidas.find((m) => m.sideKey === "front");
	const manga = medidas.find((m) => m.sideKey === lado);
	if (
		!frente ||
		!frontal ||
		!manga ||
		!Number.isFinite(proporcion) ||
		proporcion <= 0 ||
		!Number.isFinite(frontal.widthCm + manga.widthCm) ||
		frontal.widthCm <= 0 ||
		manga.widthCm <= 0
	)
		return null;
	const width = (frente.width * manga.widthCm) / frontal.widthCm;
	const height = (width * PLAYERA.ancho) / PLAYERA.alto / proporcion;
	const izquierda = lado === "leftmanga";
	/* Centro de cada manga EN EL CONTORNO NUEVO. Los anclajes viejos
	   —0.164 / 0.821 a la altura 0.32— eran los de la prenda tendida; al
	   inclinar las mangas el arte se quedaba pegado al hombro y medio fuera
	   de la tela. La manga izquierda va ahora de 0.095 a 0.262 (centro 0.18) y
	   de 0.186 a 0.487 de alto (centro 0.34). */
	return {
		left: (izquierda ? 0.805 : 0.18) - width / 2,
		top: 0.34 - height / 2,
		width,
		height,
		giro: ((izquierda ? 1 : -1) * Math.PI) / 7,
	};
}

/** Coordenadas en el mockup COMPLETO, no bounding box de la tinta.
 * Los márgenes y el aspect ratio del área se conservan sin contain/cover.
 * No depende de la foto seleccionada, su perspectiva ni el color. */
export function areaEnMockup(
	area: RectDeVista,
	mockup: RectDeVista,
): RectDeVista | null {
	if (
		![...Object.values(area), ...Object.values(mockup)].every(
			Number.isFinite,
		) ||
		area.width <= 0 ||
		area.height <= 0 ||
		mockup.width <= 0 ||
		mockup.height <= 0
	)
		return null;
	return {
		left: (area.left - mockup.left) / mockup.width,
		top: (area.top - mockup.top) / mockup.height,
		width: area.width / mockup.width,
		height: area.height / mockup.height,
	};
}

/**
 * Perfil de manga corta. Coordenadas normalizadas: no son medidas de talla.
 *
 * PUESTA, NO TENDIDA. El trazo salía de `tshirtfront.png`, que es la prenda
 * extendida sobre una mesa: mangas horizontales y cuerpo abierto en T. Con
 * volumen eso se veía como un espantapájaros, porque una playera sobre un
 * cuerpo cae — las mangas bajan y los costados se meten. Las mangas se
 * inclinaron y el bajo se estrechó; el cuello y el ancho de pecho no se
 * tocaron, que son los que anclan dónde cae el arte.
 *
 * Doce puntos, ni uno más: `unionesPlayera` salta los índices 2, 5 y 8 para
 * dejar abiertas las bocamangas y el bajo, así que cambiar la cantidad
 * taparía huecos que tienen que estar.
 */
export const PLAYERA = {
	ancho: 1.2,
	alto: (1.2 * 1984) / 2144,
	cuelloIzquierdo: [0.404, 0.126],
	cuelloDerecho: [0.582, 0.126],
	contorno: [
		[0.404, 0.126],
		[0.262, 0.186],
		[0.095, 0.338],
		[0.185, 0.487],
		[0.253, 0.412],
		[0.246, 0.878],
		[0.74, 0.878],
		[0.733, 0.412],
		[0.8, 0.487],
		[0.89, 0.338],
		[0.722, 0.186],
		[0.582, 0.126],
	],
} as const;

/**
 * Dónde está la PRENDA dentro del dibujo del mockup.
 *
 * Las áreas de impresión llegan normalizadas al mockup ENTERO —eso hace
 * `areaEnMockup`—, pero el modelo 3D está escalado a su propio contorno. Sin
 * traducir de un espacio al otro, el arte sale más pequeño y corrido: la
 * prenda ocupa el 79 % del ancho del dibujo, así que todo aparecía a ese
 * tamaño en vez de al suyo.
 *
 * Se calcula del contorno y no a mano: si alguien mueve un punto del trazo,
 * esto se mueve con él.
 */
function cajaDe(puntos: readonly (readonly number[])[]) {
	const us = puntos.map((p) => p[0]);
	const vs = puntos.map((p) => p[1]);
	return {
		u0: Math.min(...us),
		u1: Math.max(...us),
		v0: Math.min(...vs),
		v1: Math.max(...vs),
	};
}

export const CAJA_PRENDA = cajaDe(PLAYERA.contorno);

/** Y dónde está cada manga, por si el arte de manga tiene que caer en el
 *  mismo sitio relativo que en el dibujo. La manga izquierda es la de quien
 *  viste: en el dibujo, visto de frente, cae a la DERECHA de la imagen. */
export const CAJA_MANGA = {
	leftmanga: cajaDe(PLAYERA.contorno.filter((p) => p[0] > 0.7)),
	rightmanga: cajaDe(PLAYERA.contorno.filter((p) => p[0] < 0.3)),
} as const;

/** Pasa un rectángulo de coordenadas del MOCKUP a coordenadas de una caja:
 *  qué fracción de esa caja ocupa y en qué punto de ella empieza. */
export function relativoA(
	r: RectDeVista,
	caja: { u0: number; u1: number; v0: number; v1: number },
): RectDeVista {
	const anchoCaja = caja.u1 - caja.u0;
	const altoCaja = caja.v1 - caja.v0;
	return {
		left: (r.left - caja.u0) / anchoCaja,
		top: (r.top - caja.v0) / altoCaja,
		width: r.width / anchoCaja,
		height: r.height / altoCaja,
	};
}

export function puntoPlayera(u: number, v: number, espalda = false) {
	return {
		x: (espalda ? 0.5 - u : u - 0.5) * PLAYERA.ancho,
		y: (0.5 - v) * PLAYERA.alto,
	};
}

export function esPlayera3D(product: {
	name: string;
	sides: string[];
	forma?: string;
}) {
	return (
		product.forma !== "cilindro" &&
		product.forma !== "cono" &&
		product.sides.includes("front") &&
		product.sides.includes("back") &&
		product.sides.every((side) =>
			(LADOS_PLAYERA_3D as readonly string[]).includes(side),
		) &&
		/\b(playeras?|camisetas?|t[ -]?shirts?)\b/i.test(product.name)
	);
}
