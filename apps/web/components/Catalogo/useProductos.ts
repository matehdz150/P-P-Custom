"use client";

import { useEffect, useState } from "react";
import { type Category, getCategories } from "@/lib/api/categories";
import {
	getProductsByCategory,
	type ProductFromCategory,
} from "@/lib/api/search";

/**
 * Carga las categorías y los productos del catálogo.
 *
 * `categoria` es el id de una categoría o "todo". Como la API expone los
 * productos por categoría, "todo" pide todas en paralelo y las junta sin
 * repetir: un mismo producto puede estar en más de una.
 */
export function useProductos(categoria: string) {
	const [categorias, setCategorias] = useState<Category[]>([]);
	const [categoriasListas, setCategoriasListas] = useState(false);
	const [productos, setProductos] = useState<ProductFromCategory[]>([]);
	const [cargando, setCargando] = useState(true);

	useEffect(() => {
		getCategories()
			.then(setCategorias)
			.catch(() => setCategorias([]))
			.finally(() => setCategoriasListas(true));
	}, []);

	useEffect(() => {
		if (!categoriasListas) return;

		let vigente = true;
		setCargando(true);

		async function cargar() {
			try {
				const listas =
					categoria === "todo"
						? await Promise.all(
								categorias.map((c) =>
									getProductsByCategory(c.id).catch(() => []),
								),
							)
						: [await getProductsByCategory(categoria)];

				if (!vigente) return;

				const porId = new Map<string, ProductFromCategory>();
				for (const p of listas.flat()) porId.set(p.id, p);
				setProductos([...porId.values()]);
			} catch {
				if (vigente) setProductos([]);
			} finally {
				if (vigente) setCargando(false);
			}
		}

		cargar();
		return () => {
			vigente = false;
		};
	}, [categoria, categorias, categoriasListas]);

	return { categorias, productos, cargando };
}
