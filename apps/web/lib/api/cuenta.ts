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
