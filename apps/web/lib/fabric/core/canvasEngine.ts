import { ImageEngine } from "../objects/imageEngine";
import { TextEngine } from "../objects/textEngine";
import type { ProductDefinition } from "../product/prodcutEngine";
import { ProductRenderer } from "../product/productRenderer";
import { CanvasCore } from "./canvasCore";
import { CanvasPanController } from "./canvasPan";
import { CanvasZoomController } from "./canvasZoom";
import { DesignStateManager } from "./designState";
import { KeyboardController } from "./keyboardController";

export class CanvasEngine {
	core: CanvasCore;
	pan: CanvasPanController;
	zoom: CanvasZoomController;
	products: ProductRenderer;
	text: TextEngine;
	images: ImageEngine;
	keyboard: KeyboardController;

	designState = new DesignStateManager();
	currentSide: "front" | "back" = "front";
	currentProduct: ProductDefinition | null = null;

	constructor(el: HTMLCanvasElement) {
		this.core = new CanvasCore(el);
		this.pan = new CanvasPanController(this.core.canvas);
		this.zoom = new CanvasZoomController(this.core.canvas);
		this.products = new ProductRenderer(this.core.canvas);
		this.text = new TextEngine(this.core.canvas);
		this.images = new ImageEngine(this.core.canvas);
		this.keyboard = new KeyboardController(this.core.canvas);
	}

	/** Cargar producto por primera vez */
	async loadProduct(product: ProductDefinition, side: "front" | "back") {
		const firstLoad = this.currentProduct === null; // ⭐ detectar si es primera vez

		this.currentProduct = product;
		this.currentSide = side;

		// 1. Cargar mockup (esto siempre)
		await this.products.load(product, side);

		// 2. Solo cargar diseño si NO es la primera vez
		if (!firstLoad) {
			await this.designState.load(side, this.core.canvas);
		}

		// 3. Render final
		this.core.canvas.renderAll();
		return true;
	}

	/** Cambiar entre lados con guardado automático */
	async switchSide(side: "front" | "back") {
		if (!this.currentProduct) return;

		// 1. Guardar diseño actual
		this.designState.save(this.currentSide, this.core.canvas);

		// 2. Cambiar lado
		this.currentSide = side;

		// 3. Cargar mockup del lado primero
		await this.products.load(this.currentProduct, side);

		// 4. Cargar solo objetos del usuario
		await this.designState.load(side, this.core.canvas);
	}

	dispose() {
		this.keyboard.dispose();
	}
}
