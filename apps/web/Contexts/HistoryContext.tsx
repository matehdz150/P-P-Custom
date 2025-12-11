/* eslint-disable react-hooks/refs */
"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";
import type { Command } from "@/lib/history/commands/Command";
import { useDesigner } from "./DesignerContext";

interface HistoryContextType {
	execute: (cmd: Command) => void;
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;
	resetSideHistory: (side: string) => void;
}

const HistoryContext = createContext<HistoryContextType>(
	{} as HistoryContextType,
);

export function HistoryProvider({ children }: { children: ReactNode }) {
	const { getCanvas, activeSide } = useDesigner();

	// Stacks reales por side (no causan re-render por sí solos)
	const undoStack = useRef<Record<string, Command[]>>({});
	const redoStack = useRef<Record<string, Command[]>>({});

	// Forzar re-render cuando cambie el historial
	const [, setVersion] = useState(0);
	const bumpVersion = useCallback(() => setVersion((v) => v + 1), []);

	// ---------------- EXECUTE (do + push) ----------------
	const execute = useCallback(
		(cmd: Command) => {
			const canvas = getCanvas();
			if (!canvas) {
				console.warn("[History] execute() sin canvas activo");
				return;
			}

			console.log("[History] EXECUTE on side:", activeSide, cmd);

			// 1) Ejecutar comando
			cmd.do(canvas);

			// 2) Meterlo al undoStack del side actual
			const currentUndo = undoStack.current[activeSide] ?? [];
			undoStack.current[activeSide] = [...currentUndo, cmd];

			// 3) Limpiar redo de ese side
			redoStack.current[activeSide] = [];

			console.log(
				"[History] undo len:",
				undoStack.current[activeSide]?.length ?? 0,
			);

			bumpVersion();
		},
		[activeSide, bumpVersion, getCanvas],
	);

	// ---------------- UNDO ----------------
	const undo = useCallback(() => {
		const canvas = getCanvas();
		if (!canvas) {
			console.warn("[History] undo() sin canvas activo");
			return;
		}

		const currentUndo = undoStack.current[activeSide] ?? [];
		if (currentUndo.length === 0) return;

		const lastCmd = currentUndo[currentUndo.length - 1];

		// sacar de undo
		undoStack.current[activeSide] = currentUndo.slice(0, -1);

		// meter en redo
		const currentRedo = redoStack.current[activeSide] ?? [];
		redoStack.current[activeSide] = [...currentRedo, lastCmd];

		console.log("[History] UNDO on side:", activeSide, lastCmd);

		lastCmd.undo(canvas);

		bumpVersion();
	}, [activeSide, bumpVersion, getCanvas]);

	// ---------------- REDO ----------------
	const redo = useCallback(() => {
		const canvas = getCanvas();
		if (!canvas) {
			console.warn("[History] redo() sin canvas activo");
			return;
		}

		const currentRedo = redoStack.current[activeSide] ?? [];
		if (currentRedo.length === 0) return;

		const cmd = currentRedo[currentRedo.length - 1];

		// sacar de redo
		redoStack.current[activeSide] = currentRedo.slice(0, -1);

		// regresarlo a undo
		const currentUndo = undoStack.current[activeSide] ?? [];
		undoStack.current[activeSide] = [...currentUndo, cmd];

		console.log("[History] REDO on side:", activeSide, cmd);

		cmd.do(canvas);

		bumpVersion();
	}, [activeSide, bumpVersion, getCanvas]);

	// ---------------- RESET SIDE ----------------
	const resetSideHistory = useCallback(
		(side: string) => {
			undoStack.current[side] = [];
			redoStack.current[side] = [];
			bumpVersion();
		},
		[bumpVersion],
	);

	// ---------------- FLAGS ----------------
	const canUndo = (undoStack.current[activeSide]?.length ?? 0) > 0;
	const canRedo = (redoStack.current[activeSide]?.length ?? 0) > 0;

	return (
		<HistoryContext.Provider
			value={{
				execute,
				undo,
				redo,
				canUndo,
				canRedo,
				resetSideHistory,
			}}
		>
			{children}
		</HistoryContext.Provider>
	);
}

export function useHistory() {
	return useContext(HistoryContext);
}
