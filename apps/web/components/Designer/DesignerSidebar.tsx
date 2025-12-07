"use client";

import { type Canvas, Image as FabricImage, IText, Rect } from "fabric";
import type React from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { getEditableArea } from "@/lib/fabric/product/productRenderer";

export default function DesignerSidebar() {
	const { canvas } = useDesigner();

	const getArea = () => {
		if (!canvas) return undefined;
		return getEditableArea(canvas as Canvas) ?? undefined;
	};

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
			fontSize: 28,
			fill: "#000",
			editable: true,
			fontFamily: "Inter",
		});

		// Clip al área editable
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
			// Escalar para que quepa más o menos dentro del área editable
			img.scaleToWidth(area.width * 0.9);

			img.set({
				left: area.left + area.width / 2,
				top: area.top + area.height / 2,
				originX: "center",
				originY: "center",
			});

			// Clip al área editable
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
		</div>
	);
}
