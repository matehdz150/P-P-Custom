/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Canvas, FabricObject } from "fabric";
import type { Command } from "./Command";

export class ChangePropertyCommand<TValue = unknown> implements Command {
	private object: FabricObject;
	private prop: string;
	private prev: TValue;
	private next: TValue;

	constructor(object: FabricObject, prop: string, nextValue: TValue) {
		this.object = object;
		this.prop = prop;
		this.prev = object[prop] as TValue;
		this.next = nextValue;
	}

	do(canvas: Canvas) {
		this.object.set({ [this.prop]: this.next });
		this.object.setCoords();
		canvas.requestRenderAll();
	}

	undo(canvas: Canvas) {
		this.object.set({ [this.prop]: this.prev });
		this.object.setCoords();
		canvas.requestRenderAll();
	}
}
