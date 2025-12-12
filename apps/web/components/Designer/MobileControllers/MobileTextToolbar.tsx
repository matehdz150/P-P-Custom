"use client";

import { Textbox } from "fabric";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Italic,
	Type,
} from "lucide-react";
import { useDesigner } from "@/Contexts/DesignerContext";

export default function MobileTextToolbar({
	openFontDrawer,
}: {
	openFontDrawer: () => void;
}) {
	const { activeObject, getCanvas } = useDesigner();

	if (!activeObject || !(activeObject instanceof Textbox)) return null;

	const canvas = getCanvas();
	const text = activeObject;

	const apply = (props: Record<string, unknown>) => {
		text.set(props);
		canvas?.requestRenderAll();
	};

	return (
		<div
			className="
        absolute top-16 left-1/2 -translate-x-1/2 
        bg-white shadow-lg rounded-full px-4 py-2 
        flex items-center gap-3 z-100
      "
		>
			{/* Fuente → abre drawer */}
			<button type="button" onClick={openFontDrawer} className="p-1">
				<Type size={20} />
			</button>

			{/* Bold */}
			<button
				type="button"
				onClick={() =>
					apply({ fontWeight: text.fontWeight === "bold" ? "normal" : "bold" })
				}
				className={`p-1 ${text.fontWeight === "bold" ? "text-black font-bold" : "text-gray-500"}`}
			>
				<Bold size={20} />
			</button>

			{/* Italic */}
			<button
				type="button"
				onClick={() =>
					apply({
						fontStyle: text.fontStyle === "italic" ? "normal" : "italic",
					})
				}
				className={`p-1 ${text.fontStyle === "italic" ? "text-black italic" : "text-gray-500"}`}
			>
				<Italic size={20} />
			</button>

			{/* Align Left */}
			<button
				type="button"
				onClick={() => apply({ textAlign: "left" })}
				className={`p-1 ${text.textAlign === "left" ? "text-black" : "text-gray-500"}`}
			>
				<AlignLeft size={20} />
			</button>

			{/* Align Center */}
			<button
				type="button"
				onClick={() => apply({ textAlign: "center" })}
				className={`p-1 ${text.textAlign === "center" ? "text-black" : "text-gray-500"}`}
			>
				<AlignCenter size={20} />
			</button>

			{/* Align Right */}
			<button
				type="button"
				onClick={() => apply({ textAlign: "right" })}
				className={`p-1 ${text.textAlign === "right" ? "text-black" : "text-gray-500"}`}
			>
				<AlignRight size={20} />
			</button>
		</div>
	);
}
