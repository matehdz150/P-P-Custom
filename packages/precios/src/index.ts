/**
 * Cuánto suman los lados de un producto. UNA sola vez, para los dos lados de
 * la frontera.
 *
 * POR QUÉ ES UN PAQUETE Y NO UNA FUNCIÓN EN CADA SITIO. La misma regla la
 * necesitan cinco pantallas del navegador —la ficha, el resumen de pedir, el
 * desglose, las especificaciones y el editor— y la Lambda que cobra. Estaba
 * escrita cinco veces, y mientras todos los lados costaran igual eso no se
 * notaba. Con un recargo por lado sí: basta con que una copia se quede sin
 * actualizar para que el comprador vea un precio y se le cobre otro, que es el
 * peor fallo posible de esta parte.
 *
 * QUIÉN MANDA. Lo que devuelve esto sólo vale si `printSides` y `pricing`
 * salieron de la tabla del producto. Nunca del cuerpo de la petición: está
 * comprobado que se puede falsificar, se probó y se ignoró.
 */

/** Lo que hace falta de un lado para cobrarlo. Un subconjunto de `printSides`. */
export type LadoConPrecio = {
	sideKey: string;
	/**
	 * El recargo de ESTE lado, si el taller se lo puso.
	 *
	 * Existe porque una manga no cuesta lo que una espalda. Sin él se usa el
	 * `perSidePrice` global, que es lo que había antes y sigue siendo lo
	 * correcto para un producto cuyos lados valen lo mismo.
	 */
	recargo?: number | null;
};

export type PreciosDelProducto = {
	perSidePrice?: number | null;
};

/** El recargo de un lado: el suyo si lo tiene, y si no el del producto. */
export function recargoDeLado(
	sideKey: string,
	lados: readonly LadoConPrecio[],
	precios: PreciosDelProducto,
): number {
	const propio = lados.find((l) => l.sideKey === sideKey)?.recargo;
	/* `?? ` y no `||`: un recargo de 0 es una decisión del taller —"esta manga
	   va incluida"— y con `||` se caería al global, que es lo contrario. */
	const valor = propio ?? precios.perSidePrice ?? 0;
	return Number.isFinite(valor) && valor > 0 ? Number(valor) : 0;
}

/**
 * Lo que suman los lados elegidos, además del precio base.
 *
 * EL BASE ABSORBE EL LADO MÁS CARO, no el primero de la lista. Con un precio
 * único daba igual cuál fuera el gratis; con recargos distintos, tomar "el
 * primero" haría que el total dependiera del ORDEN en que se eligieron los
 * lados, y que añadir una manga barata encareciera el frente. Así el recargo
 * es siempre el costo real de lo que se añade sobre una prenda ya estampada, y
 * no hay forma de bajarlo reordenando.
 *
 * Con todos los lados al mismo precio da exactamente `(n - 1) * perSidePrice`,
 * que es lo que se cobraba antes: ningún producto de hoy cambia de precio.
 */
export function extraPorLados(
	elegidos: readonly string[],
	lados: readonly LadoConPrecio[],
	precios: PreciosDelProducto,
): number {
	if (elegidos.length <= 1) return 0;

	const recargos = elegidos.map((s) => recargoDeLado(s, lados, precios));
	const total = recargos.reduce((suma, r) => suma + r, 0);
	return total - Math.max(...recargos);
}
