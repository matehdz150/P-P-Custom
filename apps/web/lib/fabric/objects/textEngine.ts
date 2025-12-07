import { type Canvas, IText, Rect } from "fabric";

export class TextEngine {
	private canvas: Canvas;

	constructor(canvas: Canvas) {
		this.canvas = canvas;
	}

	/**
	 * Añadir texto centrado dentro del área editable
	 */
	addText(area: Rect, text = "Texto aquí") {
		const t = new IText(text, {
			left: area.left + area.width / 2,
			top: area.top + area.height / 2,
			originX: "center",
			originY: "center",
			fontSize: 36,
			fill: "#000",
			fontFamily: "Inter",
			editable: true,
		});

		// clipPath para mantenerlo dentro del área
		t.clipPath = new Rect({
			left: area.left,
			top: area.top,
			width: area.width,
			height: area.height,
			absolutePositioned: true,
		});

		this.canvas.add(t);
		this.canvas.setActiveObject(t);
		this.canvas.requestRenderAll();

		return t;
	}

	/**
	 * Aplicar fuente al objeto activo
	 */
	setFont(fontName: string) {
		const obj = this.canvas.getActiveObject();
		if (!obj) return;

		if ("fontFamily" in obj) {
			obj.set("fontFamily", fontName);
			this.canvas.requestRenderAll();
		}
	}

	/**
	 * Cambiar propiedades del texto
	 */
	update(props: Partial<IText>) {
		const obj = this.canvas.getActiveObject();
		if (!obj || !(obj instanceof IText)) return;

		obj.set(props);
		this.canvas.requestRenderAll();
	}
}
