"use client";

import ExplorarCatalogo from "./ExplorarCatalogo";

/**
 * El catálogo, dentro del panel.
 *
 * Es el mismo endpoint público que la tienda (`getCatalogo`, sin credenciales
 * de ningún tipo), no una copia: si el catálogo cambia, esto cambia. Lo que
 * cambia es el destino — desde aquí se va directo a diseñar, porque quien está
 * en su panel ya decidió que quiere hacer algo.
 *
 * NO HAY ORDENACIÓN, y es deliberado. Hoy el catálogo publicado tiene tres
 * productos: un selector de orden sobre una rejilla que cabe entera en la
 * pantalla es un control que no ordena nada. Cuando haya suficientes para que
 * haga falta desplazarse, entonces sí.
 *
 * TODO LO QUE SE VE VIVE EN `ExplorarCatalogo`, que también es lo que se abre
 * al elegir productos para una plantilla. Aquí sólo queda el destino de la
 * tarjeta —diseñar— y este comentario.
 */
export default function CatalogoEnPanel() {
	return <ExplorarCatalogo />;
}
