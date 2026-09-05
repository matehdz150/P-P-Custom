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
 * Ya pasó dos veces el 4 de septiembre: una gorra, y después un termo aprobado
 * 54 minutos DESPUÉS de subir el sitio — se veía en el catálogo y su ficha
 * contestaba "este producto ya no está disponible", que además es mentira.
 *
 * YA NO SE ROMPE, aunque esto siga igual. `app/not-found.tsx` le pregunta a la
 * API por el id de la URL: si el producto vive, manda a `/product/?id=` o a
 * `/design/?id=` —rutas sin segmento dinámico, que existen siempre— y la ficha
 * se resuelve en el navegador. Lo que se pierde hasta el siguiente despliegue
 * es la URL bonita, no la página.
 *
 * Sigue haciendo falta republicar para que `/product/<id>` vuelva a ser HTML
 * indexable: eso es el precio de tener URLs por producto en vez de `?id=`, y
 * ése sí se paga a propósito.
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
