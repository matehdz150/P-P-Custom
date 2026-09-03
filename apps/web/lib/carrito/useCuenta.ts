"use client";

import { useEffect, useState } from "react";
import { EVENTO_CARRITO, leerLocal, piezasDe } from "./almacen";

/**
 * Cuántas piezas hay en el carrito, para la cabecera.
 *
 * NO usa `useCarrito`: ese sincroniza con la cuenta al montar, y la cabecera
 * está en todas las páginas — sería una llamada a la API por cada visita para
 * enseñar un número. Aquí sólo se lee el navegador, que es donde el carrito
 * siempre está al día.
 *
 * ARRANCA EN CERO Y SE LLENA DESPUÉS DE MONTAR, a propósito. El sitio es
 * estático y se sirve por CloudFront: si el contador se pintara al
 * pre-renderizar, se cachearía el número de una persona y se le enseñaría a
 * las demás. Además, leer `localStorage` durante el render rompería la
 * hidratación.
 */
export function useCuentaDelCarrito(): number {
	const [piezas, setPiezas] = useState(0);

	useEffect(() => {
		const leer = () =>
			setPiezas(leerLocal().reduce((n, a) => n + piezasDe(a), 0));

		leer();

		// El propio, para esta pestaña; `storage`, para las demás.
		window.addEventListener(EVENTO_CARRITO, leer);
		window.addEventListener("storage", leer);

		return () => {
			window.removeEventListener(EVENTO_CARRITO, leer);
			window.removeEventListener("storage", leer);
		};
	}, []);

	return piezas;
}
