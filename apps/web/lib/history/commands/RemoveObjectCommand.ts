// lib/history/commands/RemoveObjectCommand.ts
import type { Canvas, FabricObject } from "fabric";
import type { Command } from "./Command";

export class RemoveObjectCommand implements Command {
	private object: FabricObject;

	constructor(object: FabricObject) {
		this.object = object;
	}

	do(canvas: Canvas) {
		canvas.remove(this.object);
		canvas.discardActiveObject();
		canvas.requestRenderAll();
	}

	undo(canvas: Canvas) {
		canvas.add(this.object);
		canvas.setActiveObject(this.object);
		canvas.requestRenderAll();
	}
}
