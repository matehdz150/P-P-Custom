"use client";

import { Redo2, Undo2 } from "lucide-react";
import { useHistory } from "@/Contexts/HistoryContext";

export default function UndoRedoButtons() {
	const { undo, redo, canUndo, canRedo } = useHistory();

	return (
		<div className="absolute top-2 left-4 flex items-center gap-2 bg-transparent px-3 py-2  z-400">
			<button
				type="button"
				onClick={undo}
				disabled={!canUndo}
				className={`p-1.5 rounded ${canUndo ? "hover:bg-gray-200" : "opacity-40 cursor-not-allowed"}`}
				title="Deshacer"
			>
				<Undo2 size={20} />
			</button>

			<button
				type="button"
				onClick={redo}
				disabled={!canRedo}
				className={`p-1.5 rounded ${canRedo ? "hover:bg-gray-200" : "opacity-40 cursor-not-allowed"}`}
				title="Rehacer"
			>
				<Redo2 size={20} />
			</button>
		</div>
	);
}
