import { Canvas } from "fabric";

export class CanvasCore {
	canvas: Canvas;

	constructor(el: HTMLCanvasElement) {
		this.canvas = new Canvas(el, {
			width: 1200,
			height: 750,
			selection: true,
		});

		this.canvas.backgroundColor = "#f2f3ea";
	}
}
