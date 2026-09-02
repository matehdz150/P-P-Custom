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
		/** Lo que el taller declaró como área imprimible. */
		anchoCm?: number;
		altoCm?: number;
		dpi?: number;
		/** Lo que mide el archivo de verdad. Es lo que va a salir impreso. */
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
	nuevo: ["produccion", "cancelado"],
	produccion: ["listo", "cancelado"],
	listo: ["entregado"],
	entregado: [],
	cancelado: [],
};

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
