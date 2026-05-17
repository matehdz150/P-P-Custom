import { Circle, Ellipse, type FabricObject, Rect, Triangle } from "fabric";

// Crea un clipPath con la MISMA forma del área editable (rect / elipse /
// triángulo / círculo legacy). Reemplaza la lógica duplicada Rect/Circle.
export function makeAreaClip(
	area: FabricObject | null | undefined,
): FabricObject | undefined {
	if (!area) return undefined;

	let clip: FabricObject | undefined;

	if (area instanceof Rect) {
		clip = new Rect({
			left: area.left,
			top: area.top,
			width: area.width,
			height: area.height,
			absolutePositioned: true,
		});
	} else if (area instanceof Ellipse) {
		clip = new Ellipse({
			left: area.left,
			top: area.top,
			rx: area.rx,
			ry: area.ry,
			absolutePositioned: true,
		});
	} else if (area instanceof Triangle) {
		clip = new Triangle({
			left: area.left,
			top: area.top,
			width: area.width,
			height: area.height,
			absolutePositioned: true,
		});
	} else if (area instanceof Circle) {
		clip = new Circle({
			left: area.left,
			top: area.top,
			radius: area.radius,
			absolutePositioned: true,
		});
	}

	clip?.set({ selectable: false, evented: false });
	return clip;
}
