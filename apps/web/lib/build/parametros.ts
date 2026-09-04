import { getCatalogo, getCategoriasPublicas } from "@/lib/api/catalogo";

/**
 * Las URLs que se generan al construir el sitio.
 *
 * El sitio se publica como export estático en S3, y ahí no hay servidor que
 * resuelva una ruta dinámica: hay que saber todas las URLs en el build. Estas
 * funciones las averiguan preguntándole al catálogo público.
 *
 * LO QUE ESTO IMPLICA, y es peor de lo que suena: el catálogo se pide EN VIVO
 * a la API, pero las páginas de cada producto se hornean aquí. Así que un
 * producto aprobado **aparece en el catálogo de inmediato y su página da 404
 * hasta que se vuelve a construir y subir**. No es que falte: es que se ve, se
 * puede pulsar y se rompe.
 *
 * Ya pasó (4 de septiembre): un taller dio de alta una gorra, salió en el
 * catálogo y `/design/<id>` contestó 404. Y no era sólo la nueva — los dos
 * productos publicados daban 404, porque el sitio se había construido cuando
 * el catálogo tenía otros.
 *
 * Es el precio de tener URLs indexables por producto en vez de `?id=`. La
 * salida buena no es acordarse de republicar: es que `/design/<id>` deje de
 * pre-generarse —no lo indexa nadie, es una aplicación— y lo resuelva el
 * navegador leyendo el id de la ruta, dejando horneado sólo `/product/<id>`,
 * que sí es contenido.
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
