import type { Canvas, FabricObject } from "fabric";
import type { Command } from "./Command";

export class MoveObjectCommand implements Command {
	private object: FabricObject;
	private prev: { left: number; top: number };
	private next: { left: number; top: number };

	constructor(
		object: FabricObject,
		prev: { left: number; top: number },
		next: { left: number; top: number },
	) {
		this.object = object;
		this.prev = prev;
		this.next = next;
	}

	do(canvas: Canvas) {
		this.object.set({ left: this.next.left, top: this.next.top });
		this.object.setCoords();
		canvas.requestRenderAll();
	}

	undo(canvas: Canvas) {
		this.object.set({ left: this.prev.left, top: this.prev.top });
		this.object.setCoords();
		canvas.requestRenderAll();
	}
}
