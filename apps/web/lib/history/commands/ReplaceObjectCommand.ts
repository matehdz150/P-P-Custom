import type { Canvas, FabricObject } from "fabric";
import type { Command } from "./Command";

// Replaces oldObj with newObj on the canvas, preserving layer order.
export class ReplaceObjectCommand implements Command {
	constructor(
		private oldObj: FabricObject,
		private newObj: FabricObject,
	) {}

	do(canvas: Canvas) {
		const objs = canvas.getObjects();
		const idx = objs.indexOf(this.oldObj);
		canvas.remove(this.oldObj);
		if (idx >= 0) {
			canvas.insertAt(idx, this.newObj);
		} else {
			canvas.add(this.newObj);
		}
		canvas.setActiveObject(this.newObj);
		canvas.requestRenderAll();
	}

	undo(canvas: Canvas) {
		const objs = canvas.getObjects();
		const idx = objs.indexOf(this.newObj);
		canvas.remove(this.newObj);
		if (idx >= 0) {
			canvas.insertAt(idx, this.oldObj);
		} else {
			canvas.add(this.oldObj);
		}
		canvas.setActiveObject(this.oldObj);
		canvas.requestRenderAll();
	}
}
