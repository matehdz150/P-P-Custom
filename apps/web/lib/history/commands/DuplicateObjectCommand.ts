import type { Canvas, FabricObject } from "fabric";
import type { Command } from "./Command";

export class DuplicateObjectCommand implements Command {
	private clone: FabricObject | null = null;
	private source: FabricObject;

	constructor(source: FabricObject) {
		this.source = source;
	}

	async do(canvas: Canvas) {
		if (!this.clone) {
			this.clone = await this.source.clone();
			this.clone.set({
				left: (this.source.left ?? 0) + 20,
				top: (this.source.top ?? 0) + 20,
			});
		}
		canvas.add(this.clone);
		canvas.setActiveObject(this.clone);
		canvas.requestRenderAll();
	}

	undo(canvas: Canvas) {
		if (this.clone) {
			canvas.remove(this.clone);
			canvas.requestRenderAll();
		}
	}
}
