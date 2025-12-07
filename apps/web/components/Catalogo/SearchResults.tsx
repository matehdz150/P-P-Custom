"use client";

import { Sora } from "next/font/google";
import Image from "next/image";

// TEMPORAL: Productos mock para simular búsqueda
const mockProducts = [
	{
		id: 1,
		name: "Playera personalizada",
		category: "Ropa",
		price: "Desde $199",
		image: "/products/shirt.png",
	},
	{
		id: 2,
		name: "Termo con logo",
		category: "Accesorios",
		price: "Desde $249",
		image: "/products/bottle.png",
	},
	{
		id: 3,
		name: "Tote Bag estampada",
		category: "Bolsas",
		price: "Desde $149",
		image: "/products/totebag.png",
	},
];

const sora = Sora({
	subsets: ["latin"],
	weight: ["400", "600", "700"],
});

export default function SearchResults({ query }: { query: string }) {
	const search = query.toLowerCase().trim();

	// FILTRADO
	const results = mockProducts.filter(
		(p) =>
			p.name.toLowerCase().includes(search) ||
			p.category.toLowerCase().includes(search),
	);

	const hasResults = results.length > 0;

	return (
		<div className={`w-full mt-6 ${sora.className}`}>
			{/* Si NO hay resultados */}
			{!hasResults && (
				<div className="text-gray-500 text-sm mt-10">
					No encontramos productos relacionados con{" "}
					<span className="font-semibold">{query}</span>.
				</div>
			)}

			{/* GRID DE RESULTADOS */}
			{hasResults && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					{results.map((product) => (
						<div
							key={product.id}
							className="bg-white rounded-[0.2rem] border hover:shadow-md transition-shadow p-0 cursor-pointer"
						>
							{/* Imagen */}
							<div className="relative w-full aspect-[4/3] bg-[#f5f5f1] rounded-sm overflow-hidden">
								<Image
									src={product.image}
									alt={product.name}
									fill
									className="object-cover"
								/>
							</div>

							{/* Info */}
							<div className="mt-3 space-y-1">
								<h3 className="text-sm font-semibold">{product.name}</h3>
								<p className="text-xs text-gray-500">{product.category}</p>
								<p className="text-sm font-semibold mt-1">{product.price}</p>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
