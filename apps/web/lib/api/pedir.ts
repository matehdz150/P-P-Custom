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
	archivos?: {
		lado: string;
		anchoPx: number;
		altoPx: number;
		dpi: number;
		/** Cuánto del archivo es sangrado. La ficha del taller lo resta. */
		sangradoCm?: number;
	}[];
	/**
	 * El diseño editable NO va aquí.
	 *
	 * Lleva dentro las imágenes que subió el cliente como data URL, y un ítem
	 * de DynamoDB no pasa de 400 KB: con una foto de verdad el pedido dejaba de
	 * caber y la escritura fallaba con un 500. Se sube a S3 aparte, con la URL
	 * firmada que devuelve el pedido, igual que el arte.
	 */
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
		/** La posición de la línea en lo que se pidió. Con esto se empareja. */
		indice: number;
		lineaId: string;
		lado: string;
		tipo: "arte" | "colocacion" | "prenda" | "diseno";
		ruta: string;
		uploadUrl: string;
	}[];
};

export type PedidoEnSeguimiento = {
	id: string;
	folio: string;
	estado:
		| "nuevo"
		| "produccion"
		| "listo"
		/** Ya salió con la paquetería. */
		| "enviado"
		| "entregado"
		| "cancelado";
	comprador: { nombre: string; email: string; whatsapp: string | null };
	entrega?: {
		metodo: "envio" | "recoger";
		direccion:
			| (Direccion & { interior: string | null; referencias: string | null })
			| null;
	} | null;
	/**
	 * El envío, recortado a lo que puede ver quien compró.
	 *
	 * La API quita a propósito la etiqueta y lo que le costó al taller: con el
	 * costo real al lado de lo que se cobró, el margen queda a la vista.
	 */
	envio?: {
		paqueteria: string;
		servicio: string;
		precio: number;
		diasEstimados?: number | string | null;
	} | null;
	/** Aparece cuando el taller compra la guía. */
	guia?: {
		paqueteria: string | null;
		rastreo: string | null;
		rastreoUrl: string | null;
		compradaEn: string;
	} | null;
	lineas: {
		id: string;
		/* Qué producto del catálogo es. El servidor lo guarda y lo devuelve —
		   `paraComprador` no toca las líneas—, sólo faltaba declararlo aquí.
		   Lo necesita quien vuelva a pedir esa línea: es con lo que se
		   re-cotiza y se comprueba que siga publicado. */
		productoId: string;
		producto: string;
		imagen: string | null;
		colorPrenda: string | null;
		lados: string[];
		tallas: TallaPedida[];
		piezas: number;
		importe: number;
		/**
		 * `ruta` es el arte que va a máquina —recortado y transparente—, y
		 * `colocacion` la prenda con el diseño encima. Para enseñárselo a quien
		 * compró sirve la segunda: el arte suelto no se reconoce en pequeño.
		 */
		arte: { lado: string; ruta: string; colocacion: string }[];
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
	/**
	 * La entrega de toda la compra. Se sigue aceptando para el checkout de un
	 * solo producto; con carrito se manda `partes`, porque cada taller entrega
	 * lo suyo a su manera.
	 */
	entrega?: Entrega;
	/** Una por taller: su entrega y, si envía, qué tarifa eligió el cliente. */
	partes?: {
		proveedorId: string;
		entrega: Entrega;
		envio?: { cotizacionId: string; tarifaId: string };
	}[];
	/**
	 * Qué paquetería eligió, sin el precio.
	 *
	 * Sólo la cotización y la tarifa: el precio lo lee la Lambda de Skydropx.
	 * Mandarlo desde aquí sería dejar que el navegador decida cuánto se cobra
	 * de envío, igual que mandar el precio del producto.
	 */
	envio?: { cotizacionId: string; tarifaId: string };
	lineas: LineaAPedir[];
}) {
	return publico<PedidoCreado>("/publico/pedidos", {
		method: "POST",
		body: JSON.stringify(datos),
	});
}

/**
 * Cotiza una compra entera: un envío por taller.
 *
 * Las llamadas a la paquetería las espacia la Lambda, no esta función: el
 * límite de Skydropx es global y confiarlo al navegador significaría que dos
 * pestañas abiertas se lo saltan.
 *
 * Una parte puede volver con `error` en vez de cotización —lo normal es que a
 * ese taller le falte la dirección de recolección— y eso NO invalida las
 * demás: el checkout enseña esa parte como "sólo para recoger".
 */
export function cotizarCompra(datos: {
	destino: Direccion;
	lineas: { productoId: string; tallas: TallaPedida[] }[];
}) {
	return publico<{
		partes: {
			proveedorId: string;
			taller: string | null;
			cotizacionId?: string;
			error?: string;
		}[];
	}>("/publico/envios/cotizar-compra", {
		method: "POST",
		body: JSON.stringify(datos),
	});
}

