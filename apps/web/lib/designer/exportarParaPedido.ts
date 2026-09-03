"use client";

import type { Canvas, FabricObject } from "fabric";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { conDpi } from "@/lib/designer/dpi";
import type { ArchivoDeLado } from "@/lib/pedido/borrador";
import {
	exportarArteDeLado,
	exportarColocacion,
	exportarMiniaturaDelArte,
} from "./exportarArte";

/**
 * Saca del lienzo todo lo que hace falta para pedir.
 *
 * Vive aquí y no dentro de una pantalla porque lo usan DOS caminos —pedir
 * ahora y agregar al carrito— y es la parte más delicada del editor: quitar el
 * mockup sin dejar rastro, respetar los DPI del taller y escribirle la
 * resolución al PNG. Duplicarla sería tener dos versiones de eso.
 *
 * Es SÍNCRONA por dentro y pesada: bloquea el hilo mientras rinde. Quien la
 * llame debería haber pintado ya un aviso.
 */
export type LadosExportados = {
	archivos: ArchivoDeLado[];
	/** Sólo los objetos del cliente: las guías las repone el editor. */
	diseno: Record<string, object[]>;
};

type EstadoDeLado = { canvas: Canvas | null; editableAreas: FabricObject[] };

export async function exportarParaPedido(
	sides: Record<string, EstadoDeLado>,
	producto: DesignerProductTemplate,
): Promise<LadosExportados> {
	const conDiseno = Object.entries(sides).flatMap(([lado, estado]) => {
		const canvas = estado.canvas;
		if (!canvas) return [];

		const hayDiseno = canvas
			.getObjects()
			.some((o) => !estado.editableAreas.includes(o));

		return hayDiseno ? [{ lado, canvas, areas: estado.editableAreas }] : [];
	});

	if (conDiseno.length === 0) {
		throw new Error("Todavía no has puesto nada en la prenda.");
	}

	const archivos: ArchivoDeLado[] = [];

	for (const { lado, canvas, areas } of conDiseno) {
		const medidas = producto.printSides?.find((s) => s.sideKey === lado);

		const arte = exportarArteDeLado(lado, canvas, areas, {
			widthCm: medidas?.widthCm ?? 28,
			heightCm: medidas?.heightCm ?? 35,
			dpi: medidas?.dpi,
		});

		if (!arte) continue;

		const colocacion = exportarColocacion(canvas, areas);

		archivos.push({
			lado,
			/* Con su resolución escrita dentro. `toDataURL` no la pone, y sin ella
			   el archivo se abre a 72 dpi: 116 cm en vez de 28. */
			arte: await conDpi(arte.blob, arte.dpi),
			colocacion: colocacion?.blob ?? null,
			miniaturaArte: exportarMiniaturaDelArte(canvas, areas),
			miniaturaPrenda: colocacion?.dataUrl ?? null,
			anchoPx: arte.anchoPx,
			altoPx: arte.altoPx,
			dpi: arte.dpi,
		});
	}

	if (archivos.length === 0) {
		throw new Error("No encontramos nada dibujado que mandar.");
	}

	return {
		archivos,
		diseno: Object.fromEntries(
			conDiseno.map(({ lado, canvas, areas }) => [
				lado,
				canvas
					.getObjects()
					.filter((o) => !areas.includes(o))
					.map((o) => o.toObject()),
			]),
		),
	};
}
