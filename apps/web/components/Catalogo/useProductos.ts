"use client";

import { useEffect, useMemo, useState } from "react";
import {
	type CategoriaPublica,
	getCatalogo,
	getCategoriasPublicas,
	type ProductoDeCatalogo,
} from "@/lib/api/catalogo";

/**
 * Carga las categorías y los productos del catálogo.
 *
 * `categoria` es el id de una categoría o "todo". Ahora el catálogo entero
 * llega en UNA petición y la categoría se aplica aquí: antes se pedían los
 * productos categoría por categoría —tantas peticiones como categorías— y se
 * juntaban sin repetir, porque la API vieja sólo sabía servirlos así.
 *
 * El catálogo se pide una sola vez y se queda: cambiar de categoría es
 * filtrar una lista que ya está en memoria, no volver a la red.
 */
export function useProductos(categoria: string) {
	const [categorias, setCategorias] = useState<CategoriaPublica[]>([]);
	const [todos, setTodos] = useState<ProductoDeCatalogo[]>([]);
	const [cargando, setCargando] = useState(true);

	useEffect(() => {
		let vigente = true;

		Promise.all([
			getCatalogo().catch(() => []),
			getCategoriasPublicas().catch(() => []),
		]).then(([productos, cats]) => {
			if (!vigente) return;
			setTodos(productos);
			setCategorias(cats);
			setCargando(false);
		});

		return () => {
			vigente = false;
		};
	}, []);

	const productos = useMemo(
		() =>
			categoria === "todo"
				? todos
				: todos.filter((p) => p.categoryIds?.includes(categoria)),
		[todos, categoria],
	);

	return { categorias, productos, cargando };
}
