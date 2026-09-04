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
	/**
	 * Cuánto de ese archivo es sangrado, por lado y en cm.
	 *
	 * Viaja hasta la ficha del taller, que lo RESTA antes de comparar con lo
	 * declarado: el archivo mide a propósito más que el área, y sin esto el
	 * aviso de "revisa el área de la plantilla" saltaría en cada pedido.
	 */
	sangradoCm?: number;
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

/**
 * Lo que escucha la cabecera para saber cuántos artículos hay.
 *
 * `storage` sólo avisa a las OTRAS pestañas, nunca a la que escribió. Sin este
 * aviso propio, agregar algo desde el editor no movería el contador hasta
 * recargar — justo en el momento en que la persona espera verlo cambiar.
 */
export const EVENTO_CARRITO = "kustto:carrito";

export function guardarLocal(articulos: ArticuloDeCarrito[]): void {
	if (typeof window === "undefined") return;

	try {
		localStorage.setItem(LLAVE, JSON.stringify(articulos));
		window.dispatchEvent(new Event(EVENTO_CARRITO));
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
 * La miniatura, reducida.
 *
 * La que sale del editor mide 700 px y pesa cientos de KB en base64: con unos
 * pocos artículos llena el cupo de `localStorage`, que son unos 5 MB para todo
 * el sitio. Por eso se reduce.
 *
 * **480 px, y no 240.** Estuvo en 240 mientras el carrito la enseñaba a 96 px,
 * donde daba justo. La pantalla nueva la enseña a 132 px —porque el diseño es
 * lo que la persona reconoce— y en un aparato retina eso son 264 px reales, o
 * 396 en uno de 3×: a 240 se estaba AMPLIANDO, y se veía sucia.
 *
 * Lo que cuesta, medido sobre un mockup real del proyecto y con el tope de
 * `MAXIMO_ARTICULOS`:
 *
 *   240 px · 0.70 →  6.9 KB en base64 → 0.20 MB el carrito lleno
 *   480 px · 0.82 → 22.5 KB en base64 → 0.66 MB el carrito lleno
 *
 * O sea que sube a un 13% del cupo en el peor caso. Si algún día hace falta
 * más nitidez que ésta, la salida NO es subir el número —el base64 crece con
 * el cuadrado del ancho— sino servir la colocación que ya está en S3 bajo
 * `carritos/…`, que hoy no se publica por CloudFront.
 */
export async function miniaturaPequena(
	dataUrl: string | null,
	ancho = 480,
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

		// El reescalado por defecto del navegador deja bordes sucios al bajar de
		// 700 px; esto no cuesta nada y es la diferencia entre un diseño legible
		// y uno que parece mal exportado.
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";

		// Fondo blanco por si acaso. La colocación ya sale con el suyo desde
		// `exportarColocacion`, pero una miniatura vieja —o una imagen que llegue
		// por otro camino— puede traer alfa, y en JPEG saldría negra.
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, lienzo.width, lienzo.height);
		ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

		return lienzo.toDataURL("image/jpeg", 0.82);
	} catch {
		// Sin miniatura se puede pedir igual: la lista enseña el nombre.
		return null;
	}
}
