"use client";

import { type FabricObject, Textbox } from "fabric";
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
import { CurvedText } from "@/lib/fabric/CurvedText";
import { AVAILABLE_FONTS } from "@/lib/fabric/fontList";
import { ChangePropertyCommand } from "@/lib/history/commands/ChangePropertyCommand";
import { DuplicateObjectCommand } from "@/lib/history/commands/DuplicateObjectCommand";
import { RemoveObjectCommand } from "@/lib/history/commands/RemoveObjectCommand";
import { ReplaceObjectCommand } from "@/lib/history/commands/ReplaceObjectCommand";
import ColorPickerMinimal from "./ColorPicker";
import { FontSelector } from "./FontSelector";
import { FontSizeSelector } from "./FontSizeSelector";

const ORANGE = "#2b2812";

function applySelectionStyle(obj: Textbox | CurvedText) {
	obj.set({
		transparentCorners: false,
		cornerColor: "#ffffff",
		cornerStrokeColor: ORANGE,
		borderColor: ORANGE,
		cornerSize: 8,
		cornerStyle: "rect",
	} as never);
}

// ─── type guard ───────────────────────────────────────────────────────────────
function isTextLike(obj: unknown): obj is Textbox | CurvedText {
	return obj instanceof Textbox || obj instanceof CurvedText;
}

// ─── Curved arc icon (SVG path) ───────────────────────────────────────────────
function ArcIcon({ size = 22 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
		>
			<path d="M4 16 Q12 6 20 16" />
			<text
				x="12"
				y="14"
				textAnchor="middle"
				fontSize="6"
				stroke="none"
				fill="currentColor"
			>
				Aa
			</text>
		</svg>
	);
}

export default function TextToolbar() {
	const { activeObject, getCanvas, setActiveObject } = useDesigner();
	const { execute } = useHistory();
	const canvas = getCanvas();

	if (!canvas || !isTextLike(activeObject)) return null;

	const obj = activeObject;
	const isCurved = obj instanceof CurvedText;

	const safeFont = obj.fontFamily ?? AVAILABLE_FONTS[0].family;
	const safeFontSize = (obj.fontSize as number) ?? 16;
	const safeFill = typeof obj.fill === "string" ? obj.fill : "#000000";

	// ── font / size / style ──────────────────────────────────────────────────
	const changeFont = (family: string) =>
		execute(new ChangePropertyCommand(obj, "fontFamily", family));

	const changeFontSize = (size: number) =>
		execute(new ChangePropertyCommand(obj, "fontSize", size));

	const toggleBold = () => {
		const next = obj.fontWeight === "bold" ? "normal" : "bold";
		execute(new ChangePropertyCommand(obj, "fontWeight", next));
	};

	const toggleItalic = () => {
		const next = (obj.fontStyle as string) === "italic" ? "normal" : "italic";
		execute(new ChangePropertyCommand(obj, "fontStyle", next));
	};

	// ── align (Textbox only) ─────────────────────────────────────────────────
	const changeAlign = (align: "left" | "center" | "right") => {
		if (obj instanceof Textbox)
			execute(new ChangePropertyCommand(obj, "textAlign", align));
	};

	// ── duplicate / delete ───────────────────────────────────────────────────
	const duplicate = () => execute(new DuplicateObjectCommand(obj));

	const remove = () => {
		execute(new RemoveObjectCommand(obj));
		setActiveObject(null);
	};

	// ── curved text toggle ───────────────────────────────────────────────────
	const toggleCurved = () => {
		if (obj instanceof Textbox) {
			// Textbox → CurvedText
			const curved = new CurvedText({
				text: obj.text ?? "Texto",
				left: obj.left,
				top: obj.top,
				fontSize: obj.fontSize,
				fontFamily: obj.fontFamily,
				fontWeight: obj.fontWeight as string,
				fontStyle: obj.fontStyle as string,
				fill: typeof obj.fill === "string" ? obj.fill : "#000000",
				angle: obj.angle,
				opacity: obj.opacity,
				curvature: -50, // arch up por defecto
				clipPath: obj.clipPath as FabricObject | undefined,
			} as never);
			applySelectionStyle(curved);
			execute(new ReplaceObjectCommand(obj, curved));
			setActiveObject(curved);
		} else if (obj instanceof CurvedText) {
			// CurvedText → Textbox
			const tb = new Textbox(obj.text, {
				left: obj.left,
				top: obj.top,
				fontSize: obj.fontSize,
				fontFamily: obj.fontFamily,
				fontWeight: obj.fontWeight as string,
				fontStyle: obj.fontStyle as string,
				fill: typeof obj.fill === "string" ? obj.fill : "#000000",
				angle: obj.angle,
				opacity: obj.opacity,
				width: 300,
				clipPath: obj.clipPath as FabricObject | undefined,
			});
			applySelectionStyle(tb);
			execute(new ReplaceObjectCommand(obj, tb));
			setActiveObject(tb);
		}
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

			{/* COLOR */}
			<ColorPickerMinimal
				value={safeFill}
				onChange={(color) =>
					execute(new ChangePropertyCommand(obj, "fill", color))
				}
			/>

			{/* BOLD */}
			<button
				type="button"
				onClick={toggleBold}
				className={`p-1 rounded hover:bg-gray-200 ${obj.fontWeight === "bold" ? "bg-gray-300" : ""}`}
				title="Negrita"
			>
				<Bold size={22} />
			</button>

			{/* ITALIC */}
			<button
				type="button"
				onClick={toggleItalic}
				className={`p-1 rounded hover:bg-gray-200 ${(obj.fontStyle as string) === "italic" ? "bg-gray-300" : ""}`}
				title="Itálica"
			>
				<Italic size={22} />
			</button>

			{/* ALINEACIÓN — solo Textbox */}
			{obj instanceof Textbox && (
				<>
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
				</>
			)}

			<div className="w-px h-8 bg-[#d6d6c8]" />

			{/* TEXTO CURVADO TOGGLE */}
			<button
				type="button"
				onClick={toggleCurved}
				title={isCurved ? "Quitar curvatura" : "Texto curvado"}
				className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
					isCurved
						? "bg-tinta text-hueso-suave"
						: "border border-gray-300 hover:bg-gray-100 text-gray-700"
				}`}
			>
				<ArcIcon size={18} />
				{isCurved ? "Curvado ✓" : "Curvar texto"}
			</button>

			<div className="w-px h-8 bg-[#d6d6c8]" />

			{/* DUPLICAR */}
			<button
				type="button"
				onClick={duplicate}
				className="p-1 hover:bg-gray-200 rounded"
				title="Duplicar"
			>
				<Copy size={22} />
			</button>

			{/* BORRAR */}
			<button
				type="button"
				onClick={remove}
				className="p-1 hover:bg-gray-200 rounded"
				title="Eliminar"
			>
				<Trash size={22} className="text-tinta" />
			</button>
		</div>
	);
}
