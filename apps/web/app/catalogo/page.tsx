"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearch } from "@/Contexts/SearchContext";
import CatalogoHero from "@/components/Catalogo/CatalogoHero";
import CierreProveedores from "@/components/Catalogo/CierreProveedores";
import { type Orden, ordenar } from "@/components/Catalogo/ordenar";
import PackagesSection from "@/components/Catalogo/PackageSection";
import ProductosGrid from "@/components/Catalogo/ProductosGrid";
import { useProductos } from "@/components/Catalogo/useProductos";
import { sinAcentos } from "@/lib/texto";

export default function Page() {
	const { query, setQuery } = useSearch();

	const [categoriaActiva, setCategoriaActiva] = useState("todo");

	/* `?categoria=<id>` de la portada. Se lee de `window` en un efecto y no con
	   `useSearchParams`: ese hook obliga a un `<Suspense>` y hace que Next
	   abandone el prerenderizado de todo lo que hay dentro, que en un export
	   estático deja la página en blanco hasta que hidrata. Misma regla que el
	   `?q=` de `SearchContext`. */
	useEffect(() => {
		const id = new URLSearchParams(window.location.search).get("categoria");
		if (id) setCategoriaActiva(id);
	}, []);
	const [orden, setOrden] = useState<Orden>("relevancia");

	const { categorias, productos, cargando } = useProductos(categoriaActiva);

	/* BUSCAR ES FILTRAR ESTE CATÁLOGO, no irse a otra pantalla.
	
	   Antes, con `?q=` la página se sustituía entera por `SearchResults`: se
	   perdían las categorías, el orden y la rejilla, y lo que aparecía era una
	   lista distinta con otra pinta. Quien busca "playera" desde la portada
	   espera el catálogo con playeras, no un buscador aparte.
	
	   Se filtra por NOMBRE Y POR TALLER, y sin acentos: "gorra de algodon"
	   encuentra "Gorra de algodón", y quien recuerda el taller y no el producto
	   también llega. */
	const ordenados = useMemo(() => {
		const termino = sinAcentos(query);
		const filtrados = termino
			? productos.filter(
					(p) =>
						sinAcentos(p.name).includes(termino) ||
						sinAcentos(p.provider ?? "").includes(termino),
				)
			: productos;

		return ordenar(filtrados, orden);
	}, [productos, orden, query]);

	return (
		<>
			<CatalogoHero
				categorias={categorias}
				categoriaActiva={categoriaActiva}
				onCategoria={setCategoriaActiva}
				orden={orden}
				onOrden={setOrden}
				total={cargando ? null : ordenados.length}
			/>

			<ProductosGrid
				productos={ordenados}
				cargando={cargando}
				busqueda={query}
				onLimpiarBusqueda={() => setQuery("")}
			/>

			<PackagesSection
				title="Paquetes para eventos"
				description="Combos pensados para graduaciones, bodas y eventos especiales."
				href="/catalogo/eventos"
				verTodos="Ver todos los paquetes de eventos"
				categoryName="eventos"
			/>

			<PackagesSection
				title="Paquetes empresariales"
				description="Soluciones personalizadas para equipos, oficinas y marcas."
				href="/catalogo/empresariales"
				verTodos="Ver todos los paquetes empresariales"
				categoryName="empresariales"
			/>

			<CierreProveedores />
		</>
	);
}
