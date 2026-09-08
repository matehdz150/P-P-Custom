"use client";

import type { ArticuloDeCarrito } from "@/lib/carrito/almacen";

const CLAVE = "kustto.eventos-disenos";

type DisenosDeEventos = Record<string, ArticuloDeCarrito>;

function llave(codigo: string, itemId: string) {
	return `${codigo}:${itemId}`;
}

function leerTodos(): DisenosDeEventos {
	if (typeof window === "undefined") return {};
	try {
		const valor = JSON.parse(localStorage.getItem(CLAVE) ?? "{}");
		return valor && typeof valor === "object" && !Array.isArray(valor)
			? valor
			: {};
	} catch {
		return {};
	}
}

export function leerDisenoDeEvento(codigo: string, itemId: string) {
	return leerTodos()[llave(codigo, itemId)] ?? null;
}

export function guardarDisenoDeEvento(
	codigo: string,
	itemId: string,
	articulo: ArticuloDeCarrito,
) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(
			CLAVE,
			JSON.stringify({ ...leerTodos(), [llave(codigo, itemId)]: articulo }),
		);
	} catch {
		throw new Error("No pudimos conservar el diseño en este navegador.");
	}
}

export function rutaDeEvento(codigo: string) {
	return `/evento?codigo=${encodeURIComponent(codigo)}`;
}
