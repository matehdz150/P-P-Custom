import type { ArticuloDeCarrito } from "@/lib/carrito/almacen";
import { tokenVigente } from "@/lib/auth/comprador";
import type { PedidoEnSeguimiento } from "./pedir";

/**
 * La API de la cuenta del comprador.
 *
 * Va DIRECTO a API Gateway, sin pasar por un route handler de Next: el permiso
 * lo lleva el token de la propia persona, no un secreto nuestro. Es el mismo
 * trato que `proveedores.ts`, y lo contrario de `admin.ts`, que sí necesita el
 * puente porque la llave del admin no puede entrar al bundle.
 */

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

export class ErrorCuenta extends Error {
	constructor(
		readonly status: number,
		mensaje: string,
	) {
		super(mensaje);
		this.name = "ErrorCuenta";
	}

	/** La sesión caducó o el correo no está verificado: hay que volver a entrar. */
	get hayQueEntrar() {
		return this.status === 401 || this.status === 403;
	}
}

async function pedir<T>(
	ruta: string,
	opciones: { metodo?: string; cuerpo?: unknown } = {},
): Promise<T> {
	const token = await tokenVigente();

	// Sin token no se hace la llamada: mandarla igual devolvería un 401 desde
	// AWS y se pagaría el viaje para enterarnos de algo que ya sabíamos.
	if (!token) throw new ErrorCuenta(401, "No has iniciado sesión");

	let res: Response;
	try {
		res = await fetch(`${API}${ruta}`, {
			method: opciones.metodo ?? "GET",
			headers: {
				authorization: `Bearer ${token}`,
				...(opciones.cuerpo ? { "content-type": "application/json" } : {}),
			},
			body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
		});
	} catch {
		throw new ErrorCuenta(0, "No pudimos conectar con el servidor");
	}

	if (!res.ok) {
		const dato = await res.json().catch(() => ({}));
		throw new ErrorCuenta(res.status, dato.message ?? `Error ${res.status}`);
	}

	return res.status === 204 ? (null as T) : await res.json();
}

/* ─── Pedidos ───────────────────────────────────────────────────────────── */

/**
 * Un pedido es el MISMO objeto se llegue por donde se llegue.
 *
 * Lo devuelven dos rutas —ésta con la sesión, y la pública con el token del
 * enlace— y las dos leen el mismo ítem de DynamoDB. Un segundo tipo aquí sólo
 * serviría para que las dos formas se separaran con el tiempo sin que nadie se
 * entere.
 */
export type { PedidoEnSeguimiento as PedidoDelComprador } from "./pedir";

export const ESTADOS_PEDIDO = {
	nuevo: { texto: "Recibido", tono: "lima" },
	produccion: { texto: "En producción", tono: "lavanda" },
	listo: { texto: "Listo", tono: "lima" },
	enviado: { texto: "En camino", tono: "lavanda" },
	entregado: { texto: "Entregado", tono: "gris" },
	cancelado: { texto: "Cancelado", tono: "rojo" },
} as const;

export const getMisPedidos = () =>
	pedir<PedidoEnSeguimiento[]>("/cuenta/pedidos");

/**
 * Un pedido propio, SIN el token del enlace.
 *
 * Es lo que hace que "Ver detalle" funcione desde el panel: la sesión ya dice
 * quién eres, y la Lambda comprueba que el pedido sea tuyo comparando el
 * correo. El token del correo sigue existiendo para quien pidió sin cuenta.
 */
export const getMiPedido = (id: string) =>
	pedir<PedidoEnSeguimiento>(`/cuenta/pedidos/${encodeURIComponent(id)}`);

/* ─── Perfil ────────────────────────────────────────────────────────────── */

export type Direccion = {
	calle: string;
	numero: string;
	interior: string | null;
	colonia: string;
	ciudad: string;
	estado: string;
	cp: string;
	referencias: string | null;
};

export type PerfilDelComprador = {
	id: string;
	nombre: string | null;
	whatsapp: string | null;
	direccion: Direccion | null;
	creadoEn: string | null;
};

/* ─── El carrito de quien tiene sesión ──────────────────────────────────
   Sin sesión el carrito vive sólo en el navegador; con ella se guarda además
   aquí para encontrarlo desde otro aparato. Al entrar se funden los dos. */

export const getCarritoDeLaCuenta = () =>
	pedir<{ articulos: ArticuloDeCarrito[] }>("/cuenta/carrito");

export const guardarCarritoEnLaCuenta = (articulos: ArticuloDeCarrito[]) =>
	pedir<{ articulos: ArticuloDeCarrito[] }>("/cuenta/carrito", {
		// PATCH y no PUT: la API Gateway declara una ruta por método y PUT no
		// está entre los suyos. Se guarda entero igual.
		metodo: "PATCH",
		cuerpo: { articulos },
	});

export const vaciarCarritoDeLaCuenta = () =>
	pedir<null>("/cuenta/carrito", { metodo: "DELETE" });

