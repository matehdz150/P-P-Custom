/**
 * Comparar la ruta actual con una nuestra, sin que la barra final decida.
 *
 * POR QUÉ EXISTE ESTO, Y POR QUÉ IMPORTA MÁS DE LO QUE PARECE
 *
 * `trailingSlash` se enciende **sólo al exportar** (ver `next.config.ts`),
 * porque el export escribe `/catalogo/index.html` y la función de CloudFront
 * resuelve las URLs bonitas añadiendo `index.html`. La consecuencia es que
 * `usePathname()` devuelve `/proveedor/login/` en el sitio publicado y
 * `/proveedor/login` en desarrollo.
 *
 * Así que `pathname === "/proveedor/login"` funciona en `pnpm dev` y falla en
 * producción — que es el peor sitio donde puede fallar, porque es el único
 * donde nadie lo prueba antes.
 *
 * YA MORDIÓ DOS VECES:
 *
 *   - El layout del catálogo creía estar en una subruta y montaba su buscador
 *     encima del hero, que ya trae el suyo: dos buscadores en la misma
 *     pantalla.
 *   - El layout del taller comparaba `pathname === "/proveedor/login"`, daba
 *     falso, montaba el panel en vez del login, y como no había sesión el
 *     panel devolvía `null`: **página en blanco para siempre**, con el efecto
 *     redirigiendo al mismo sitio una y otra vez.
 *
 * Por eso vive aquí y no como un `.replace()` suelto en cada archivo: repetido,
 * al siguiente se le olvida a alguien y el fallo sólo aparece desplegado.
 */

/** La ruta sin barras al final. `/` se queda como está. */
export function rutaLimpia(pathname: string | null | undefined) {
	if (!pathname) return "/";
	return pathname.replace(/\/+$/, "") || "/";
}

/**
 * ¿La ruta actual es ésta?
 *
 * Normaliza los DOS lados: así da igual si el literal se escribió con barra o
 * sin ella, que es justo el detalle que nadie recuerda al añadir una pantalla.
 */
export function mismaRuta(
	pathname: string | null | undefined,
	destino: string,
) {
	return rutaLimpia(pathname) === rutaLimpia(destino);
}
