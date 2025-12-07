// lib/fabric/convertPlainToCurved.ts
import type { Canvas, Group, IText } from "fabric";
import type { CurvedTextConfig } from "./curvedTextEngine";
import { createCurvedTextGroup } from "./curvedTextEngine";

type CurveConfig = {
	radius: number;
	spacing: number;
	direction: "arc-up" | "arc-down";
	curved?: number;
};

type CurvedMeta = {
	designType?: "curved-text";
	__curveConfig?: CurvedTextConfig & {
		spacing: number;
		baseDirection: "arc-up" | "arc-down";
		baseTotalAngle: number;
		centerX?: number;
		centerY?: number;
	};
};

// convertPlainToCurved.ts o editableCurvedText.ts (donde lo tengas)
export function convertPlainToCurved(
	canvas: Canvas,
	textbox: IText,
	curveCfg: CurveConfig,
) {
	const { radius, spacing, direction } = curveCfg;

	if (textbox.left == null || textbox.top == null) return;

	const group = createCurvedTextGroup(
		{
			text: textbox.text ?? "",
			radius,
			spacing,
			direction,
			fontSize: textbox.fontSize,
			fontFamily: textbox.fontFamily ?? "Inter",
		},
		textbox.left,
		textbox.top,
	);

	group.clipPath = textbox.clipPath;

	const curvedGroup = group as Group & CurvedMeta;

	curvedGroup.designType = "curved-text";
	curvedGroup.__curveConfig = {
		text: textbox.text ?? "",
		radius,
		spacing,
		direction, // dirección actual
		baseDirection: direction, // 👈 dirección base FIJA
		fontSize: textbox.fontSize,
		fontFamily: textbox.fontFamily ?? "Inter",
		baseTotalAngle: 360,
		centerX: textbox.left,
		centerY: textbox.top,
	};

	textbox.off();
	canvas.remove(textbox);
	canvas.add(group);
	canvas.setActiveObject(group);
	canvas.requestRenderAll();
}
