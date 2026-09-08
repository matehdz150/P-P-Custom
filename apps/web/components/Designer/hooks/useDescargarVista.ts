"use client";

import { useCallback } from "react";
import type { VistaActual } from "../VistaDeLaPrenda";

/**
 * Bajar la vista actual como PNG.
 *
 * VIVE APARTE PORQUE LO USAN LAS DOS PANTALLAS: la barra de abajo en escritorio
 * y la hoja de la previsualización en el teléfono. Estaba escrito dentro del
 * armazón de escritorio y copiarlo al móvil habría dejado la regla de la banda
 * —la parte que se puede equivocar en silencio— escrita en dos sitios.
 */
export function useDescargarVista(vista: VistaActual | null) {
	return useCallback(async () => {
		if (!vista) return;

		/* La banda manda si está: una foto de cilindro no se puede componer con
		   una homografía. Misma regla que en `exportarParaPedido` y en la vista;
		   se decide por la geometría de la FOTO y no por la forma de la
		   plantilla, que es el dato de más lejos.

		   Se importan al pulsar y no arriba: son los dos rasterizadores, y el
		   editor no tiene por qué cargarlos para quien nunca descarga. */
		const { banda } = vista;

		const png = banda
			? await import("@/lib/prenda/cilindro").then((m) =>
					m.componerCilindro({ ...vista, banda }),
				)
			: await import("@/lib/prenda/componer").then((m) =>
					m.componerPrenda(vista),
				);

		if (!png) return;

		/* Un enlace de usar y tirar. `showSaveFilePicker` no está en todos los
		   navegadores y aquí no hace falta elegir carpeta: se baja y ya. */
		const url = URL.createObjectURL(png);
		const enlace = document.createElement("a");
		enlace.href = url;
		enlace.download = `kustto-${vista.nombre}.png`
			.replace(/\s+/g, "-")
			.toLowerCase();
		enlace.click();
		URL.revokeObjectURL(url);
	}, [vista]);
}
