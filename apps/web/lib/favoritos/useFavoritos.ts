"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	getFavoritosDeLaCuenta,
	guardarFavoritosEnLaCuenta,
} from "@/lib/api/cuenta";
import { leerSesion } from "@/lib/auth/comprador";

/**
 * Los favoritos, con sus dos mitades.
 *
 * Es el mismo trato que el carrito: SIEMPRE se escribe en el navegador, con o
 * sin sesión, y por eso el corazón responde al instante y no depende de la
 * red. Cuando hay sesión se manda además a la cuenta, y ESO puede fallar sin
 * consecuencias — lo que se pierde es verlos desde otro aparato, no los
 * favoritos.
 *
 * AL ENTRAR GANA LA UNIÓN, no lo más nuevo. Quien guardó cosas sin haber
 * entrado no las pierde por identificarse, y lo que tenía guardado desde el
 * teléfono tampoco. Con dos listas de ids eso es juntarlas y quitar
 * repetidos; por eso el servidor guarda la lista entera y no un ítem por
 * producto.
 *
 * LO QUE LA UNIÓN CUESTA, y se acepta a sabiendas: quitar un favorito en el
 * teléfono y luego abrir el portátil que todavía lo tenía lo resucita. La
 * alternativa —que gane el más reciente— haría que entrar en un aparato nuevo
 * borrase lo que se guardó sin sesión, que es peor y menos recuperable: un
 * favorito revivido se vuelve a quitar de un clic.
 */

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

function escribir(ids: string[]) {
	try {
		localStorage.setItem(CLAVE, JSON.stringify(ids));
	} catch {
		// Sin espacio no se puede hacer gran cosa: con sesión, la cuenta lo
		// tiene igual. Se avisa al log en vez de romper la pantalla.
		console.warn("No cupieron los favoritos en el navegador.");
	}
	window.dispatchEvent(new Event(EVENTO));
}

export function useFavoritos() {
	const [ids, setIds] = useState<string[]>([]);
	const [listo, setListo] = useState(false);

	/**
	 * Si esta pestaña ya fundió con la cuenta.
	 *
	 * Sin esto, cada `alternar` mandaría a la nube una lista que quizá todavía
	 * no incluye lo que había guardado en la cuenta, y el primer clic borraría
	 * los favoritos de los otros aparatos.
	 */
	const fundido = useRef(false);

	useEffect(() => {
		let vigente = true;

		// Lo del navegador manda desde el primer instante: es lo que hace que el
		// corazón ya esté pintado antes de que la red conteste.
		const local = leer();
		setIds(local);
		setListo(true);

		const escucha = () => setIds(leer());
		window.addEventListener(EVENTO, escucha);
		window.addEventListener("storage", escucha);

		if (leerSesion()) {
			getFavoritosDeLaCuenta()
				.then(({ ids: remotos }) => {
					if (!vigente) return;

					const junto = [...new Set([...(remotos ?? []), ...leer()])];
					fundido.current = true;

					setIds(junto);
					escribir(junto);

					// Sólo se devuelve si la fusión aportó algo: si son iguales,
					// escribir otra vez es una llamada que no cambia nada.
					if (junto.length !== (remotos ?? []).length) {
						guardarFavoritosEnLaCuenta(junto).catch(() => {});
					}
				})
				.catch(() => {
					// La cuenta no contestó. Se sigue con lo del navegador y NO se
					// marca como fundido: así un clic después no pisa lo de la nube
					// con una lista que puede estar incompleta.
				});
		}

		return () => {
			vigente = false;
			window.removeEventListener(EVENTO, escucha);
			window.removeEventListener("storage", escucha);
		};
	}, []);

	const alternar = useCallback((id: string) => {
		const actuales = leer();
		const siguientes = actuales.includes(id)
			? actuales.filter((actual) => actual !== id)
			: [...actuales, id];

		escribir(siguientes);
		setIds(siguientes);

		// A la cuenta sólo cuando ya se fundió: antes, mandar podría borrar lo
		// que hay guardado en otro aparato y todavía no hemos leído.
		if (leerSesion() && fundido.current) {
			guardarFavoritosEnLaCuenta(siguientes).catch(() => {});
		}
	}, []);

	return {
		ids,
		listo,
		alternar,
		esFavorito: (id: string) => ids.includes(id),
	};
}
