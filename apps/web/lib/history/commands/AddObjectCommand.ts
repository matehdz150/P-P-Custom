// lib/history/commands/AddObjectCommand.ts
import type { Canvas, FabricObject } from "fabric";
import type { Command } from "./Command";

export class AddObjectCommand implements Command {
	private object: FabricObject;

	constructor(object: FabricObject) {
		this.object = object;
	}

	do(canvas: Canvas) {
		// Evitar añadir duplicado por accidente
		if (!canvas.getObjects().includes(this.object)) {
			canvas.add(this.object);
		}
		canvas.requestRenderAll();
	}

	undo(canvas: Canvas) {
		canvas.remove(this.object);
		canvas.requestRenderAll();
	}
}
