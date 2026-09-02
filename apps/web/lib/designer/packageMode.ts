/**
 * Contexto que activa el "modo paquete" del diseñador: cuando el cliente diseña
 * una unidad de un artículo dentro de un paquete. Al guardar, en lugar de ir al
 * resumen de pedido, el diseño se asigna a las unidades indicadas y se regresa
 * al hub de diseño del paquete.
 */
export type DesignerPackageMode = {
	/** URL a la que volver tras guardar (el hub del paquete). */
	returnTo: string;
	/** Asigna el diseño recién guardado a las unidades objetivo. */
	assign: (designId: string) => Promise<void>;
};
