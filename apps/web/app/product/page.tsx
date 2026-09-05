"use client";

import { useEffect, useState } from "react";
import ProductoVista from "@/components/Producto/ProductoVista";
import {
	aProductoViejo,
	aTarjetasViejas,
	getCatalogo,
	getFichaDeProducto,
} from "@/lib/api/catalogo";
import type { CatalogProduct, Product } from "@/lib/api/products";

/**
 * La ficha de CUALQUIER producto, resuelta en el navegador.
 *
 * POR QUÉ EXISTE, y no es un duplicado de `/product/[id]`.
 *
 * El sitio se publica como export estático: las páginas de producto se hornean
 * al construir, con la lista que devolvía el catálogo en ese momento. El
 * catálogo, en cambio, se pide EN VIVO. Así que entre una publicación y la
 * siguiente hay productos que se ven en el catálogo, se pueden pulsar y dan
 * 404 — ya pasó el 4 de septiembre con un termo aprobado 54 minutos después de
 * subir el sitio.
 *
 * `/product/[id]` sigue siendo la página buena: es HTML pre-renderizado, es lo
 * que se indexa y es la URL que se comparte. Ésta es la RED: cuando aquella no
 * existe todavía, `not-found.tsx` comprueba contra la API y manda aquí, que no
 * tiene segmento dinámico y por lo tanto existe siempre, para cualquier id.
 *
 * EL `?id=` SE LEE DE `window`, no con `useSearchParams`. Ese hook obliga a un
 * `<Suspense>` y hace que Next abandone el prerenderizado de todo lo que hay
 * dentro; en un export estático eso deja la página en blanco hasta que hidrata.
 * Es la misma regla que ya mordió en el catálogo del panel.
 */
export default function ProductoDirecto() {
	const [producto, setProducto] = useState<Product | null>(null);
	const [recomendados, setRecomendados] = useState<CatalogProduct[]>([]);
	const [sinProducto, setSinProducto] = useState(false);

	useEffect(() => {
		const id = new URLSearchParams(window.location.search).get("id");
		if (!id) {
			setSinProducto(true);
			return;
		}

		getFichaDeProducto(id)
			.then((ficha) => setProducto(aProductoViejo(ficha)))
			.catch(() => setSinProducto(true));

		/* Las recomendaciones son el añadido: si el catálogo falla, la ficha se
		   enseña igual sin la fila de abajo. */
		getCatalogo()
			.then((catalogo) =>
				setRecomendados(
					aTarjetasViejas(catalogo.filter((p) => p.id !== id).slice(0, 4)),
				),
			)
			.catch(() => {});
	}, []);

	if (sinProducto) {
		return (
			<main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col items-center justify-center px-5 text-center">
				<h1 className="font-display text-[24px] font-semibold tracking-[-0.02em] text-tinta">
					Este producto ya no está disponible
				</h1>
				<a
					href="/catalogo"
					className="mt-6 inline-flex h-12 items-center rounded-full bg-tinta px-6 text-[15px] font-semibold text-lima"
				>
					Ver el catálogo
				</a>
			</main>
		);
	}

	/* Sin esqueleto ni rueda: se llega aquí desde un 404 que ya tardó su viaje,
	   y un armazón a medias parpadeando antes de la ficha se lee como otro
	   error. El fondo es el mismo del sitio, así que no hay salto. */
	if (!producto) return <div className="min-h-screen bg-hueso" />;

	return <ProductoVista product={producto} recomendados={recomendados} />;
}
