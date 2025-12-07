"use client";

import { type Canvas, Image as FabricImage, IText, Rect } from "fabric";
import type React from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { AVAILABLE_FONTS } from "@/lib/fabric/fonts";
import { insertDesignTemplate } from "@/lib/fabric/insertDesignTemplate";
import { DESIGN_TEMPLATES } from "@/lib/fabric/templatesList";

type CanvasWithArea = Canvas & { editableArea?: Rect };
type FabricObjectWithCurve = {
	__curveConfig?: { fontFamily?: string };
};

export default function DesignerSidebar() {
	const { canvas } = useDesigner();

	const getArea = () => (canvas as CanvasWithArea | null)?.editableArea;

	// ---------------------------------------------------
	// 📝 Añadir texto normal
	// ---------------------------------------------------
	const addText = () => {
		if (!canvas) return;
		const area = getArea();
		if (!area) return;

		const text = new IText("Texto aquí", {
			left: area.left + area.width / 2,
			top: area.top + area.height / 2,
			originX: "center",
			originY: "center",
			width: area.width - 20,
			fontSize: 28,
			fill: "#000",
			editable: true,
			fontFamily: "Inter",
		});

		// Clip
		text.clipPath = new Rect({
			left: area.left,
			top: area.top,
			width: area.width,
			height: area.height,
			absolutePositioned: true,
		});

		canvas.add(text);
		canvas.setActiveObject(text);
		canvas.requestRenderAll();
	};

	// ---------------------------------------------------
	// 🖼 Añadir Imagen
	// ---------------------------------------------------
	const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!canvas || !e.target.files?.length) return;

		const file = e.target.files[0];
		const url = URL.createObjectURL(file);

		const area = getArea();
		if (!area) return;

		FabricImage.fromURL(url).then((img) => {
			img.scaleToWidth(area.width * 0.9);
			img.set({
				left: area.left + area.width / 2,
				top: area.top + area.height / 2,
				originX: "center",
				originY: "center",
			});

			img.clipPath = new Rect({
				left: area.left,
				top: area.top,
				width: area.width,
				height: area.height,
				absolutePositioned: true,
			});

			canvas.add(img);
			canvas.setActiveObject(img);
			canvas.requestRenderAll();
		});
	};

	// ---------------------------------------------------
	// 🌙 Insertar plantilla curva
	// ---------------------------------------------------
	const addCurvedTemplate = async () => {
		if (!canvas) return;
		// ejemplo por default
		await insertDesignTemplate(canvas, "circle-full");
	};

	// ---------------------------------------------------
	// 🔤 Cambiar fuente
	// ---------------------------------------------------
	const changeFont = (fontName: string) => {
		if (!canvas) return;

		const active = canvas.getActiveObject();
		if (!active) return;

		// Si es texto editable o curvo → tiene fontFamily
		if ("fontFamily" in active) {
			active.set("fontFamily", fontName);

			// Si es texto curvo, actualizar su metadata
			const curveConfig = (active as typeof active & FabricObjectWithCurve)
				.__curveConfig;
			if (curveConfig) {
				curveConfig.fontFamily = fontName;
			}

			active.setCoords();
			canvas.requestRenderAll();
		}
	};

	// ---------------------------------------------------
	// RENDER UI
	// ---------------------------------------------------
	return (
		<div className="w-[240px] bg-gray-100 p-4 flex flex-col gap-4 border-r text-sm overflow-y-auto">
			{/* Botón texto */}
			<button
				type="button"
				onClick={addText}
				className="bg-black text-white px-3 py-2 rounded hover:bg-gray-900"
			>
				Añadir texto
			</button>

			{/* Botón imagen */}
			<label className="bg-black text-white px-3 py-2 rounded hover:bg-gray-900 cursor-pointer text-center">
				Insertar imagen
				<input
					type="file"
					accept="image/*"
					className="hidden"
					onChange={addImage}
				/>
			</label>

			{/* Botón curva */}
			<button
				type="button"
				onClick={addCurvedTemplate}
				className="bg-black text-white px-3 py-2 rounded hover:bg-gray-900"
			>
				Texto curvo (plantilla)
			</button>

			{/* Plantillas */}
			<p className="font-medium text-xs uppercase text-gray-600 mt-2">
				Plantillas
			</p>

			<div className="grid grid-cols-2 gap-2">
				{DESIGN_TEMPLATES.map((tpl) => (
					<button
						type="button"
						key={tpl.id}
						onClick={() => canvas && insertDesignTemplate(canvas, tpl.id)}
						className="bg-white border rounded p-2 text-xs hover:bg-gray-100"
					>
						{tpl.label}
					</button>
				))}
			</div>

			{/* Fuentes */}
			<p className="text-xs font-medium mt-3">Fuentes</p>

			<div className="flex flex-col gap-2">
				{AVAILABLE_FONTS.map((f) => (
					<button
						type="button"
						key={f.name}
						onClick={() => changeFont(f.name)}
						className="px-2 py-1 border rounded hover:bg-gray-100 text-left"
						style={{ fontFamily: f.name }}
					>
						{f.name}
					</button>
				))}
			</div>
		</div>
	);
}
