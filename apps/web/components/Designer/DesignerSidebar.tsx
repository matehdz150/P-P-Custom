"use client";

import { FabricImage, type FabricObject, Rect, Textbox } from "fabric";
import type React from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { AVAILABLE_FONTS } from "@/lib/fabric/fontList";

const ORANGE = "#fe6241";

// 🔸 Aplica estilo de selección naranja a cualquier objeto
function applySelectionStyle(obj: FabricObject) {
	obj.set({
		transparentCorners: false,
		cornerColor: "#ffffff",
		cornerStrokeColor: ORANGE,
		borderColor: ORANGE,
		cornerSize: 8,
		borderScaleFactor: 1.1,
		cornerStyle: "rect",
	});
}

export default function DesignerSidebar() {
	const { getCanvas, getEditableAreas, activeSide, setActiveObject } =
		useDesigner();

	// ------------------------------------------------------
	// FUNCIÓN PRINCIPAL: Agregar texto con la fuente elegida
	// ------------------------------------------------------
	const addTextWithFont = (fontFamily: string) => {
		const canvas = getCanvas();
		if (!canvas) return;

		const areas = getEditableAreas();
		const area = areas[0] ?? null;

		const left = area ? area.left + area.width / 2 : canvas.getWidth() / 2;
		const top = area ? area.top + area.height / 2 : canvas.getHeight() / 2;

		const text = new Textbox("Nuevo texto", {
			left,
			top,
			originX: "center",
			originY: "center",
			fontSize: 32,
			fontFamily,
			fill: "#000",
			editable: true,
			width: area ? area.width - 20 : 300,
		});

		applySelectionStyle(text as unknown as FabricObject);

		if (area) {
			text.clipPath = new Rect({
				left: area.left,
				top: area.top,
				width: area.width,
				height: area.height,
				absolutePositioned: true,
			});
		}

		canvas.add(text);
		canvas.setActiveObject(text);
		canvas.requestRenderAll();
		setActiveObject(text);
	};

	// ---------------------------------------
	// AGREGAR IMAGEN (igual que antes)
	// ---------------------------------------
	const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const canvas = getCanvas();
		if (!canvas) return;

		const reader = new FileReader();
		const areas = getEditableAreas();
		const area = areas[0] ?? null;

		reader.onload = () => {
			const url = reader.result as string;
			const htmlImg = new Image();
			htmlImg.src = url;

			htmlImg.onload = () => {
				const img = new FabricImage(htmlImg, {
					originX: "center",
					originY: "center",
				});

				applySelectionStyle(img as unknown as FabricObject);

				if (area) {
					img.scaleToWidth(area.width * 0.8);
					img.left = area.left + area.width / 2;
					img.top = area.top + area.height / 2;
				} else {
					img.scaleToWidth(300);
					img.left = canvas.getWidth() / 2;
					img.top = canvas.getHeight() / 2;
				}

				if (area) {
					img.clipPath = new Rect({
						left: area.left,
						top: area.top,
						width: area.width,
						height: area.height,
						absolutePositioned: true,
					});
				}

				canvas.add(img);
				canvas.setActiveObject(img);
				canvas.requestRenderAll();
				setActiveObject(img);
			};
		};

		reader.readAsDataURL(file);
	};

	return (
		<div className="w-[260px] bg-gray-100 p-4 border-r flex flex-col gap-4 text-sm">
			<p className="uppercase text-[10px] text-gray-500 tracking-wide">
				Herramientas ({activeSide})
			</p>

			{/* Imagen */}
			<label className="bg-black text-white py-2 rounded hover:bg-gray-900 text-center cursor-pointer text-sm">
				Agregar imagen
				<input
					type="file"
					accept="image/*"
					className="hidden"
					onChange={addImage}
				/>
			</label>

			{/* Fuentes */}
			<div>
				<p className="uppercase text-[10px] text-gray-500 tracking-wide mb-1">
					Agregar texto con fuente:
				</p>

				<div className="flex flex-col gap-1 max-h-[280px] overflow-y-auto pr-1">
					{AVAILABLE_FONTS.map((font) => (
						<button
							key={font.family}
							type="button"
							onClick={() => addTextWithFont(font.family)} // ⭐ CREA TEXTO CON ESA FUENTE
							className="w-full text-left px-2 py-1 rounded hover:bg-gray-200 text-[13px]"
							style={{ fontFamily: font.family }}
						>
							{font.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
