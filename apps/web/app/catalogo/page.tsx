"use client";

import { useMemo, useState } from "react";
import { useSearch } from "@/Contexts/SearchContext";
import CatalogoHero from "@/components/Catalogo/CatalogoHero";
import CierreProveedores from "@/components/Catalogo/CierreProveedores";
import PackagesSection from "@/components/Catalogo/PackageSection";
import ProductosGrid from "@/components/Catalogo/ProductosGrid";
import SearchResults from "@/components/Catalogo/SearchResults";
import { useProductos } from "@/components/Catalogo/useProductos";
import { ordenar, type Orden } from "@/components/Catalogo/ordenar";

export default function Page() {
	const { query } = useSearch();

	const [categoriaActiva, setCategoriaActiva] = useState("todo");
	const [orden, setOrden] = useState<Orden>("relevancia");

	const { categorias, productos, cargando } = useProductos(categoriaActiva);

	const ordenados = useMemo(
		() => ordenar(productos, orden),
		[productos, orden],
	);

	const isSearching = query.trim().length > 0;

	if (isSearching) {
		return (
			<div className="px-5 pt-8 pb-16 md:px-14 md:pt-12">
				<SearchResults query={query} />
			</div>
		);
	}

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

			<ProductosGrid productos={ordenados} cargando={cargando} />

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
