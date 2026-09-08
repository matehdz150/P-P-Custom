"use client";

import type { Canvas, FabricObject } from "fabric";
import { useEffect } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { platearObjeto } from "@/lib/impresion/plateado";
import { salidaDelLado } from "@/lib/impresion/tecnicas";

/**
 * Deja en plateado todo lo que entre a un lado de grabado.
 *
 * VA EN EL LIENZO Y NO EN CADA HERRAMIENTA. Un diseño entra por muchas
 * puertas —subir una imagen, escribir un texto en escritorio, escribirlo en el
 * teléfono, poner una forma— y engancharlo en cada una sería repetir la regla
 * cinco veces y olvidarla en la sexta que se añada. Escuchando al lienzo, lo
 * que entre por donde entre sale plateado.
 *
 * Sólo lo que se ve: el archivo que va al taller es un vector de trazos y el
 * color nunca formó parte de él.
 */
export function usePlateadoDeGrabado(
	getCanvas: () => Canvas | null,
	sideKey: string,
) {
	const { tecnicas } = useDesigner();
	const esGrabado = salidaDelLado({ tecnica: tecnicas[sideKey] }) === "vector";

	useEffect(() => {
		const canvas = getCanvas();
		if (!canvas || !esGrabado) return;

		/**
		 * Qué NO se tiñe.
		 *
		 * El mockup de la prenda y las guías del área imprimible son objetos del
		 * lienzo como cualquier otro, pero no son el grabado: son el andamio que
		 * dice dónde se puede dibujar.
		 *
		 * Se mira la MARCA que lleva el objeto, no la lista de áreas registrada:
		 * esa lista se publica después de añadir las guías al lienzo, así que
		 * consultándola llegaban tarde y se plateaban igual. Ya pasó.
		 */
		const esAndamio = (objeto: FabricObject) =>
			objeto === canvas.backgroundImage ||
			(objeto as FabricObject & { esAndamio?: boolean }).esAndamio === true;

		const alEntrar = (e: { target?: FabricObject }) => {
			const objeto = e.target;
			if (!objeto || esAndamio(objeto)) return;
			platearObjeto(objeto);
			canvas.requestRenderAll();
		};

		// Lo que ya estuviera puesto —un diseño recuperado del carrito— también.
		for (const objeto of canvas.getObjects())
			if (!esAndamio(objeto)) platearObjeto(objeto);
		canvas.requestRenderAll();

		canvas.on("object:added", alEntrar);
		return () => {
			canvas.off("object:added", alEntrar);
		};
	}, [getCanvas, esGrabado]);
}
