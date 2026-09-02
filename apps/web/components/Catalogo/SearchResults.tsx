"use client";

import { useEffect, useState } from "react";
import { Sora } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { buscarEnCatalogo, type ResultadoDeBusqueda } from "@/lib/api/catalogo";
import { Skeleton } from "@/components/ui/skeleton";

const sora = Sora({
	subsets: ["latin"],
	weight: ["400", "600", "700"],
});

export default function SearchResults({ query }: { query: string }) {
	const [results, setResults] = useState<ResultadoDeBusqueda[]>([]);
	const [loading, setLoading] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);

	useEffect(() => {
		const q = query.trim();

		// Si no hay búsqueda, resetea todo
		if (!q) {
			setResults([]);
			setLoading(false);
			setHasSearched(false);
			return;
		}

		setLoading(true); // 👈 se activa inmediatamente
		setHasSearched(false);

		const timeout = setTimeout(async () => {
			try {
				const data = await buscarEnCatalogo(q);
				setResults(data);
			} finally {
				setLoading(false);
				setHasSearched(true); // 👈 búsqueda finalizada
			}
		}, 300); // debounce real

		return () => clearTimeout(timeout);
	}, [query]);

	const hasResults = results.length > 0;

	return (
		<div className={`w-full mt-6 ${sora.className}`}>
			{/* LOADING */}
			{loading && <SearchResultsSkeleton />}

			{/* NO RESULTS */}
			{hasSearched && !loading && !hasResults && (
				<div className="text-gray-500 text-sm mt-10">
					No encontramos resultados para{" "}
					<span className="font-semibold">{query}</span>.
				</div>
			)}

			{/* RESULTS */}
			{!loading && hasResults && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
					{results.map((item) => (
						<Link
							key={`${item.type}-${item.id}`}
							href={
								item.type === "product"
									? `/product/${item.id}`
									: `/package/${item.id}`
							}
							className="bg-white rounded-[0.2rem] border hover:shadow-md transition-shadow cursor-pointer block"
						>
							{/* IMAGE */}
							<div className="relative w-full aspect-[4/3] bg-[#f5f5f1] rounded-sm overflow-hidden">
								{item.image ? (
									<Image
										src={item.image}
										alt={item.name}
										fill
										className="object-cover"
									/>
								) : (
									<div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
										Sin imagen
									</div>
								)}
							</div>

							{/* INFO */}
							<div className="p-3 space-y-1">
								<h3 className="text-sm font-semibold">{item.name}</h3>

								<p className="text-xs text-gray-500 capitalize">
									{item.type === "product" ? "Producto" : "Paquete"}
								</p>

								{item.price != null && (
									<p className="text-sm font-semibold mt-1">
										Desde ${item.price.toLocaleString()}
									</p>
								)}
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}

/* =========================
   SKELETON
========================= */

function SearchResultsSkeleton() {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
			{Array.from({ length: 4 }).map((_, i) => (
				<div
					key={i}
					className="bg-white rounded-[0.2rem] border overflow-hidden"
				>
					{/* IMAGE */}
					<Skeleton className="w-full aspect-[4/3]" />

					{/* INFO */}
					<div className="p-3 space-y-2">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-3 w-1/3" />
						<Skeleton className="h-4 w-1/2 mt-2" />
					</div>
				</div>
			))}
		</div>
	);
}
