import type { ArteDeLado } from "@/lib/designer/exportarArte";

/**
 * Mandar un pedido.
 *
 * Va a la ruta pública, sin llave ni sesión: pedir no exige cuenta. Lo que
 * decide el precio y el taller lo pone la Lambda leyendo el producto, así que
 * aquí sólo viaja lo que el cliente eligió.
 */

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

export type TallaPedida = { size: string; piezas: number };

export type LineaAPedir = {
	productoId: string;
	colorPrenda?: string | null;
	tallas: TallaPedida[];
	/** Los lados que llevan arte. De aquí salen los archivos a subir. */
	lados: string[];
	/** El diseño editable, por si hay que reabrirlo o corregirlo. */
	diseno?: unknown;
};

export type Comprador = {
	nombre: string;
	email: string;
	whatsapp?: string;
	notas?: string;
};

export type PedidoCreado = {
	id: string;
	folio: string;
	/** Sólo se ve UNA vez: es la llave del enlace de seguimiento. */
	token: string;
	total: number;
	subidas: { lineaId: string; lado: string; ruta: string; uploadUrl: string }[];
};

export type PedidoEnSeguimiento = {
	id: string;
	folio: string;
	estado: "nuevo" | "produccion" | "listo" | "entregado" | "cancelado";
	comprador: { nombre: string; email: string; whatsapp: string | null };
	lineas: {
		id: string;
		producto: string;
		imagen: string | null;
		colorPrenda: string | null;
		lados: string[];
		tallas: TallaPedida[];
		piezas: number;
		importe: number;
		arte: { lado: string; ruta: string }[];
	}[];
	total: number;
	piezas: number;
	bitacora: { estado: string; en: string; por: string; nota: string | null }[];
	createdAt: string;
};

async function publico<T>(ruta: string, opciones?: RequestInit): Promise<T> {
	const res = await fetch(`${API}${ruta}`, {
		headers: { "content-type": "application/json" },
		...opciones,
	});

	if (!res.ok) {
		const cuerpo = await res.json().catch(() => null);
		throw new Error(cuerpo?.message ?? `El pedido falló (${res.status})`);
	}

	return res.json();
}

export function crearPedido(datos: {
	comprador: Comprador;
	lineas: LineaAPedir[];
}) {
	return publico<PedidoCreado>("/publico/pedidos", {
		method: "POST",
		body: JSON.stringify(datos),
	});
}

export function seguirPedido(id: string, token: string) {
	return publico<PedidoEnSeguimiento>(
		`/publico/pedidos/${id}?token=${encodeURIComponent(token)}`,
	);
}

/**
 * Sube el arte a las URLs que devolvió el pedido.
 *
 * Va después de crear el pedido y no antes: así el permiso de escritura está
 * atado a un pedido que ya existe, en vez de haber un firmador abierto que
 * cualquiera podría usar para llenar el bucket.
 *
 * Si una subida falla, el pedido ya está hecho y el taller lo verá sin ese
 * archivo. Vale más avisar de eso que fingir que el pedido no ocurrió.
 */
export async function subirArte(
	pedido: PedidoCreado,
	artes: ArteDeLado[],
): Promise<{ subidos: number; fallidos: string[] }> {
	const fallidos: string[] = [];
	let subidos = 0;

	for (const arte of artes) {
		const destino = pedido.subidas.find((s) => s.lado === arte.lado);
		if (!destino) {
			fallidos.push(arte.lado);
			continue;
		}

		try {
			const res = await fetch(destino.uploadUrl, {
				method: "PUT",
				// Exactamente el tipo que se firmó, o S3 rechaza la firma.
				headers: { "Content-Type": "image/png" },
				body: arte.blob,
			});

			if (!res.ok) throw new Error(String(res.status));
			subidos++;
		} catch {
			fallidos.push(arte.lado);
		}
	}

	return { subidos, fallidos };
}

/** El enlace que se le da al comprador. El token va en la URL, no en la sesión. */
export function enlaceDeSeguimiento(pedido: { id: string; token: string }) {
	return `/pedido/${pedido.id}?token=${encodeURIComponent(pedido.token)}`;
}
