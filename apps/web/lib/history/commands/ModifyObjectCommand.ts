// lib/history/commands/ModifyObjectCommand.ts
import type { Canvas, FabricObject } from "fabric";
import type { Command } from "./Command";

export class ModifyObjectCommand implements Command {
	private object: FabricObject;
	private before: Partial<FabricObject>;
	private after: Partial<FabricObject>;

	constructor(opts: {
		object: FabricObject;
		before: Partial<FabricObject>;
		after: Partial<FabricObject>;
	}) {
		this.object = opts.object;
		this.before = opts.before;
		this.after = opts.after;
	}

	do(canvas: Canvas) {
		this.object.set(this.after);
		canvas.requestRenderAll();
	}

	undo(canvas: Canvas) {
		this.object.set(this.before);
		canvas.requestRenderAll();
	}
}
