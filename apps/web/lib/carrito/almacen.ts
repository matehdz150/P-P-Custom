"use client";

/**
 * El carrito.
 *
 * QUÉ GUARDA, Y POR QUÉ TAN POCO. Sólo rutas, cantidades y una miniatura
 * diminuta. El arte de verdad ya está en S3 desde que se agregó —bajo
 * `carritos/<carritoId>/`— porque un PNG de producción son varios MB y aquí no
 * caben: `localStorage` da unos 5 MB para todo el sitio.
 *
 * DÓNDE VIVE. Sin sesión, en el navegador. Con sesión, además en la cuenta,
 * para encontrarlo desde otro aparato. Al entrar se funden los dos, y gana la
 * unión: quien puso algo sin haber entrado no lo pierde por identificarse.
 */

const LLAVE = "kustto.carrito";

/** Un carrito no es un almacén; el backend rechaza más de 30. */
export const MAXIMO_ARTICULOS = 30;

export type LadoDeArticulo = {
	lado: string;
	anchoPx: number;
	altoPx: number;
	dpi: number;
};

export type ArticuloDeCarrito = {
	/** Identifica la línea dentro del carrito. No sale de aquí. */
	id: string;
	/** Dónde está su arte en S3. Es lo que se manda al pedir. */
	carritoId: string;
	productoId: string;
	nombre: string;
	/** Con qué taller se produce: es lo que parte la compra en pedidos. */
	proveedorId: string;
	proveedorNombre: string | null;
	colorPrenda: string | null;
	lados: LadoDeArticulo[];
	tallas: { size: string; piezas: number }[];
	/** Para el resumen mientras decide. El precio que se cobra lo pone la API. */
	precioUnitario: number;
	/** La prenda con el diseño, muy reducida. Ver `miniaturaPequena`. */
	miniatura: string | null;
	agregadoEn: number;
};

export function piezasDe(articulo: ArticuloDeCarrito): number {
	return articulo.tallas.reduce((n, t) => n + (t.piezas || 0), 0);
}

export function importeDe(articulo: ArticuloDeCarrito): number {
	return piezasDe(articulo) * articulo.precioUnitario;
}

/** Los talleres distintos que hay dentro. Con más de uno, la compra se parte. */
export function talleresDe(articulos: ArticuloDeCarrito[]): string[] {
	return [...new Set(articulos.map((a) => a.proveedorId))];
}

export function leerLocal(): ArticuloDeCarrito[] {
	if (typeof window === "undefined") return [];

	try {
		const crudo = localStorage.getItem(LLAVE);
		const lista = crudo ? JSON.parse(crudo) : [];
		return Array.isArray(lista) ? lista : [];
	} catch {
		// Un carrito ilegible no debe tumbar la tienda: se empieza de cero.
		return [];
	}
}

export function guardarLocal(articulos: ArticuloDeCarrito[]): void {
	if (typeof window === "undefined") return;

	try {
		localStorage.setItem(LLAVE, JSON.stringify(articulos));
	} catch {
		/* Se quedó sin espacio. No se puede hacer gran cosa aquí: el artículo ya
		   está subido a S3 y lo que se pierde es la referencia local. Se avisa en
		   la consola en vez de romper la pantalla. */
		console.warn(
			"No cupo el carrito en el navegador. Entra a tu cuenta para guardarlo.",
		);
	}
}

/**
 * Junta el carrito del navegador con el de la cuenta.
 *
 * Gana la UNIÓN, no el más nuevo: quien agregó algo antes de entrar no debería
 * perderlo por identificarse, y quien lo agregó desde el teléfono tampoco.
 *
 * Se deduplica por `carritoId`, que es lo único de verdad único: identifica un
 * arte concreto ya subido. Dos artículos del mismo producto con diseños
 * distintos son cosas distintas y deben convivir.
 */
export function fundir(
	local: ArticuloDeCarrito[],
	remoto: ArticuloDeCarrito[],
): ArticuloDeCarrito[] {
	const porArte = new Map<string, ArticuloDeCarrito>();

	for (const articulo of [...remoto, ...local]) {
		const anterior = porArte.get(articulo.carritoId);

		// Si está en los dos, se conserva el que se tocó más tarde: es el que
		// tiene las cantidades que la persona eligió al final.
		if (!anterior || articulo.agregadoEn > anterior.agregadoEn) {
			porArte.set(articulo.carritoId, articulo);
		}
	}

	return [...porArte.values()].sort((a, b) => a.agregadoEn - b.agregadoEn);
}

/**
 * La miniatura, muy reducida.
 *
 * La que sale del editor mide 700 px y pesa cientos de KB en base64. Con
 * cuatro artículos eso ya roza el cupo de `localStorage`, y sólo sirve para
 * reconocer el diseño en una lista: 240 px en JPEG bastan y ocupan una
 * fracción.
 */
export async function miniaturaPequena(
	dataUrl: string | null,
	ancho = 240,
): Promise<string | null> {
	if (!dataUrl || typeof window === "undefined") return null;

	try {
		const img = new Image();
		img.src = dataUrl;
		await img.decode();

		const escala = Math.min(1, ancho / (img.width || ancho));
		const lienzo = document.createElement("canvas");
		lienzo.width = Math.round(img.width * escala);
		lienzo.height = Math.round(img.height * escala);

		const ctx = lienzo.getContext("2d");
		if (!ctx) return null;

		// Fondo blanco: la colocación lleva transparencia y en JPEG saldría negra.
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, lienzo.width, lienzo.height);
		ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

		return lienzo.toDataURL("image/jpeg", 0.7);
	} catch {
		// Sin miniatura se puede pedir igual: la lista enseña el nombre.
		return null;
	}
}
