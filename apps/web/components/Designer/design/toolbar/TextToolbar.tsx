"use client";

import { Textbox } from "fabric";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Copy,
	Italic,
	Trash,
} from "lucide-react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { AVAILABLE_FONTS } from "@/lib/fabric/fontList";

import { ChangePropertyCommand } from "@/lib/history/commands/ChangePropertyCommand";
import { DuplicateObjectCommand } from "@/lib/history/commands/DuplicateObjectCommand";
import { RemoveObjectCommand } from "@/lib/history/commands/RemoveObjectCommand";
import ColorPickerMinimal from "./ColorPicker";
import { FontSelector } from "./FontSelector";
import { FontSizeSelector } from "./FontSizeSelector";

export default function TextToolbar() {
	const { activeObject, getCanvas, setActiveObject } = useDesigner();
	const { execute } = useHistory();
	const canvas = getCanvas();

	if (!canvas || !activeObject || !(activeObject instanceof Textbox))
		return null;

	const textObj = activeObject as Textbox;

	// valores seguros
	const safeFont = textObj.fontFamily ?? AVAILABLE_FONTS[0].family;
	const safeFontSize = textObj.fontSize ?? 16;

	// --------------------------
	// 🔥 CAMBIO DE FUENTE
	// --------------------------
	const changeFont = (family: string) => {
		execute(new ChangePropertyCommand(textObj, "fontFamily", family));
	};

	// --------------------------
	// 🔥 CAMBIO DE TAMAÑO
	// --------------------------
	const changeFontSize = (size: number) => {
		execute(new ChangePropertyCommand(textObj, "fontSize", size));
	};

	// --------------------------
	// 🔥 CAMBIO DE ALINEACIÓN
	// --------------------------
	const changeAlign = (align: "left" | "center" | "right") => {
		execute(new ChangePropertyCommand(textObj, "textAlign", align));
	};

	// --------------------------
	// 🔥 DUPLICAR TEXTO
	// --------------------------
	const duplicate = () => {
		execute(new DuplicateObjectCommand(textObj));
	};

	// --------------------------
	// 🔥 ELIMINAR TEXTO
	// --------------------------
	const remove = () => {
		execute(new RemoveObjectCommand(textObj));
		setActiveObject(null);
	};

	// --------------------------
	// 🔥 CAMBIO DE ITÁLICA
	// --------------------------
	const toggleItalic = () => {
		const current = textObj.fontStyle ?? "normal";
		const next = current === "italic" ? "normal" : "italic";

		execute(new ChangePropertyCommand(textObj, "fontStyle", next));
	};

	// --------------------------
	// 🔥 CAMBIAR FONT WEIGHT (Regular ↔ Bold)
	// --------------------------
	const toggleBold = () => {
		const current = textObj.fontWeight ?? "normal";
		const next = current === "bold" ? "normal" : "bold";

		execute(new ChangePropertyCommand(textObj, "fontWeight", next));
	};

	return (
		<div
			className="
        absolute top-0 left-1/2 -translate-x-1/2
        flex items-center gap-3 w-full py-[0.95rem]
        bg-white/90 border-b z-300 pl-30
      "
		>
			<div className="w-px h-8 bg-[#d6d6c8]" />
			{/* FUENTE */}
			<FontSelector value={safeFont} onChange={changeFont} />

			{/* TAMAÑO */}
			<FontSizeSelector value={safeFontSize} onChange={changeFontSize} />

			<div className="w-px h-8 bg-[#d6d6c8]" />

			{/* COLOR PICKER */}
			<div className="flex items-center gap-2">
				<ColorPickerMinimal
					value={typeof textObj.fill === "string" ? textObj.fill : "#000000"}
					onChange={(color) =>
						execute(new ChangePropertyCommand(textObj, "fill", color))
					}
				/>
			</div>

			{/* BOLD */}
			<button
				type="button"
				onClick={toggleBold}
				className={`p-1 rounded hover:bg-gray-200 ${
					textObj.fontWeight === "bold" ? "bg-gray-300" : ""
				}`}
				title="Bold"
			>
				<Bold size={22} />
			</button>

			{/* ITALICA */}
			<button
				type="button"
				onClick={toggleItalic}
				className={`p-1 rounded hover:bg-gray-200 ${
					textObj.fontStyle === "italic" ? "bg-gray-300" : ""
				}`}
				title="Italic"
			>
				<Italic size={22} />
			</button>

			{/* ALINEACIÓN */}
			<button
				type="button"
				onClick={() => changeAlign("left")}
				className="p-1 hover:bg-gray-200 rounded"
			>
				<AlignLeft size={22} />
			</button>

			<button
				type="button"
				onClick={() => changeAlign("center")}
				className="p-1 hover:bg-gray-200 rounded"
			>
				<AlignCenter size={22} />
			</button>

			<button
				type="button"
				onClick={() => changeAlign("right")}
				className="p-1 hover:bg-gray-200 rounded"
			>
				<AlignRight size={22} />
			</button>

			<div className="w-px h-8 bg-[#d6d6c8]" />

			{/* DUPLICAR */}
			<button
				type="button"
				onClick={duplicate}
				className="p-1 hover:bg-gray-200 rounded"
			>
				<Copy size={22} />
			</button>

			{/* BORRAR */}
			<button
				type="button"
				onClick={remove}
				className="p-1 hover:bg-gray-200 rounded"
			>
				<Trash size={22} className="text-black" />
			</button>
		</div>
	);
}
