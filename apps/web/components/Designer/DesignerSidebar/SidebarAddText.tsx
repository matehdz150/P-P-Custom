/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { type FabricObject, Textbox } from "fabric";
import { useDesigner } from "@/Contexts/DesignerContext";
import { useHistory } from "@/Contexts/HistoryContext";
import { AVAILABLE_FONTS } from "@/lib/fabric/fontList";
import { AddObjectCommand } from "@/lib/history/commands/AddObjectCommand";

const ORANGE = "#fe6241";

function applySelectionStyle(obj: FabricObject) {
	obj.set({
		transparentCorners: false,
		cornerColor: "#ffffff",
		cornerStrokeColor: ORANGE,
		borderColor: ORANGE,
		cornerSize: 8,
		cornerStyle: "rect",
	});
}

export default function SidebarAddText() {
	const { getCanvas, getEditableAreas, setActiveObject } = useDesigner();
	const { execute } = useHistory();

	const addTextWithFont = async (fontFamily: string) => {
		const canvas = getCanvas();
		if (!canvas) return;

		const area = getEditableAreas()[0] ?? null;

		let left = canvas.getWidth() / 2;
		let top = canvas.getHeight() / 2;
		let width = 300;

		if (area) {
			const b = area.getBoundingRect();
			left = b.left + b.width / 2;
			top = b.top + b.height / 2;
			width = b.width - 20;
		}

		const text = new Textbox("Nuevo texto", {
			left,
			top,
			originX: "center",
			originY: "center",
			fontSize: 32,
			fontFamily,
			fill: "#000",
			width,
		});

		applySelectionStyle(text);

		if (area) {
			const clip = await area.clone();
			clip.set({
				absolutePositioned: true,
				selectable: false,
				evented: false,
			});
			text.clipPath = clip;
		}

		// ❗ MUY IMPORTANTE: NO AGREGARLO MANUALMENTE
		// canvas.add(text);  ← JAMÁS

		execute(new AddObjectCommand(text)); // 👈 registra la acción para Undo/Redo

		setActiveObject(text);
		canvas.setActiveObject(text);
		canvas.requestRenderAll();
	};

	return (
		<div>
			<p className="uppercase text-[10px] text-gray-500 tracking-wide mb-1">
				Agregar texto con fuente:
			</p>

			<div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto pr-1">
				{AVAILABLE_FONTS.map((font) => (
					<button
						key={font.family}
						type="button"
						onClick={() => addTextWithFont(font.family)}
						className="w-full text-left px-2 py-1 rounded hover:bg-gray-200 text-[13px]"
						style={{ fontFamily: font.family }}
					>
						{font.label}
					</button>
				))}
			</div>
		</div>
	);
}
