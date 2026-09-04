"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Zoom y desplazamiento de la vista "Probar".
 *
 * NO ES `useCanvasZoom`. Ése mueve la cámara de Fabric sobre el lienzo de
 * edición; aquí no hay lienzo, hay dos imágenes puestas una encima de otra con
 * CSS. Compartir el estado sería peor que duplicarlo: acercarse a mirar la
 * costura movería también el editor, y al volver a "Editar" el diseño estaría
 * desplazado sin que nadie lo tocara.
 *
 * EL DESPLAZAMIENTO VA EN PÍXELES DE PANTALLA y se aplica ANTES de la escala
 * (`translate` y luego `scale`), que es lo que hace que arrastrar mueva
 * exactamente lo que se arrastra. Al revés, con el zoom al 300 %, el dedo
 * recorrería un tercio de lo que recorre el puntero.
 */

const MINIMO = 0.5;
const MAXIMO = 4;
const PASO = 0.25;

export function useZoomDeVista() {
	const [zoom, setZoom] = useState(1);
	const [desplazamiento, setDesplazamiento] = useState({ x: 0, y: 0 });

	/* Espejo del desplazamiento para poder LEERLO al empezar a arrastrar. El
	   manejador se crea una vez y no ve el estado de después; leerlo colándose en
	   un `setDesplazamiento` que devuelve lo mismo funciona, pero es un
	   actualizador con efecto secundario y React puede llamarlo dos veces. */
	const actual = useRef(desplazamiento);
	actual.current = desplazamiento;

	const acercar = useCallback(
		() => setZoom((z) => Math.min(MAXIMO, +(z + PASO).toFixed(2))),
		[],
	);

	const alejar = useCallback(
		() =>
			setZoom((z) => {
				const nuevo = Math.max(MINIMO, +(z - PASO).toFixed(2));
				/* Volviendo al tamaño original se recentra: si no, alejar desde una
				   esquina deja la prenda pegada al borde y hay que arrastrarla de
				   vuelta a mano para volver a verla entera. */
				if (nuevo === 1) setDesplazamiento({ x: 0, y: 0 });
				return nuevo;
			}),
		[],
	);

	const reiniciar = useCallback(() => {
		setZoom(1);
		setDesplazamiento({ x: 0, y: 0 });
	}, []);

	/**
	 * Arrastrar para mover.
	 *
	 * Con captura del puntero: sin ella el arrastre se corta en cuanto el cursor
	 * sale del elemento —que pasa siempre, porque uno arrastra rápido— y la
	 * imagen se queda a medio camino.
	 */
	const alArrastrar = useCallback((evento: React.PointerEvent) => {
		// Sólo el botón principal: con el secundario se abre el menú del
		// navegador encima y el arrastre queda colgado.
		if (evento.button !== 0) return;

		evento.currentTarget.setPointerCapture(evento.pointerId);

		const desdeX = evento.clientX;
		const desdeY = evento.clientY;
		const inicial = actual.current;

		const mover = (e: PointerEvent) =>
			setDesplazamiento({
				x: inicial.x + (e.clientX - desdeX),
				y: inicial.y + (e.clientY - desdeY),
			});

		const soltar = () => {
			window.removeEventListener("pointermove", mover);
			window.removeEventListener("pointerup", soltar);
		};

		window.addEventListener("pointermove", mover);
		window.addEventListener("pointerup", soltar);
	}, []);

	return { zoom, desplazamiento, acercar, alejar, reiniciar, alArrastrar };
}
