import { pedirComoProveedor } from "./proveedores";

/**
 * Los pedidos del taller.
 *
 * Salen de la Lambda `kustto-proveedores` (`/proveedores/pedidos`), atados al
 * `sub` del token: cada taller ve los suyos y nada más. Antes esto apuntaba a
 * `/providers/me/orders` en Nest, un endpoint que nunca existió, y por eso el
 * panel enseñaba siempre su estado vacío.
 */

/** `cancelado` existe en la API y hay que contemplarlo aunque el taller lo use poco. */
export type EstadoPedido =
	| "nuevo"
	| "produccion"
	| "listo"
	/** Ya salió con la paquetería. Sólo en pedidos con envío. */
	| "enviado"
	| "entregado"
	| "cancelado";

export type TallaPedida = { size: string; piezas: number };

/** Una línea del pedido: un producto con su diseño, sus tallas y su arte. */
export type LineaDePedido = {
	id: string;
	productoId: string;
	producto: string;
	imagen: string | null;
	colorPrenda: string | null;
	lados: string[];
	tallas: TallaPedida[];
	piezas: number;
	importe: number;
	/** Para comprar el blanco: el código del taller, no el nombre bonito. */
	sku?: string | null;
	/** El tono exacto de la prenda. Decide la subbase blanca. */
	colorPrendaHex?: string | null;
	/**
	 * Lo que hace falta para producir cada lado.
	 *
	 * Las medidas van CONGELADAS aquí, no leídas del producto: el taller puede
	 * cambiarlas mañana y un pedido viejo se imprimiría al tamaño de hoy.
	 * Faltan en los pedidos anteriores a que se guardaran, y por eso opcionales.
	 */
	arte: {
		lado: string;
		ruta: string;
		/** La prenda con el diseño encima: dónde va, no qué se imprime. */
		colocacion?: string | null;
		/**
		 * La prenda REAL con el diseño encima, si el taller subió su foto.
		 *
		 * La ruta viene SIEMPRE; el archivo puede no existir. Comprobarlo en el
		 * servidor costaría una llamada a S3 por lado y por pedido, así que lo
		 * resuelve quien la pinta: si la imagen no carga, no se enseña la casilla.
		 */
		prenda?: string | null;
		/** Lo que el taller declaró como área imprimible. */
		anchoCm?: number;
		altoCm?: number;
		dpi?: number;
		/** Lo que mide el archivo de verdad. Es lo que va a salir impreso. */
		/** Cuánto desborda el archivo por lado. Ya está restado de lo real. */
		sangradoCm?: number;
		anchoPx?: number;
		altoPx?: number;
		anchoRealCm?: number;
		altoRealCm?: number;
	}[];
};

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

export type Pedido = {
	id: string;
	/** Folio corto, el que se dice por teléfono: 2418. */
	folio: string;
	estado: EstadoPedido;
	comprador: {
		nombre: string;
		email: string;
		whatsapp: string | null;
		notas: string | null;
	};
	entrega?: {
		metodo: "envio" | "recoger";
		direccion: Direccion | null;
	} | null;
	/**
	 * El envío que eligió y pagó el comprador, congelado al hacer el pedido.
	 * `real` aparece al comprar la guía, con lo que se midió de verdad.
	 */
	envio?: {
		/** La cotización del checkout. La guía NO se compra con ésta. */
		cotizacionId?: string;
		tarifaId?: string;
		paqueteria: string;
		servicio: string;
		precio: number;
		diasEstimados?: number | string | null;
		real?: {
			peso: number;
			largo: number;
			ancho: number;
			alto: number;
			costo: number;
			/** Positivo lo debe el taller; negativo sobró a favor de Kustto. */
			diferencia: number;
		} | null;
	} | null;
	/**
	 * La guía, cuando ya se compró.
	 *
	 * `etiquetaUrl` y `rastreo` nacen en `null`: la paquetería tarda en
	 * generarlos y hay que volver a preguntar. Ver `refrescarGuia`.
	 */
	guia?: {
		envioId: string;
		paqueteria: string;
		costo: number | string;
		compradaEn: string;
		rastreo: string | null;
		rastreoUrl: string | null;
		etiquetaUrl: string | null;
		/**
		 * `error` significa que el envío MURIÓ del lado de la paquetería y la
		 * etiqueta no va a llegar nunca. Skydropx reembolsa el cobro. Sin este
		 * campo no se distinguía de uno lento y el panel esperaba para siempre.
		 */
		estado?: string | null;
		error?: string | null;
	} | null;
	lineas: LineaDePedido[];
	total: number;
	piezas: number;
	bitacora: { estado: string; en: string; por: string; nota: string | null }[];
	createdAt: string;
	updatedAt: string;
};

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
	nuevo: "Nuevo",
	produccion: "En producción",
	listo: "Listo",
	enviado: "En camino",
	entregado: "Entregado",
	cancelado: "Cancelado",
};

