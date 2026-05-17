import type { Canvas, FabricObject } from "fabric";
import type { Command } from "./Command";

// Mueve un objeto a un índice z específico dentro del canvas.
export class ReorderObjectCommand implements Command {
	private fromIndex = -1;

	constructor(
		private object: FabricObject,
		private toIndex: number,
	) {}

	do(canvas: Canvas) {
		this.fromIndex = canvas.getObjects().indexOf(this.object);
		canvas.moveObjectTo(this.object, this.toIndex);
		canvas.requestRenderAll();
	}

	undo(canvas: Canvas) {
		if (this.fromIndex < 0) return;
		canvas.moveObjectTo(this.object, this.fromIndex);
		canvas.requestRenderAll();
	}
}
