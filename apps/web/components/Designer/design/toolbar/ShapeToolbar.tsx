"use client";

import { Path } from "fabric";
import { Copy, Trash } from "lucide-react";
import { useRef } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { ChangePropertyCommand } from "@/lib/history/commands/ChangePropertyCommand";
import { DuplicateObjectCommand } from "@/lib/history/commands/DuplicateObjectCommand";
import { RemoveObjectCommand } from "@/lib/history/commands/RemoveObjectCommand";

export default function ShapeToolbar() {
	const { activeObject, getCanvas, setActiveObject } = useDesigner();
	const { execute } = useHistory();
	const canvas = getCanvas();
	const fillRef = useRef<HTMLInputElement>(null);
	const strokeRef = useRef<HTMLInputElement>(null);

	if (!canvas || !(activeObject instanceof Path)) return null;

	const shape = activeObject as Path;
	const fill = typeof shape.fill === "string" ? shape.fill : "#000000";
	const stroke = typeof shape.stroke === "string" ? shape.stroke : "#000000";

	const setFill = (color: string) =>
		execute(new ChangePropertyCommand(shape, "fill", color));

	const setStroke = (color: string) => {
		execute(new ChangePropertyCommand(shape, "stroke", color));
		if (!shape.strokeWidth)
			execute(new ChangePropertyCommand(shape, "strokeWidth", 2));
	};

	const duplicate = () => execute(new DuplicateObjectCommand(shape));
	const remove = () => {
		execute(new RemoveObjectCommand(shape));
		setActiveObject(null);
	};

	return (
		<div
			className="
        absolute top-0 left-1/2 -translate-x-1/2
        flex items-center gap-4 w-full py-[1.1rem]
        bg-white/90 border-b z-300 pl-30
      "
		>
			<div className="w-px h-8 bg-[#d6d6c8]" />

			{/* RELLENO */}
			<button
				type="button"
				className="flex flex-col items-center"
				onClick={() => fillRef.current?.click()}
				title="Color de relleno"
			>
				<span className="text-xs font-medium text-gray-700">Relleno</span>
				<div
					className="w-8 h-3 rounded mt-1 border"
					style={{ backgroundColor: fill }}
				/>
				<input
					ref={fillRef}
					type="color"
					value={fill}
					onChange={(e) => setFill(e.target.value)}
					className="absolute opacity-0 w-0 h-0 pointer-events-none"
				/>
			</button>

			{/* BORDE */}
			<button
				type="button"
				className="flex flex-col items-center"
				onClick={() => strokeRef.current?.click()}
				title="Color de borde"
			>
				<span className="text-xs font-medium text-gray-700">Borde</span>
				<div
					className="w-8 h-3 rounded mt-1 border"
					style={{ backgroundColor: stroke }}
				/>
				<input
					ref={strokeRef}
					type="color"
					value={stroke}
					onChange={(e) => setStroke(e.target.value)}
					className="absolute opacity-0 w-0 h-0 pointer-events-none"
				/>
			</button>

			<div className="w-px h-8 bg-[#d6d6c8]" />

			{/* DUPLICAR */}
			<button
				type="button"
				onClick={duplicate}
				className="p-1 rounded hover:bg-gray-200"
				title="Duplicar"
			>
				<Copy size={22} />
			</button>

			{/* BORRAR */}
			<button
				type="button"
				onClick={remove}
				className="p-1 rounded hover:bg-gray-200"
				title="Eliminar"
			>
				<Trash size={22} className="text-tinta" />
			</button>
		</div>
	);
}
