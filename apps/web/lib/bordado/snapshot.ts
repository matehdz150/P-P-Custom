"use client";

import type { EmbroideryDesign } from "@kustto/bordado";
import type { Canvas, FabricObject } from "fabric";
import { capturar } from "./capturar";
import { preparar } from "./preparar";

/**
 * Capturar y preparar de un tirón, en el hilo que llame.
 *
 * SE CONSERVA PARA LO QUE NO ES EL EDITOR: pruebas, y cualquier sitio donde
 * bloquear un segundo no importe. El editor NO debe usar esto —usa
 * `crearClienteDeBordado`, que hace lo mismo en un worker— porque aquí la
 * preparación corre en el hilo de quien llama y son segundos sin scroll.
 */
export { BordadoRechazado } from "./preparar";

export async function snapshotEmbroideryDesign(input: {
	canvas: Canvas;
	areas: FabricObject[];
	productId: string;
	sideId: string;
	widthMm: number;
	heightMm: number;
}): Promise<EmbroideryDesign> {
	const { solicitud } = await capturar({ ...input, revision: 0 });
	return preparar(solicitud).design;
}
