import type { Canvas } from "fabric";
import { FabricImage, Rect } from "fabric";
import type { EditableAreaDef, ProductDefinition } from "../core/productEngine";

// almacenamiento interno seguro para editableArea
const editableAreaStore = new WeakMap<Canvas, Rect | undefined>();

export function getEditableArea(canvas: Canvas): Rect | undefined {
	return editableAreaStore.get(canvas);
}

export class ProductRenderer {
	private canvas: Canvas;
	editableAreas: Rect[] = [];

	constructor(canvas: Canvas) {
		this.canvas = canvas;
	}

	async load(product: ProductDefinition, side: "front" | "back") {
		await this.loadMockup(product, side);
		this.loadAreas(product, side);
	}

	private async loadMockup(product: ProductDefinition, side: "front" | "back") {
		const url = product.mockups[side];
		const img = await FabricImage.fromURL(url);

		img.scaleToWidth(700);
		img.originX = "center";
		img.originY = "center";
		img.left = this.canvas.getWidth() / 2;
		img.top = this.canvas.getHeight() / 2;
		img.selectable = false;

		img.excludeFromExport = true;

		this.canvas.backgroundImage = img;
	}

	private loadAreas(product: ProductDefinition, side: "front" | "back") {
		// Remove previous editable areas
		this.editableAreas.forEach((r) => {
			this.canvas.remove(r);
		});
		this.editableAreas = [];

		const defs = product.editableAreas[side];

		defs.forEach((cfg: EditableAreaDef) => {
			const rect = new Rect({
				left: cfg.left,
				top: cfg.top,
				width: cfg.width,
				height: cfg.height,
				fill: "rgba(0,0,0,0.05)",
				selectable: false,
			});

			rect.excludeFromExport = true;

			this.canvas.add(rect);
			this.editableAreas.push(rect);
		});

		// Guardamos editableArea SIN modificar tipos internos de Canvas
		editableAreaStore.set(this.canvas, this.editableAreas[0]);
	}
}
