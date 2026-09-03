"use client";

import { useCallback, useEffect, useState } from "react";

const CLAVE = "kustto:favoritos";
const EVENTO = "kustto:favoritos-cambio";

function leer(): string[] {
	if (typeof window === "undefined") return [];
	try {
		const valor = JSON.parse(localStorage.getItem(CLAVE) ?? "[]");
		return Array.isArray(valor)
			? valor.filter((id): id is string => typeof id === "string")
			: [];
	} catch {
		return [];
	}
}

export function useFavoritos() {
	const [ids, setIds] = useState<string[]>([]);
	const [listo, setListo] = useState(false);

	useEffect(() => {
		const actualizar = () => setIds(leer());
		actualizar();
		setListo(true);
		window.addEventListener(EVENTO, actualizar);
		window.addEventListener("storage", actualizar);
		return () => {
			window.removeEventListener(EVENTO, actualizar);
			window.removeEventListener("storage", actualizar);
		};
	}, []);

	const alternar = useCallback((id: string) => {
		const actuales = leer();
		const siguientes = actuales.includes(id)
			? actuales.filter((actual) => actual !== id)
			: [...actuales, id];
		localStorage.setItem(CLAVE, JSON.stringify(siguientes));
		setIds(siguientes);
		window.dispatchEvent(new Event(EVENTO));
	}, []);

	return {
		ids,
		listo,
		alternar,
		esFavorito: (id: string) => ids.includes(id),
	};
}
