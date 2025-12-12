// lib/history/commands/TransformObjectCommand.ts
import type { Canvas, FabricObject } from "fabric";
import type { Command } from "./Command";

export class TransformObjectCommand implements Command {
	private object: FabricObject;
	private before: TransformProps;
	private after: TransformProps;

	constructor(opts: {
		object: FabricObject;
		before: TransformObjectCommand["before"];
		after: TransformObjectCommand["after"];
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

type TransformProps = Partial<
	Pick<FabricObject, "left" | "top" | "scaleX" | "scaleY" | "angle">
>;
