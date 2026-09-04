/**
 * Cliente de la API de proveedores (la Lambda en AWS, detrás de Cognito).
 *
 * Va directo a API Gateway, sin puente de Next: aquí no hay ningún secreto
 * que esconder, el permiso lo lleva el propio token del proveedor. El
 * autorizador JWT valida firma y caducidad antes de invocar la función, así
 * que una petición sin token ni siquiera llega a ejecutar código nuestro.
 */

import { borrarSesion, tokenVigente } from "@/lib/auth/cognito";
import type { Category } from "./categories";
import type { ProductTemplate } from "./templates";

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

export class ErrorProveedor extends Error {
	constructor(
		readonly status: number,
		mensaje: string,
	) {
		super(mensaje);
		this.name = "ErrorProveedor";
	}

	/** No hay sesión, o ya no sirve. Quien lo cache debe mandar al login. */
	get sinSesion() {
		return this.status === 401 || this.status === 403;
	}
}

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
	const token = await tokenVigente();
	if (!token) throw new ErrorProveedor(401, "No hay sesión");

	const res = await fetch(`${API}${ruta}`, {
		...opciones,
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${token}`,
			...opciones?.headers,
		},
	});

	if (!res.ok) {
		// Un 401 desde el autorizador significa token muerto: se limpia para no
		// dejar al panel en el limbo de "hay sesión pero nada carga".
		if (res.status === 401) borrarSesion();

		const cuerpo = await res.json().catch(() => null);
		throw new ErrorProveedor(
			res.status,
			cuerpo?.message ?? `La API respondió ${res.status}`,
		);
	}

	return res.json();
}

/**
 * El mismo `pedir`, para los módulos del panel que viven en otro archivo
 * (hoy `pedidos.ts`). Se exporta la función y no se duplica el `fetch` para
 * que el manejo del token muerto —limpiar la sesión en un 401— siga estando
 * en un solo sitio.
 */
export const pedirComoProveedor = pedir;

/**
 * De dónde sale el paquete.
 *
 * No es perfil público: el CP decide el precio del envío y la dirección
 * entera se imprime en la guía que ve el comprador. `null` significa que el
 * taller no ha puesto ninguna, y entonces sus productos no se pueden cotizar.
 */
export type Recoleccion = {
	calle: string;
	numero: string;
	interior: string | null;
	colonia: string;
	ciudad: string;
	estado: string;
	cp: string;
	referencias: string | null;
};

export type Proveedor = {
	id: string;
	email: string;
	name: string | null;
	slug: string | null;
	displayName: string | null;
	bio: string | null;
	avatarUrl: string | null;
	bannerUrl: string | null;
	recoleccion?: Recoleccion | null;
	/**
	 * El teléfono con el que la paquetería localiza al taller para recoger.
	 * Sin él, Skydropx rechaza la compra de la guía con un 422 que no dice de
	 * quién falta el teléfono.
	 */
	whatsapp?: string | null;
	createdAt: string;
};

/** El perfil del proveedor que trae el token. Nunca el de otro. */
export function miPerfil() {
	return pedir<Proveedor>("/proveedores/yo");
}

export function actualizarMiPerfil(datos: {
	displayName?: string;
	bio?: string;
	avatarUrl?: string;
	bannerUrl?: string;
	/** `null` la borra: un taller puede dejar de ofrecer envío. */
	recoleccion?: Recoleccion | null;
	whatsapp?: string | null;
}) {
	return pedir<Proveedor>("/proveedores/yo", {
		method: "PATCH",
		body: JSON.stringify(datos),
	});
}

/* ─── El catálogo que necesita el asistente de alta ──────────────────────
   Las prendas base y las categorías las administra el admin, pero el taller
   las LEE por su propia API. Antes las pedía por `/api/admin/*`, o sea con
   la llave del admin puesta: eso funciona hoy sólo porque ese puente no
   exige sesión, y se rompería en cuanto el admin tenga login. */

export function plantillasParaAlta() {
	return pedir<ProductTemplate[]>("/proveedores/plantillas");
}

export function categoriasParaAlta() {
	return pedir<Category[]>("/proveedores/categorias");
}

/* ─── Los productos del taller ──────────────────────────────────────────── */

/**
 * Por dónde va un producto.
 *
 * El taller mueve entre `borrador`, `en_revision` y `archivado`; `activo` y
 * `rechazado` los pone el admin al revisar. Editar uno ya aprobado lo manda
 * de vuelta a revisión: la aprobación es del producto, no del momento.
 */
export type EstadoProducto =
	| "borrador"
	| "en_revision"
	| "activo"
	| "rechazado"
	| "archivado";

export const ETIQUETA_ESTADO_PRODUCTO: Record<EstadoProducto, string> = {
	borrador: "Borrador",
	en_revision: "En revisión",
	activo: "Publicado",
	rechazado: "Necesita cambios",
	archivado: "Archivado",
};

export type ProductoDeTaller = {
	id: string;
	slug: string;
	name: string;
	description?: string | null;
	sku?: string;
	templateId: string;
	categoryIds?: string[];
	images: { url: string; order: number }[];
	printSides: { sideKey: string; widthCm: number; heightCm: number }[];
	sizes: { size: string; widthIn: number; lengthIn: number }[];
	colors: { name: string; hex: string }[];
	pricing: { basePrice: number; [k: string]: number | undefined };
	estado: EstadoProducto;
	/** Por qué el admin lo regresó. Lo escribe él al rechazar. */
	notaRevision: string | null;
	/* ─── Existencias ────────────────────────────────────────────────────────
	   Las lleva todo producto. `existencias` va con la llave `color|talla`, o
	   sólo la talla si el producto no tiene colores capturados. Sigue siendo
	   opcional en el tipo porque los productos anteriores a esa regla pueden no
	   tener el mapa; los nuevos siempre lo escriben. */
	existencias?: Record<string, number>;
	minimoAlerta?: number;
	diasExtraSinStock?: number;
	/**
	 * Las fotos de la prenda real con su cuadro de impresión, por lado y color.
	 *
	 * Va declarado aunque el panel no lo pinte: el asistente lo lee al editar y
	 * lo vuelve a mandar entero. Sin el campo en el tipo, cualquiera que copie
	 * el producto campo por campo se lleva las fotos por delante sin enterarse
	 * —el PATCH manda la lista completa, así que omitirla es borrarla—.
	 */
	fotosReales?: {
		lado: string;
		color: string;
		url: string;
		esquinas: { x: number; y: number }[];
	}[];
	createdAt: string;
	updatedAt: string;
};

export function misProductos() {
	return pedir<ProductoDeTaller[]>("/proveedores/productos");
}

export function miProducto(id: string) {
	return pedir<ProductoDeTaller>(`/proveedores/productos/${id}`);
}

/**
 * Guarda un producto nuevo. `enviar` decide si va a revisión o se queda en
 * borrador; publicar no está en manos del taller.
 */
export function crearMiProducto(datos: Record<string, unknown>) {
	return pedir<{ id: string; slug: string; estado: EstadoProducto }>(
		"/proveedores/productos",
		{ method: "POST", body: JSON.stringify(datos) },
	);
}

export function actualizarMiProducto(
	id: string,
	datos: Record<string, unknown>,
) {
	return pedir<ProductoDeTaller>(`/proveedores/productos/${id}`, {
		method: "PATCH",
		body: JSON.stringify(datos),
	});
}

/**
 * Quita un producto, y la respuesta dice qué pasó de verdad.
 *
 * Un borrador se borra; cualquier otro se archiva, porque "volver a pedir" lee
 * el producto de hoy para decirle al comprador cuál de sus líneas se cayó. La
 * decisión la toma el servidor —el estado que ve el navegador puede estar
 * viejo—, así que la pantalla se entera por lo que devuelve, no por lo que
 * suponía antes de pulsar.
 */
export function borrarMiProducto(id: string) {
	return pedir<{ id: string; estado: "borrado" | "archivado" }>(
		`/proveedores/productos/${id}`,
		{ method: "DELETE" },
	);
}

export type OperacionExistencias = "agregar" | "quitar" | "corregir";

/**
 * Mueve las existencias de UNA variante.
 *
 * Va por su propia ruta y NO por `actualizarMiProducto`, por dos razones que
 * conviene no deshacer:
 *
 * - Ese PATCH devuelve a revisión cualquier producto activo, así que corregir
 *   un conteo despublicaría el producto. Las existencias no son contenido.
 * - El delta lo aplica DynamoDB. Mandando el mapa entero desde aquí, un pedido
 *   que descuente entre que leemos y escribimos se pierde sin dejar rastro.
 *
 * Devuelve el producto ya actualizado: la pantalla repinta con lo que quedó de
 * verdad, no con lo que creía que iba a quedar.
 */
export function moverExistencias(
	id: string,
	movimiento: {
		clave: string;
		operacion: OperacionExistencias;
		cantidad: number;
	},
) {
	return pedir<ProductoDeTaller>(`/proveedores/productos/${id}/existencias`, {
		method: "PATCH",
		body: JSON.stringify(movimiento),
	});
}

/**
 * Sube una foto de producto a S3 en dos pasos: la API firma el permiso y el
 * navegador hace PUT directo. El archivo no pasa por la Lambda.
 *
 * La carpeta la decide el token, no esta función: cada taller escribe sólo
 * bajo la suya. Devuelve la RUTA (`/medios/...`), que es lo que se guarda.
 */
export async function subirFotoDeProducto(file: File): Promise<string> {
	const permiso = await pedir<{ uploadUrl: string; path: string }>(
		"/proveedores/subidas/foto",
		{ method: "POST", body: JSON.stringify({ contentType: file.type }) },
	);

	const res = await fetch(permiso.uploadUrl, {
		method: "PUT",
		// Exactamente el tipo que se firmó, o S3 rechaza la firma.
		headers: { "Content-Type": file.type },
		body: file,
	});

	if (!res.ok) throw new Error(`S3 rechazó la subida (${res.status})`);

	return permiso.path;
}
