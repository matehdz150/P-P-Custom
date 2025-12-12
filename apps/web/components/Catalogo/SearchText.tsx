"use client";

import { Sora } from "next/font/google";
import { useSearch } from "@/Contexts/SearchContext";

const sora = Sora({
	subsets: ["latin"],
	weight: ["400", "600", "700"],
	display: "swap",
});

export default function SearchText({ mobile = false }: { mobile?: boolean }) {
	const { query } = useSearch();

	return (
		<div
			className={`
        ${sora.className} 
        ${mobile ? "mt-2" : "mt-6"}
      `}
		>
			{/* TÍTULO */}
			<h2
				className={`
          font-semibold text-[#2A2A26]
          ${mobile ? "text-xl leading-tight" : "text-xl"}
        `}
			>
				{query.length === 0 ? (
					<>Encuentra lo que necesitas</>
				) : (
					<>
						Resultados para <span className="text-orange-600">{query}</span>
					</>
				)}
			</h2>

			{/* SUBTÍTULO */}
			{query.length === 0 ? (
				<p
					className={`
            text-[#555]
            ${mobile ? "text-xs mt-1" : "text-sm mt-1"}
          `}
				>
					Explora una amplia variedad de productos personalizados.
				</p>
			) : (
				<p
					className={`
            text-[#555]
            ${mobile ? "text-xs mt-1" : "text-sm mt-1"}
          `}
				>
					Productos, categorías y recomendaciones según tu búsqueda.
				</p>
			)}
		</div>
	);
}
