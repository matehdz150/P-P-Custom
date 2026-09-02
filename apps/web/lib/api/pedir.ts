import type { ArchivoDeLado } from "@/lib/pedido/borrador";

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
	/**
	 * Lo que mide de verdad el archivo de cada lado.
	 *
	 * Va desde aquí porque sólo el navegador lo sabe: el tamaño sale del área
	 * del lienzo, y esa proporción no tiene por qué coincidir con los
	 * centímetros que declaró el taller. Es descriptivo —no decide precio ni
	 * destinatario— así que puede venir del cliente.
	 */
	archivos?: { lado: string; anchoPx: number; altoPx: number; dpi: number }[];
	/** El diseño editable, por si hay que reabrirlo o corregirlo. */
	diseno?: unknown;
};

export type Comprador = {
	nombre: string;
	email: string;
	whatsapp?: string;
	notas?: string;
};

export type Direccion = {
	calle: string;
	numero: string;
	interior?: string;
	colonia: string;
	ciudad: string;
	estado: string;
	cp: string;
	referencias?: string;
};

/**
 * Cómo se entrega. Con `recoger` no viaja dirección: el taller queda de verse
 * con el cliente, y pedirle una dirección que nadie va a usar sobra.
 */
export type Entrega =
	| { metodo: "envio"; direccion: Direccion }
	| { metodo: "recoger" };

export type PedidoCreado = {
	id: string;
	folio: string;
	/** Sólo se ve UNA vez: es la llave del enlace de seguimiento. */
	token: string;
	total: number;
	/** Dos por lado: el arte de producción y la referencia de colocación. */
	subidas: {
		lineaId: string;
		lado: string;
		tipo: "arte" | "colocacion";
		ruta: string;
		uploadUrl: string;
	}[];
};

export type PedidoEnSeguimiento = {
	id: string;
	folio: string;
	estado: "nuevo" | "produccion" | "listo" | "entregado" | "cancelado";
	comprador: { nombre: string; email: string; whatsapp: string | null };
	entrega?: {
		metodo: "envio" | "recoger";
		direccion:
			| (Direccion & { interior: string | null; referencias: string | null })
			| null;
	} | null;
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
	entrega: Entrega;
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
 * Sube los archivos a las URLs que devolvió el pedido.
 *
 * Va después de crear el pedido y no antes: así el permiso de escritura está
 * atado a un pedido que ya existe, en vez de haber un firmador abierto que
 * cualquiera podría usar para llenar el bucket.
 *
 * Si una subida falla, el pedido ya está hecho y el taller lo verá sin ese
 * archivo. Vale más avisar de eso que fingir que el pedido no ocurrió. Se
 * reportan por separado el arte y la colocación porque no pesan lo mismo:
 * sin arte no se puede producir, sin colocación sólo se pierde la referencia.
 */
export async function subirArchivos(
	pedido: PedidoCreado,
	lados: ArchivoDeLado[],
): Promise<{ faltaArte: string[]; faltaColocacion: string[] }> {
	const faltaArte: string[] = [];
	const faltaColocacion: string[] = [];

	const subir = async (destinoUrl: string, cuerpo: Blob) => {
		const res = await fetch(destinoUrl, {
			method: "PUT",
			// Exactamente el tipo que se firmó, o S3 rechaza la firma.
			headers: { "Content-Type": "image/png" },
			body: cuerpo,
		});

		if (!res.ok) throw new Error(String(res.status));
	};

	for (const lado of lados) {
		const destinoArte = pedido.subidas.find(
			(s) => s.lado === lado.lado && s.tipo === "arte",
		);

		if (!destinoArte) {
			faltaArte.push(lado.lado);
		} else {
			try {
				await subir(destinoArte.uploadUrl, lado.arte);
			} catch {
				faltaArte.push(lado.lado);
			}
		}

		const destinoColocacion = pedido.subidas.find(
			(s) => s.lado === lado.lado && s.tipo === "colocacion",
		);

		if (!lado.colocacion || !destinoColocacion) {
			faltaColocacion.push(lado.lado);
		} else {
			try {
				await subir(destinoColocacion.uploadUrl, lado.colocacion);
			} catch {
				faltaColocacion.push(lado.lado);
			}
		}
	}

	return { faltaArte, faltaColocacion };
}

/** El enlace que se le da al comprador. El token va en la URL, no en la sesión. */
export function enlaceDeSeguimiento(pedido: { id: string; token: string }) {
	return `/pedido/${pedido.id}?token=${encodeURIComponent(pedido.token)}`;
}
