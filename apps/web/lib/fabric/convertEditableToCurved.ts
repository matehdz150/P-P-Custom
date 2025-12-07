// fabric/convertEditableToCurved.ts

import type { Canvas, Textbox } from "fabric";
import {
	type CurvedTextConfig,
	createCurvedTextGroup,
} from "./curvedTextEngine";

type TextboxWithCurve = Textbox & {
	__curveConfig?: CurvedTextConfig & { spacing?: number };
};

export function convertEditableToCurved(canvas: Canvas, textbox: Textbox) {
	const cfg =
		(textbox as TextboxWithCurve).__curveConfig ??
		({
			text: textbox.text ?? "",
			radius: 150,
			spacing: 12,
			direction: "arc-up",
			fontSize: textbox.fontSize,
			fontFamily: textbox.fontFamily as string,
		} satisfies CurvedTextConfig);

	// 1️⃣ Asegurar salir de edición
	if (textbox.isEditing) {
		textbox.exitEditing();
	}

	// 2️⃣ Limpiar listeners para evitar errores "fire of undefined"
	textbox.off();

	const centerX = textbox.left ?? 0;
	const centerY = textbox.top ?? 0;

	// 3️⃣ Crear el grupo curvo
	const groupCfg: CurvedTextConfig = {
		id: cfg.id,
		text: textbox.text ?? "",
		radius: cfg.radius ?? 150,
		spacing: cfg.spacing ?? 12,
		direction: cfg.direction ?? "arc-up",
		fontSize: textbox.fontSize,
		fontFamily: textbox.fontFamily as string,
	};

	const group = createCurvedTextGroup(groupCfg, centerX, centerY);

	// Mantener clip
	group.clipPath = textbox.clipPath;

	// 4️⃣ Reemplazar textbox → curved group
	canvas.remove(textbox);
	canvas.add(group);

	canvas.setActiveObject(group);
	canvas.requestRenderAll();
}