export function consultarCotizacion(id: string) {
	return publico<{
		lista: boolean;
		tarifas: {
			id: string;
			paqueteria: string;
			servicio: string;
			precio: number;
			dias: number | null;
		}[];
	}>(`/publico/envios/cotizacion/${encodeURIComponent(id)}`);
}

/**
 * Una compra del carrito con partes de VARIOS talleres.
 *
 * Con un solo taller la API devuelve la parte tal cual —con el folio de la
 * compra al lado— para que el seguimiento no tenga que saber que existen las
 * compras hasta que de verdad haya varias. Ver `comoCompra` en el servidor.
 */
export type CompraEnSeguimiento = {
	id: string;
	folio: string;
	esCompra: true;
	comprador: PedidoEnSeguimiento["comprador"];
	entrega: PedidoEnSeguimiento["entrega"];
	total: number;
	piezas: number;
	createdAt: string;
	partes: PedidoEnSeguimiento[];
};

export function esCompra(
	x: PedidoEnSeguimiento | CompraEnSeguimiento,
): x is CompraEnSeguimiento {
	return (x as CompraEnSeguimiento).esCompra === true;
}

/**
 * El pedido —o la compra entera— de quien trae el enlace.
 *
 * ESTA RUTA RESUELVE LAS DOS COSAS: el enlace que se entrega al pagar lleva el
 * id de la COMPRA, y los que ya circulan traen el de un pedido. La de la
 * cuenta (`getMiPedido`) sólo conoce pedidos, así que con un id de compra
 * responde que no existe.
 */
export function seguirPedido(id: string, token: string) {
	return publico<PedidoEnSeguimiento | CompraEnSeguimiento>(
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
	diseno?: unknown,
	indice = 0,
): Promise<{ faltaArte: string[]; faltaColocacion: string[] }> {
	const faltaArte: string[] = [];
	const faltaColocacion: string[] = [];

	const subir = async (destinoUrl: string, cuerpo: Blob, tipo: string) => {
		const res = await fetch(destinoUrl, {
			method: "PUT",
			// Exactamente el tipo que se firmó, o S3 rechaza la firma.
			headers: { "Content-Type": tipo },
			body: cuerpo,
		});

		if (!res.ok) throw new Error(String(res.status));
	};

	// El diseño editable. No bloquea nada: si falla, el pedido se produce igual
	// y lo único que se pierde es poder reabrirlo tal cual.
	const destinoDiseno = pedido.subidas.find(
		(s) => s.indice === indice && s.tipo === "diseno",
	);

	if (destinoDiseno && diseno !== undefined) {
		try {
			await subir(
				destinoDiseno.uploadUrl,
				new Blob([JSON.stringify(diseno)], { type: "application/json" }),
				"application/json",
			);
		} catch {
			// Se sigue: el arte importa, esto no.
		}
	}

	for (const lado of lados) {
		const destinoArte = pedido.subidas.find(
			(s) => s.indice === indice && s.lado === lado.lado && s.tipo === "arte",
		);

		if (!destinoArte) {
			faltaArte.push(lado.lado);
		} else {
			try {
				await subir(destinoArte.uploadUrl, lado.arte, "image/png");
			} catch {
				faltaArte.push(lado.lado);
			}
		}

		const destinoColocacion = pedido.subidas.find(
			(s) =>
				s.indice === indice && s.lado === lado.lado && s.tipo === "colocacion",
		);

		if (!lado.colocacion || !destinoColocacion) {
			faltaColocacion.push(lado.lado);
		} else {
			try {
				await subir(destinoColocacion.uploadUrl, lado.colocacion, "image/png");
			} catch {
				faltaColocacion.push(lado.lado);
			}
		}

		/* La prenda real, si el taller subió la foto de ese lado y color.
		   NO se apunta en `faltaColocacion` ni en ninguna lista: que no esté es
		   lo normal, no una incidencia, y avisar de ella en cada pedido enseñaría
		   a ignorar el aviso que sí importa. */
		const destinoPrenda = pedido.subidas.find(
			(s) => s.indice === indice && s.lado === lado.lado && s.tipo === "prenda",
		);

		if (lado.prenda && destinoPrenda) {
			try {
				await subir(destinoPrenda.uploadUrl, lado.prenda, "image/png");
			} catch {
				// Es una referencia, no el archivo que va a máquina.
			}
		}
	}

	return { faltaArte, faltaColocacion };
}

/** El enlace que se le da al comprador. El token va en la URL, no en la sesión. */
export function enlaceDeSeguimiento(pedido: { id: string; token: string }) {
	return `/pedido?id=${encodeURIComponent(pedido.id)}&token=${encodeURIComponent(pedido.token)}`;
}
