import { apiFetch } from "./api";

/**
 * Pedidos asignados a un proveedor.
 *
 * OJO: `/providers/me/orders` TODAVÍA NO EXISTE en la API — no hay tabla de
 * pedidos en la base. Este módulo define la forma que esperamos y falla
 * suave: mientras el endpoint no exista, `getMisPedidos` devuelve una lista
 * vacía y el panel muestra su estado vacío en vez de romperse.
 */

export type EstadoPedido = "nuevo" | "produccion" | "listo" | "entregado";

export type TallaPedida = {
	size: string;
	piezas: number;
};

export type Pedido = {
	id: string;
	/** Folio corto que ve el proveedor: #2418. */
	folio: string;
	estado: EstadoPedido;

	producto: string;
	sku?: string | null;
	imagen?: string | null;

	tecnica: string;
	lado: string;
	colorPrenda: string;
	/** Los colores del diseño, en hex, para dibujar las tintas. */
	tintas: string[];

	/** Área imprimible en centímetros. */
	anchoCm?: number | null;
	altoCm?: number | null;

	tallas: TallaPedida[];
	piezas: number;

	recibidoEl: string;
	entregaEl: string;
	notaCliente?: string | null;
	/** El archivo listo para máquina. */
	archivoUrl?: string | null;
};

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
	nuevo: "Nuevo",
	produccion: "En producción",
	listo: "Listo",
	entregado: "Entregado",
};

/** Los que el proveedor todavía no abre. Es lo que cuenta la insignia. */
export function contarNuevos(pedidos: Pedido[]) {
	return pedidos.filter((p) => p.estado === "nuevo").length;
}

export async function getMisPedidos(): Promise<Pedido[]> {
	// Sin endpoint todavía: lista vacía en vez de una pantalla rota.
	return apiFetch<Pedido[]>("/providers/me/orders").catch(() => []);
}
