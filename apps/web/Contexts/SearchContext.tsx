"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface SearchContextType {
	query: string;
	setQuery: (q: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

/**
 * El término de búsqueda del catálogo.
 *
 * ARRANCA CON EL `?q=` DE LA URL, y eso no estaba: el estado empezaba en
 * cadena vacía y nadie miraba la dirección. Como los enlaces de la portada
 * llevan `?q=playera`, `?q=gorra`…, todos caían en el catálogo SIN filtrar y
 * con el buscador en blanco — el parámetro viajaba y no lo leía nadie.
 *
 * SE LEE DE `window.location`, NO CON `useSearchParams`. Se probó con el hook
 * y sale caro: en un export estático obliga a envolverlo en Suspense y Next
 * abandona el prerender de todo lo que hay dentro, así que `/catalogo` pasaba
 * a servirse como un cascarón vacío — justo la página que interesa que esté
 * indexada. Leerlo en un efecto deja el árbol prerenderizable y no cuesta
 * nada: el catálogo se filtra en el navegador de todos modos, porque los
 * productos también se piden desde ahí.
 *
 * Se lee al montar y a partir de ahí manda lo que se teclea. No se sincroniza
 * en las dos direcciones a propósito: escribir es un filtro en vivo sobre lo
 * que ya está cargado, y meter una entrada en el historial por cada letra
 * rompería el botón de atrás.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
	const [query, setQuery] = useState("");

	useEffect(() => {
		const desdeLaUrl = new URLSearchParams(window.location.search).get("q");
		if (desdeLaUrl) setQuery(desdeLaUrl);
	}, []);

	return (
		<SearchContext.Provider value={{ query, setQuery }}>
			{children}
		</SearchContext.Provider>
	);
}

export function useSearch() {
	const ctx = useContext(SearchContext);
	if (!ctx) throw new Error("useSearch must be used inside <SearchProvider>");
	return ctx;
}
