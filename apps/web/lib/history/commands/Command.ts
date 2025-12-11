// lib/history/commands/Command.ts
import type { Canvas } from "fabric";

export interface Command {
	// se ejecuta la acción
	do(canvas: Canvas): void;

	// se deshace la acción
	undo(canvas: Canvas): void;
}
