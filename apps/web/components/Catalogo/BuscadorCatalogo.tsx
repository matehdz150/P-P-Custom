"use client";

import { useSearch } from "@/Contexts/SearchContext";

/**
 * El buscador del catálogo: una línea de texto con su filete, no una caja.
 * Es el mismo en la portada, en el listado y en las subrutas.
 */
export default function BuscadorCatalogo({
	sufijo,
	className = "",
}: {
	/** Lo que va a la derecha del filete, p. ej. el conteo de productos. */
	sufijo?: React.ReactNode;
	className?: string;
}) {
	const { query, setQuery } = useSearch();

	return (
		<label
			className={`flex items-center gap-3 border-b-[1.5px] border-tinta pb-3 md:gap-4 md:pb-4 ${className}`}
		>
			<svg
				width="19"
				height="19"
				viewBox="0 0 24 24"
				fill="none"
				aria-hidden="true"
				className="shrink-0 md:h-[21px] md:w-[21px]"
			>
				<circle
					cx="10.8"
					cy="10.8"
					r="6.8"
					stroke="currentColor"
					strokeWidth="1.8"
				/>
				<path
					d="M15.8 15.8L20 20"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				/>
			</svg>

			<input
				type="search"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Busca playeras, gorras, totes, termos…"
				aria-label="Buscar en el catálogo"
				className="min-w-0 flex-1 bg-transparent text-[17px] tracking-[-0.3px] text-tinta outline-none placeholder:text-tinta/38 md:text-2xl md:tracking-[-0.5px]"
			/>

			{sufijo}
		</label>
	);
}
