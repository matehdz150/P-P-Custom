import { Circle, Ellipse, type FabricObject, Rect, Triangle } from "fabric";

/**
 * Crea un clipPath con la forma del área editable (rect / elipse / triángulo /
 * círculo legacy). Reemplaza la lógica duplicada Rect/Circle.
 *
 * SE RECORTA AL ÁREA MÁS EL SANGRADO, no al área. Y ahí está todo el asunto:
 * si el clip fuera el área exacta, fuera de ella no existiría ni un píxel, así
 * que ampliar el recorte al exportar sólo añadiría vacío. El sangrado sirve
 * porque el cliente PUEDE pintar en él —la guía del lienzo le dice que eso se
 * recorta— y el archivo de producción se lo lleva.
 *
 * El sangrado lo trae el propio objeto del área (`sangradoPx`, ver
 * `loadProductTemplate`). Sin él, cero: el comportamiento de siempre.
 */
export function makeAreaClip(
	area: FabricObject | null | undefined,
): FabricObject | undefined {
	if (!area) return undefined;

	const s = Number((area as { sangradoPx?: number }).sangradoPx ?? 0) || 0;

	let clip: FabricObject | undefined;

	if (area instanceof Rect) {
		clip = new Rect({
			left: area.left - s,
			top: area.top - s,
			width: area.width + s * 2,
			height: area.height + s * 2,
			absolutePositioned: true,
		});
	} else if (area instanceof Ellipse) {
		clip = new Ellipse({
			left: area.left - s,
			top: area.top - s,
			rx: area.rx + s,
			ry: area.ry + s,
			absolutePositioned: true,
		});
	} else if (area instanceof Triangle) {
		clip = new Triangle({
			left: area.left - s,
			top: area.top - s,
			width: area.width + s * 2,
			height: area.height + s * 2,
			absolutePositioned: true,
		});
	} else if (area instanceof Circle) {
		clip = new Circle({
			left: area.left - s,
			top: area.top - s,
			radius: area.radius + s,
			absolutePositioned: true,
		});
	}

	clip?.set({ selectable: false, evented: false });
	return clip;
}
