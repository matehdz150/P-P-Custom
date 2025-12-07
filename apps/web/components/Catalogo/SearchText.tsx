"use client";

import { Sora } from "next/font/google";
import { useSearch } from "@/Contexts/SearchContext";

const sora = Sora({
	subsets: ["latin"],
	weight: ["400", "600", "700"],
	display: "swap",
});

export default function SearchText() {
	const { query } = useSearch();

	return (
		<div className={`${sora.className} mt-6`}>
			<h2 className="text-xl font-semibold text-[#2A2A26]">
				{query.length === 0 ? (
					<>Encuentra lo que necesitas</>
				) : (
					<>
						Resultados para <span className="text-orange-600">{query}</span>
					</>
				)}
			</h2>

			{/* Subtítulo opcional */}
			{query.length === 0 ? (
				<p className="text-sm text-[#555] mt-1">
					Explora una amplia variedad de productos personalizados.
				</p>
			) : (
				<p className="text-sm text-[#555] mt-1">
					Productos, categorías y recomendaciones según tu búsqueda.
				</p>
			)}
		</div>
	);
}