export const getMiPerfil = () => pedir<PerfilDelComprador>("/cuenta/perfil");

export const guardarMiPerfil = (perfil: {
	nombre: string;
	whatsapp?: string | null;
	direccion?: Partial<Direccion> | null;
}) =>
	pedir<PerfilDelComprador>("/cuenta/perfil", {
		metodo: "PATCH",
		cuerpo: perfil,
	});

/* ─── Diseños guardados ─────────────────────────────────────────────────── */

/**
 * Un diseño al que su dueño le puso nombre.
 *
 * Nace ascendiendo una línea de pedido, no desde el editor: así quien compra
 * una vez no ve un concepto nuevo, y quien repite lo tiene arriba.
 */
export type DisenoGuardado = {
	id: string;
	nombre: string;
	productoId: string;
	producto: string;
	colorPrenda: string | null;
	lados: string[];
	/** Ruta del JSON en S3. Es lo que abre el editor con `?diseno=`. */
	diseno: string;
	miniatura: string | null;
	origen: { pedidoId: string; lineaId: string };
	vecesPedido: number;
	ultimoPedido: string;
	creadoEn: string;
};

export const getMisDisenos = () => pedir<DisenoGuardado[]>("/cuenta/disenos");

export const guardarDiseno = (datos: {
	nombre: string;
	pedidoId: string;
	lineaId: string;
}) => pedir<DisenoGuardado>("/cuenta/disenos", { metodo: "POST", cuerpo: datos });

export const renombrarDiseno = (id: string, nombre: string) =>
	pedir<DisenoGuardado>(`/cuenta/disenos/${encodeURIComponent(id)}`, {
		metodo: "PATCH",
		cuerpo: { nombre },
	});

export const borrarDiseno = (id: string) =>
	pedir<{ borrado: true }>(`/cuenta/disenos/${encodeURIComponent(id)}`, {
		metodo: "DELETE",
	});

/** El enlace que abre un diseño en el editor, listo para volver a pedirlo. */
export function enlaceParaRediseñar(d: {
	productoId: string;
	diseno: string;
}) {
	return `/design/${encodeURIComponent(d.productoId)}?diseno=${encodeURIComponent(d.diseno)}`;
}

/* ─── Repetir un pedido ─────────────────────────────────────────────────── */

/**
 * Qué cambió desde que se hizo el pedido.
 *
 * Cuatro casos y cada uno se resuelve distinto: `igual` sigue, `precio` y
 * `plazo` avisan, y `no_disponible` OBLIGA a decidir. Es el único que no puede
 * pasar callando.
 */
export type LineaRepetida = {
	lineaId: string;
	productoId: string;
	producto: string;
	colorPrenda: string | null;
	lados: string[];
	tallas: { size: string; piezas: number }[];
	piezas: number;
	diseno: string | null;
	miniatura: string | null;
	estado: "igual" | "precio" | "plazo" | "no_disponible";
	porque: string | null;
	proveedorId: string | null;
	importe: number;
	importeAntes: number;
	unitario?: number;
	unitarioAntes?: number;
	dias: number | null;
	diasAntes: number | null;
};

export type PedidoRepetido = {
	pedidoId: string;
	folio: string | null;
	hechoEn: string | null;
	totalAntes: number;
	totalAhora: number;
	/** Cuántos talleres, para decir cuántos pedidos van a salir. */
	talleres: number;
	lineas: LineaRepetida[];
};

/**
 * NO crea nada: es una lectura y una diferencia. El pedido se sigue creando
 * por el camino de siempre, para que no existan dos sitios donde se decide un
 * precio.
 */
export const repetirPedido = (id: string) =>
	pedir<PedidoRepetido>(`/cuenta/pedidos/${encodeURIComponent(id)}/repetir`);

/**
 * Deja las líneas elegidas en el carrito.
 *
 * El arte NO pasa por aquí: la Lambda lo copia dentro de S3 y devuelve
 * artículos ya apuntando a su carpeta nueva. Por eso esto es rápido aunque la
 * repetición lleve cinco líneas de varios MB cada una.
 *
 * `descartadas` es lo que se cayó ENTRE que se miró la pantalla y se pulsó el
 * botón. Casi siempre viene vacío, pero cuando no, hay que decirlo: si no, se
 * agregan tres de cuatro líneas y nadie se entera hasta pagar.
 */
export const armarRepeticion = (id: string, lineas: string[]) =>
	pedir<{
		articulos: ArticuloRepetido[];
		descartadas: { producto: string; porque: string | null }[];
	}>(`/cuenta/pedidos/${encodeURIComponent(id)}/repetir`, {
		metodo: "POST",
		cuerpo: { lineas },
	});

/** Lo que devuelve la Lambda: un artículo sin `id` ni `agregadoEn`, que los
 *  pone el almacén del navegador al guardarlo. */
export type ArticuloRepetido = Omit<
	ArticuloDeCarrito,
	"id" | "agregadoEn" | "proveedorNombre"
> & { proveedorNombre?: string | null };
