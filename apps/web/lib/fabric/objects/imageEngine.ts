import { type Canvas, FabricImage, Rect } from "fabric";

export class ImageEngine {
	private canvas: Canvas;

	constructor(canvas: Canvas) {
		this.canvas = canvas;
	}

	/**
	 * Insertar imagen y ajustarla dentro del área editable
	 */
	async addImage(file: File, area: Rect) {
		const url = URL.createObjectURL(file);
		const img = await FabricImage.fromURL(url);

		// escala automática para que quepa en el área editable
		const width = img.width ?? area.width;
		const height = img.height ?? area.height;
		const scale = Math.min(
			(area.width * 0.9) / width,
			(area.height * 0.9) / height,
		);

		img.scale(scale);

		img.originX = "center";
		img.originY = "center";
		img.left = area.left + area.width / 2;
		img.top = area.top + area.height / 2;

		// clip para evitar que sobresalga
		img.clipPath = new Rect({
			left: area.left,
			top: area.top,
			width: area.width,
			height: area.height,
			absolutePositioned: true,
		});

		this.canvas.add(img);
		this.canvas.setActiveObject(img);
		this.canvas.requestRenderAll();

		return img;
	}
}
