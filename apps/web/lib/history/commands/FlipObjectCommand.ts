import type { Canvas, FabricObject } from "fabric";
import type { Command } from "./Command";

export class FlipObjectCommand implements Command {
	private object: FabricObject;
	private axis: "flipX" | "flipY";
	private prev: boolean;
	private next: boolean;

	constructor(object: FabricObject, axis: "flipX" | "flipY") {
		this.object = object;
		this.axis = axis;

		this.prev = object[this.axis] as boolean;
		this.next = !this.prev; // 👈 NO VIENE DE AFUERA, SE CALCULA AQUÍ
	}

	do(canvas: Canvas) {
		this.object.set({ [this.axis]: this.next });

		this.object.setCoords(); // 👈 NECESARIO
		canvas.requestRenderAll();
	}

	undo(canvas: Canvas) {
		this.object.set({ [this.axis]: this.prev });

		this.object.setCoords(); // 👈 NECESARIO
		canvas.requestRenderAll();
	}
}
