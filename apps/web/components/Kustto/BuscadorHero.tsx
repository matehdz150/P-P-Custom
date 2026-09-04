"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * El buscador de la portada.
 *
 * ES EL CTA DEL HERO, no un adorno: en un marketplace quien llega ya sabe qué
 * quiere, y hasta ahora tenía que pulsar un botón, esperar al catálogo y
 * entonces escribir. Esto se salta la pantalla de en medio.
 *
 * NO ES `BuscadorCatalogo`, aunque se parezcan. Aquel filtra en vivo una lista
 * que ya está cargada —vive dentro de `SearchProvider`, que aquí no existe—;
 * éste NAVEGA. Son dos comportamientos distintos con la misma pinta, y
 * mezclarlos habría metido el contexto del catálogo en la portada para nada.
 *
 * Va en `/catalogo?q=…`, que es el parámetro que `SearchContext` lee al
 * montar. Antes ese parámetro no lo leía nadie y los enlaces de la portada
 * caían en el catálogo sin filtrar.
 */

/** Lo que más se pide, para no arrancar de cero. */
const SUGERENCIAS = ["Para una boda", "Graduación", "Logo de mi empresa"];

export default function BuscadorHero() {
	const router = useRouter();
	const [texto, setTexto] = useState("");

	function buscar(termino: string) {
		const limpio = termino.trim();
		router.push(
			limpio ? `/catalogo?q=${encodeURIComponent(limpio)}` : "/catalogo",
		);
	}

	return (
		<div className="flex w-full flex-col items-center">
			{/* `search` envolviendo un `form` de verdad. El elemento es el que
			    marca la región de búsqueda —mejor que un `role="search"` a mano—,
			    y el `form` hace que el Enter busque sin atarlo y que el teclado
			    del teléfono enseñe "buscar" en vez de salto de línea. */}
			<search className="w-full">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						buscar(texto);
					}}
					className="mx-auto flex w-full max-w-[720px] items-center gap-2 rounded-full border-[1.5px] border-tinta/16 bg-white p-1.5 pl-5 shadow-[0_6px_24px_rgba(43,40,18,0.06)] focus-within:border-tinta/40"
				>
					<svg
						width="21"
						height="21"
						viewBox="0 0 24 24"
						fill="none"
						aria-hidden="true"
						className="shrink-0 text-tinta/40"
					>
						<circle
							cx="11"
							cy="11"
							r="7"
							stroke="currentColor"
							strokeWidth="1.8"
						/>
						<path
							d="m16.5 16.5 4 4"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
						/>
					</svg>

					<input
						type="search"
						value={texto}
						onChange={(e) => setTexto(e.target.value)}
						placeholder="Busca playeras, gorras, totes…"
						aria-label="Busca en el catálogo"
						className="min-w-0 flex-1 bg-transparent py-2 text-base text-tinta outline-none placeholder:text-tinta/42 md:text-[17px]"
					/>

					<button
						type="submit"
						className="inline-flex h-12 shrink-0 items-center rounded-full bg-tinta px-6 text-[15px] font-semibold text-lima md:h-[52px] md:px-7 md:text-base"
					>
						Buscar
					</button>
				</form>
			</search>

			<div className="flex flex-wrap justify-center gap-2 pt-4">
				{SUGERENCIAS.map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => buscar(s)}
						className="rounded-full border-[1.5px] border-tinta/14 px-4 py-2 text-sm text-tinta/70 transition-colors hover:border-tinta/40 hover:text-tinta"
					>
						{s}
					</button>
				))}
			</div>
		</div>
	);
}
