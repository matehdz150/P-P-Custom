import { tokenVigente } from "@/lib/auth/comprador";

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

export type DireccionDeEvento = {
	calle: string;
	numero: string;
	interior?: string | null;
	colonia: string;
	ciudad: string;
	estado: string;
	cp: string;
	referencias?: string | null;
};

export type ProductoDeEvento = {
	id: string;
	productoId: string;
	nombre: string;
	imagen: string | null;
	proveedorId: string;
	precioDesde: number;
	colores: { nombre: string; hex?: string | null }[];
	tallas: string[];
	disenoBase: { arteId: string; ruta: string } | null;
	personalizacion: "libre" | "bloqueada" | "sin_personalizacion";
};

export type ParticipacionDeEvento = {
	id: string;
	participante: { nombre: string; email: string; whatsapp: string | null };
	lineas: {
		id: string;
		producto: string;
		talla: string;
		color: string | null;
		piezas: number;
		unitario: number;
		total: number;
		diseno:
			| { carritoId: string; ruta: string }
			| { arteId: string; ruta: string }
			| null;
	}[];
	subtotal: number;
	estadoPago: "pendiente" | "pagado" | "fallido" | "reembolsado";
	creadaEn: string;
};

export type Evento = {
	id: string;
	codigo: string;
	nombre: string;
	descripcion: string | null;
	/** Ruta relativa bajo `/medios/eventos/…`, nunca una URL de otro origen. */
	imagen: string | null;
	estado: "borrador" | "publicado" | "cerrado" | "cancelado";
	abreEn: string;
	cierraEn: string;
	direccion: DireccionDeEvento;
	productos: ProductoDeEvento[];
	creadoEn: string;
	actualizadoEn: string;
	participaciones?: ParticipacionDeEvento[];
};

export type EventoPublico = Omit<
	Evento,
	"direccion" | "estado" | "creadoEn" | "actualizadoEn"
> & {
	estado: "proximamente" | "abierto" | "cerrado" | "cancelado";
	entrega: { ciudad: string; estado: string };
};

export type DatosDeEvento = {
	nombre: string;
	descripcion?: string;
	imagen?: string | null;
	abreEn: string;
	cierraEn: string;
	direccion: DireccionDeEvento;
	productos: string[];
};

async function deCuenta<T>(
	ruta: string,
	metodo = "GET",
	cuerpo?: unknown,
): Promise<T> {
	const token = await tokenVigente();
	if (!token) throw new Error("Inicia sesión para administrar tus eventos.");
	const res = await fetch(`${API}${ruta}`, {
		method: metodo,
		headers: {
			authorization: `Bearer ${token}`,
			...(cuerpo ? { "content-type": "application/json" } : {}),
		},
		body: cuerpo ? JSON.stringify(cuerpo) : undefined,
	});
	const dato = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(dato.message ?? "No pudimos guardar el evento.");
	return dato;
}

export const listarEventos = () => deCuenta<Evento[]>("/cuenta/eventos");

/**
 * Pide permiso para subir la portada y devuelve dónde va a quedar.
 *
 * Son dos pasos —firmar aquí, PUT a S3 desde el navegador— porque el archivo
 * no pasa por la Lambda: una foto de 8 MB por el cuerpo de una petición es
 * tráfico y tiempo de ejecución pagados dos veces.
 */
export const firmarFotoDeEvento = (datos: { tipo: string; bytes: number }) =>
	deCuenta<{ uploadUrl: string; url: string }>(
		"/cuenta/eventos/subidas",
		"POST",
		datos,
	);
export const obtenerEvento = (id: string) =>
	deCuenta<Evento>(`/cuenta/eventos/${encodeURIComponent(id)}`);
export const crearEvento = (datos: DatosDeEvento) =>
	deCuenta<Evento>("/cuenta/eventos", "POST", datos);
export const actualizarEvento = (id: string, datos: DatosDeEvento) =>
	deCuenta<Evento>(`/cuenta/eventos/${encodeURIComponent(id)}`, "PATCH", datos);
export const publicarEvento = (id: string) =>
	deCuenta<Evento>(
		`/cuenta/eventos/${encodeURIComponent(id)}/publicar`,
		"POST",
	);
export const cerrarEvento = (id: string) =>
	deCuenta<Evento>(`/cuenta/eventos/${encodeURIComponent(id)}/cerrar`, "POST");
export const borrarEvento = (id: string) =>
	deCuenta<{ ok: true }>(`/cuenta/eventos/${encodeURIComponent(id)}`, "DELETE");

async function publico<T>(
	ruta: string,
	metodo = "GET",
	cuerpo?: unknown,
): Promise<T> {
	const res = await fetch(`${API}${ruta}`, {
		method: metodo,
		headers: cuerpo ? { "content-type": "application/json" } : undefined,
		body: cuerpo ? JSON.stringify(cuerpo) : undefined,
	});
	const dato = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(dato.message ?? "No pudimos abrir el evento.");
	return dato;
}

export const obtenerEventoPublico = (codigo: string) =>
	publico<EventoPublico>(`/publico/eventos/${encodeURIComponent(codigo)}`);

export const registrarParticipacion = (
	codigo: string,
	datos: {
		intentoId: string;
		participante: { nombre: string; email: string; whatsapp?: string };
		lineas: {
			eventoItemId: string;
			talla: string;
			color?: string;
			piezas: number;
			diseno?: unknown;
		}[];
	},
) =>
	publico<ParticipacionDeEvento>(
		`/publico/eventos/${encodeURIComponent(codigo)}/participaciones`,
		"POST",
		datos,
	);
export const configurarProductoDeEvento = (
	id: string,
	itemId: string,
	datos: {
		personalizacion: ProductoDeEvento["personalizacion"];
		arteId?: string | null;
	},
) =>
	deCuenta<Evento>(
		`/cuenta/eventos/${encodeURIComponent(id)}/productos/${encodeURIComponent(itemId)}`,
		"PATCH",
		datos,
	);
