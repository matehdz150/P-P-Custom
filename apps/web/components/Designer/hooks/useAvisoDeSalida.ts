"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Avisa antes de abandonar el editor con un diseño sin pedir.
 *
 * El diseño vive en el lienzo y en ningún otro sitio hasta que se aprieta
 * "Pedir": salir de aquí lo borra, y lo normal es que quien lo hace no lo
 * sepa hasta que ya pasó.
 *
 * Hay que cubrir dos salidas distintas y el navegador no deja tratarlas igual:
 *
 * - **Recargar o cerrar la pestaña**: sólo se puede pedir el diálogo nativo
 *   con `beforeunload`. El texto lo pone el navegador y no se puede cambiar;
 *   intentarlo es una vieja fuente de sustos publicitarios y por eso lo
 *   quitaron.
 * - **El botón de atrás**: no dispara `beforeunload` porque dentro de la app
 *   es una navegación de cliente. Se atrapa dejando una entrada de más en el
 *   historial, así que el primer "atrás" cae en la propia pantalla y da
 *   tiempo a preguntar.
 */
export function useAvisoDeSalida(activo: boolean) {
	const [preguntando, setPreguntando] = useState(false);

	/** Cuando ya se decidió salir, el guardia deja de estorbar. */
	const saliendo = useRef(false);

	useEffect(() => {
		if (!activo) return;

		const avisar = (e: BeforeUnloadEvent) => {
			if (saliendo.current) return;
			// `preventDefault` es lo único que hace falta desde hace años; el
			// mensaje propio lo ignoran todos los navegadores.
			e.preventDefault();
		};

		window.addEventListener("beforeunload", avisar);
		return () => window.removeEventListener("beforeunload", avisar);
	}, [activo]);

	useEffect(() => {
		if (!activo) return;

		/* La entrada de más. El historial queda [… , anterior, editor, señuelo]
		   y siempre se vuelve a dejar así: cada "atrás" quita el señuelo y aquí
		   se repone, de modo que la cuenta no se desmadra aunque se apriete diez
		   veces. Por eso salir de verdad son DOS pasos atrás. */
		window.history.pushState(null, "", window.location.href);

		const alVolver = () => {
			if (saliendo.current) return;
			window.history.pushState(null, "", window.location.href);
			setPreguntando(true);
		};

		window.addEventListener("popstate", alVolver);
		return () => window.removeEventListener("popstate", alVolver);
	}, [activo]);

	const salir = useCallback(() => {
		saliendo.current = true;
		setPreguntando(false);
		// Dos: el señuelo y la propia pantalla del editor.
		window.history.go(-2);
	}, []);

	const quedarse = useCallback(() => setPreguntando(false), []);

	return { preguntando, salir, quedarse };
}
