import { getCatalogo, getCategoriasPublicas } from "@/lib/api/catalogo";

/**
 * Las URLs que se generan al construir el sitio.
 *
 * El sitio se publica como export estático en S3, y ahí no hay servidor que
 * resuelva una ruta dinámica: hay que saber todas las URLs en el build. Estas
 * funciones las averiguan preguntándole al catálogo público.
 *
 * LO QUE ESTO IMPLICA: **un producto aprobado no existe en el sitio hasta que
 * se vuelve a construir y subir.** Es el precio de tener URLs indexables por
 * producto en vez de `?id=`. Cuando duela, se automatiza el redespliegue al
 * aprobar.
 *
 * Si el catálogo no responde, el build FALLA a propósito. Publicar un sitio
 * sin productos porque hubo un hipo de red es peor que no publicar.
 */

export async function idsDeProductos(): Promise<string[]> {
	const catalogo = await getCatalogo();
	return catalogo.map((p) => p.id);
}

/** El listado por categoría: el `[id]` de esa ruta es una categoría. */
export async function idsDeCategorias(): Promise<string[]> {
	const categorias = await getCategoriasPublicas();
	return categorias.map((c) => c.id);
}
