// fabric/convertEditableToCurved.ts

import type { Canvas, Textbox } from "fabric";
import { createCurvedTextGroup } from "./curvedTextEngine";

export function convertEditableToCurved(canvas: Canvas, textbox: Textbox) {
	const cfg = (
		textbox as Textbox & { __curveConfig?: { id?: string; spacing: number } }
	).__curveConfig;
	if (!cfg) return;

	// 1️⃣ Asegurar salir de edición
	if (textbox.isEditing) {
		textbox.exitEditing();
	}

	// 2️⃣ Limpiar listeners para evitar errores "fire of undefined"
	textbox.off();

	const centerX = textbox.left ?? 0;
	const centerY = textbox.top ?? 0;

	// 3️⃣ Crear el grupo curvo
	const group = createCurvedTextGroup(
		{
			id: cfg.id,
			type: "curved-text",
			text: textbox.text ?? "",
			radius: cfg.radius,
			spacing: cfg.spacing,
			direction: cfg.direction,
			fontSize: textbox.fontSize,
			fontFamily: textbox.fontFamily as string,
		},
		centerX,
		centerY,
	);

	// Mantener clip
	group.clipPath = textbox.clipPath;

	// 4️⃣ Reemplazar textbox → curved group
	canvas.remove(textbox);
	canvas.add(group);

	canvas.setActiveObject(group);
	canvas.requestRenderAll();
}
