import type { Canvas } from "fabric";
import { Point } from "fabric";

export class CanvasZoomController {
	private canvas: Canvas;
	zoom = 1;
	minZoom = 0.3;
	maxZoom = 3;
	onZoomChange?: (zoom: number) => void;

	constructor(canvas: Canvas) {
		this.canvas = canvas;
		this.registerWheelZoom();
	}

	private registerWheelZoom() {
		this.canvas.on("mouse:wheel", (opt) => {
			const event = opt.e as WheelEvent;
			event.preventDefault();

			const direction = event.deltaY > 0 ? -1 : 1;
			const newZoom = this.zoom + direction * 0.05;

			this.setZoom(newZoom);

			const pointer = this.canvas.getPointer(event);
			const point = new Point(pointer.x, pointer.y);

			this.canvas.zoomToPoint(point, this.zoom);
			this.canvas.requestRenderAll();
		});
	}

	setZoomCallback(cb: (zoom: number) => void) {
		this.onZoomChange = cb;
	}

	setZoom(z: number) {
		this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, z));
		this.canvas.setZoom(this.zoom);

		if (this.onZoomChange) this.onZoomChange(this.zoom);
		this.canvas.requestRenderAll();
	}

	zoomIn() {
		this.setZoom(this.zoom + 0.1);
	}

	zoomOut() {
		this.setZoom(this.zoom - 0.1);
	}
}
