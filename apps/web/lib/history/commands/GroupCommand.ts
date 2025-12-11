import type { Canvas } from "fabric";
import type { Command } from "./Command";

export class GroupCommand implements Command {
	constructor(private commands: Command[]) {}

	do(canvas: Canvas) {
		for (const c of this.commands) {
			c.do(canvas);
		}
	}

	undo(canvas: Canvas) {
		for (const c of [...this.commands].reverse()) {
			c.undo(canvas);
		}
	}
}