/**
 * A dónde puede ir cada estado.
 *
 * Es una copia de lo que declara la Lambda, y está aquí sólo para no ofrecerle
 * al taller un botón que la API va a rechazar. La que manda es la de allá: si
 * las dos dejaran de coincidir, el servidor gana y devuelve 400.
 */
export const SIGUIENTE_ESTADO: Record<EstadoPedido, EstadoPedido[]> = {
	// Cancelar sólo antes de empezar: después la prenda ya existe y las
	// existencias ya se consumieron. Eso es una devolución, no una cancelación.
	nuevo: ["produccion", "cancelado"],
	produccion: ["listo"],
	listo: ["enviado", "entregado"],
	enviado: ["entregado"],
	entregado: [],
	cancelado: [],
};

/**
 * A dónde puede ir ESTE pedido, que depende de cómo se entrega.
 *
 * Con envío hay que pasar por `enviado`: saltar a `entregado` haría que la
 * palabra del taller sustituyera a la de quien entregó el paquete. Con
 * recoger, `enviado` no significa nada porque nadie lo envía.
 *
 * Es la misma regla que aplica la API; aquí sólo evita ofrecer un botón que
 * el servidor va a rechazar.
 */
export function siguientesDe(pedido: Pedido): EstadoPedido[] {
	const destinos = SIGUIENTE_ESTADO[pedido.estado] ?? [];
	if (pedido.estado !== "listo") return destinos;

	return pedido.entrega?.metodo === "recoger"
		? destinos.filter((e) => e !== "enviado")
		: destinos.filter((e) => e !== "entregado");
}

/** Los recién llegados. Es lo que cuenta la insignia del menú. */
export function contarNuevos(pedidos: Pedido[]) {
	return pedidos.filter((p) => p.estado === "nuevo").length;
}

export function getMisPedidos() {
	return pedirComoProveedor<Pedido[]>("/proveedores/pedidos");
}

export function getMiPedido(id: string) {
	return pedirComoProveedor<Pedido>(`/proveedores/pedidos/${id}`);
}

/**
 * Mueve el pedido y deja constancia en la bitácora.
 *
 * Devuelve el pedido ya movido, no un `ok`: así la pantalla pinta lo que de
 * verdad quedó guardado en vez de adivinar el resultado. Si alguien más lo
 * movió mientras tanto, la API responde 409 y hay que recargar.
 */
export function cambiarEstadoPedido(
	id: string,
	estado: EstadoPedido,
	nota?: string,
) {
	return pedirComoProveedor<Pedido>(`/proveedores/pedidos/${id}/estado`, {
		method: "PATCH",
		body: JSON.stringify({ estado, nota }),
	});
}

/** Lo que el taller mide del paquete ya armado. Kilos y centímetros. */
export type PaqueteMedido = {
	peso: number;
	largo: number;
	ancho: number;
	alto: number;
};

/**
 * Compra la guía con el peso REAL.
 *
 * La API vuelve a cotizar con estas medidas en vez de reusar la del checkout,
 * que salió de un peso estimado: una etiqueta con el peso equivocado la
 * repesa la paquetería y factura la diferencia semanas después.
 *
 * Devuelve el pedido entero ya actualizado. Es lento —son cuatro llamadas
 * encadenadas a Skydropx— y no se puede repetir: la API rechaza con 409 si el
 * pedido ya tiene guía, porque dos clics comprarían dos envíos y se pagan los
 * dos.
 */
export function comprarGuia(id: string, paquete: PaqueteMedido) {
	return pedirComoProveedor<Pedido>(`/proveedores/pedidos/${id}/guia`, {
		method: "POST",
		body: JSON.stringify(paquete),
	});
}

/**
 * Vuelve a preguntar por la etiqueta.
 *
 * Al comprar, el envío nace sin etiqueta ni número de rastreo: cada paquetería
 * tarda lo suyo y con algunas son minutos. `lista` dice si ya salió, para que
 * la pantalla sepa cuándo dejar de preguntar.
 */
export function refrescarGuia(id: string) {
	return pedirComoProveedor<{
		guia: NonNullable<Pedido["guia"]>;
		lista: boolean;
		/** Presente sólo si el envío murió: es el motivo, ya legible. */
		fallo?: string | null;
	}>(`/proveedores/pedidos/${id}/guia`);
}
