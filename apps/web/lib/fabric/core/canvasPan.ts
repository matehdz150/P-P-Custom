import type { Canvas } from "fabric";

export class CanvasPanController {
	private canvas: Canvas;
	isPanning = false;
	lastX = 0;
	lastY = 0;

	constructor(canvas: Canvas) {
		this.canvas = canvas;
		this.registerEvents();
	}

	private registerEvents() {
		this.canvas.on("mouse:down", (opt) => {
			if (!this.isPanning) return;
			const evt = opt.e as MouseEvent;
			this.lastX = evt.clientX;
			this.lastY = evt.clientY;
			this.canvas.setCursor("grabbing");
		});

		this.canvas.on("mouse:move", (opt) => {
			if (!this.isPanning) return;
			if (!(opt.e as MouseEvent).buttons) return;

			const evt = opt.e as MouseEvent;
			const vpt = this.canvas.viewportTransform;
			if (!vpt) return;

			vpt[4] += evt.clientX - this.lastX;
			vpt[5] += evt.clientY - this.lastY;

			this.canvas.requestRenderAll();

			this.lastX = evt.clientX;
			this.lastY = evt.clientY;
		});

		this.canvas.on("mouse:up", () => {
			if (this.isPanning) {
				this.canvas.setCursor("grab");
			}
		});
	}

	enablePan() {
		this.isPanning = true;
		this.canvas.defaultCursor = "grab";
	}

	disablePan() {
		this.isPanning = false;
		this.canvas.defaultCursor = "default";
	}
}
