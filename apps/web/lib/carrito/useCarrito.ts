"use client";

import { useCallback, useEffect, useState } from "react";
import {
	getCarritoDeLaCuenta,
	guardarCarritoEnLaCuenta,
	vaciarCarritoDeLaCuenta,
} from "@/lib/api/cuenta";
import { leerSesion } from "@/lib/auth/comprador";
import {
	type ArticuloDeCarrito,
	fundir,
	guardarLocal,
	leerLocal,
	MAXIMO_ARTICULOS,
} from "./almacen";

/**
 * El carrito, con sus dos mitades.
 *
 * Siempre se escribe en el navegador, con o sin sesión: es lo que hace que
 * agregar sea instantáneo y que no dependa de la red. Cuando hay sesión, se
 * manda además a la cuenta, y ESO puede fallar sin consecuencias — lo que se
 * pierde es poder verlo desde otro aparato, no el carrito.
 *
 * Al montar con sesión se funden los dos lados. Gana la unión: quien agregó
 * algo sin haber entrado no lo pierde por identificarse.
 */
export function useCarrito() {
	const [articulos, setArticulos] = useState<ArticuloDeCarrito[]>([]);
	const [cargando, setCargando] = useState(true);

	useEffect(() => {
		let vigente = true;

		async function arrancar() {
			const local = leerLocal();

			if (!leerSesion()) {
				if (vigente) {
					setArticulos(local);
					setCargando(false);
				}
				return;
			}

			try {
				const { articulos: remoto } = await getCarritoDeLaCuenta();
				const junto = fundir(local, remoto ?? []);

				if (!vigente) return;

				setArticulos(junto);
				guardarLocal(junto);

				// Sólo se devuelve si la fusión aportó algo: si son iguales, escribir
				// otra vez es una llamada que no cambia nada.
				if (junto.length !== (remoto ?? []).length) {
					await guardarCarritoEnLaCuenta(junto).catch(() => {});
				}
			} catch {
				// Sin cuenta alcanzable, el carrito del navegador sigue sirviendo.
				if (vigente) setArticulos(local);
			} finally {
				if (vigente) setCargando(false);
			}
		}

		arrancar();

		return () => {
			vigente = false;
		};
	}, []);

	/** Escribe en las dos mitades. La cuenta puede fallar; el navegador no. */
	const escribir = useCallback((siguiente: ArticuloDeCarrito[]) => {
		setArticulos(siguiente);
		guardarLocal(siguiente);

		if (leerSesion()) {
			guardarCarritoEnLaCuenta(siguiente).catch(() => {
				console.warn("No pudimos guardar el carrito en tu cuenta.");
			});
		}
	}, []);

	const agregar = useCallback(
		(articulo: ArticuloDeCarrito) => {
			const actuales = leerLocal();

			if (actuales.length >= MAXIMO_ARTICULOS) {
				throw new Error(
					`El carrito no admite más de ${MAXIMO_ARTICULOS} artículos.`,
				);
			}

			escribir([...actuales, articulo]);
		},
		[escribir],
	);

	const quitar = useCallback(
		(id: string) => {
			escribir(leerLocal().filter((a) => a.id !== id));
		},
		[escribir],
	);

	const cambiarTallas = useCallback(
		(id: string, tallas: { size: string; piezas: number }[]) => {
			escribir(
				leerLocal().map((a) =>
					a.id === id
						? { ...a, tallas, agregadoEn: Date.now() }
						: a,
				),
			);
		},
		[escribir],
	);

	const vaciar = useCallback(() => {
		setArticulos([]);
		guardarLocal([]);
		if (leerSesion()) vaciarCarritoDeLaCuenta().catch(() => {});
	}, []);

	return { articulos, cargando, agregar, quitar, cambiarTallas, vaciar };
}
