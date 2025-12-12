"use client";

import Image from "next/image";
import { useSearch } from "@/Contexts/SearchContext";
import PackagesSection from "@/components/Catalogo/PackageSection";
import ProductGrid from "@/components/Catalogo/ProductGrid";
import SearchResults from "@/components/Catalogo/SearchResults";

export const packagesEventos = [
	{
		id: 1,
		label: "Graduación",
		title: "Paquete graduación básico",
		brand: "P&P Custom",
		priceFrom: "Desde $899 MXN",
		details: "Playeras + totebags personalizadas",
		sizes: "3 tallas · 3 colores",
		image: "/packages/grad-basic.png",
	},
	{
		id: 2,
		label: "Más vendido",
		title: "Kit fiesta empresarial",
		brand: "P&P Custom",
		priceFrom: "Desde $1,490 MXN",
		details: "Termos + playeras + gorras",
		sizes: "5 tallas · 4 colores",
		image: "/packages/business-kit.png",
	},
	{
		id: 3,
		label: "Graduación",
		title: "Set despedida de generación",
		brand: "P&P Custom",
		priceFrom: "Desde $1,199 MXN",
		details: "Playeras + termos conmemorativos",
		sizes: "4 tallas · 3 colores",
		image: "/packages/class-farewell.png",
	},
	{
		id: 4,
		label: "Personalizable",
		title: "Paquete a tu medida",
		brand: "P&P Custom",
		priceFrom: "Desde $799 MXN",
		details: "Arma tu combo desde cero",
		sizes: "Combina todos los productos",
		image: "/packages/custom-mix.png",
	},
];

export const packagesEmpresas = [
	{
		id: 1,
		label: "Corporate",
		title: "Kit bienvenida para empleados",
		brand: "P&P Custom",
		priceFrom: "Desde $1,199 MXN",
		details: "Termo + libreta + playera con logo",
		sizes: "4 tallas · 5 colores",
		image: "/packages/welcome-kit.png",
	},
	{
		id: 2,
		label: "Más vendido",
		title: "Paquete branding empresarial",
		brand: "P&P Custom",
		priceFrom: "Desde $1,899 MXN",
		details: "Playeras + termos + sudaderas",
		sizes: "6 tallas · 4 colores",
		image: "/packages/branding-kit.png",
	},
	{
		id: 3,
		label: "Eventos",
		title: "Combo para conferencias",
		brand: "P&P Custom",
		priceFrom: "Desde $999 MXN",
		details: "Gorras + libretas + pines",
		sizes: "Talla única · 6 colores",
		image: "/packages/conference-kit.png",
	},
	{
		id: 4,
		label: "Premium",
		title: "Set ejecutivo premium",
		brand: "P&P Custom",
		priceFrom: "Desde $2,499 MXN",
		details: "Sudadera + termo + mochila",
		sizes: "5 tallas · 3 colores",
		image: "/packages/executive-kit.png",
	},
];

export default function Page() {
	const { query } = useSearch();

	const isSearching = query.trim().length > 0;

	return (
		<div className="min-h-screen">
			{isSearching ? (
				<SearchResults query={query} />
			) : (
				<>
					<ProductGrid />

					<PackagesSection
						title="Paquetes para eventos"
						description="Combos pensados para graduaciones, bodas y eventos especiales."
						href="/catalogo/eventos"
						packages={packagesEventos}
					/>

					<PackagesSection
						title="Paquetes empresariales"
						description="Soluciones personalizadas para equipos, oficinas y marcas."
						href="/paquetes/empresas"
						packages={packagesEmpresas}
					/>

					<Image
						src="/flyers/flyer1.png"
						alt="flyer"
						width={1700}
						height={60}
						className="pt-10 pb-10"
					/>
				</>
			)}
		</div>
	);
}
