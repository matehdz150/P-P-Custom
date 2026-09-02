"use client";

import type { Canvas, FabricObject } from "fabric";
import { useEffect, useState } from "react";

type Lados = Record<
	string,
	{ canvas: Canvas | null; editableAreas: FabricObject[] }
>;

/**
 * Si hay algo dibujado en cualquiera de los lados.
 *
 * No se puede deducir del estado de React: los objetos se añaden y se quitan
 * DENTRO del lienzo de Fabric, que no vuelve a renderizar nada de React al
 * hacerlo. Por eso se escuchan sus eventos y se recalcula.
 *
 * Las guías del área imprimible no cuentan como diseño: las pone el editor al
 * montarse y estarían ahí aunque nadie hubiera tocado nada.
 */
export function useHayDiseno(sides: Lados): boolean {
	const [hay, setHay] = useState(false);

	useEffect(() => {
		const lados = Object.values(sides).filter((l) => l.canvas);
		if (lados.length === 0) return;

		const recalcular = () => {
			setHay(
				lados.some((l) =>
					l.canvas
						?.getObjects()
						.some((objeto) => !l.editableAreas.includes(objeto)),
				),
			);
		};

		recalcular();

		const quitar = lados.map((l) => {
			const canvas = l.canvas as Canvas;
			canvas.on("object:added", recalcular);
			canvas.on("object:removed", recalcular);

			return () => {
				canvas.off("object:added", recalcular);
				canvas.off("object:removed", recalcular);
			};
		});

		return () => {
			for (const f of quitar) f();
		};
	}, [sides]);

	return hay;
}
