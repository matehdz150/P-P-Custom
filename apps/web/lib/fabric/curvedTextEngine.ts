// lib/fabric/curvedTextEngine.ts
import { Group, Text } from "fabric";

export type CurvedTextConfig = {
	id?: string;
	text: string;
	radius: number; // radio del arco
	spacing: number; // grados entre letras
	direction: "arc-up" | "arc-down";
	fontSize?: number;
	fontFamily?: string;
};

export function createCurvedTextGroup(
	cfg: CurvedTextConfig,
	centerX: number,
	centerY: number,
): Group {
	const {
		text,
		radius,
		spacing,
		direction,
		fontSize = 40,
		fontFamily = "Inter",
	} = cfg;

	const chars = text.split("");
	const n = chars.length;

	const letters: Text[] = [];

	const angleStep = spacing;
	const totalAngle = angleStep * (n - 1);
	const startAngle = -totalAngle / 2;
	const dirSign = direction === "arc-down" ? 1 : -1;

	chars.forEach((char, index) => {
		const angleDeg = startAngle + index * angleStep;
		const angleRad = (angleDeg * Math.PI) / 180;

		const x = centerX + radius * Math.sin(angleRad);
		const y = centerY + dirSign * radius * Math.cos(angleRad);

		// Ángulo original del carácter
		let letterAngle = angleDeg * -dirSign;

		// 🔥 FIX: evitar giros automáticos de Fabric (>90° ó <−90°)
		if (letterAngle > 90) letterAngle -= 180;
		if (letterAngle < -90) letterAngle += 180;

		const letter = new Text(char, {
			left: x,
			top: y,
			originX: "center",
			originY: "center",
			fontSize,
			fontFamily,
			angle: letterAngle, // 🔥 Ángulo corregido
		});

		letters.push(letter);
	});

	const group = new Group(letters, {
		left: centerX,
		top: centerY,
		originX: "center",
		originY: "center",
	});

	const curvedGroup = group as Group & {
		designType?: "curved-text";
		__curveConfig?: CurvedTextConfig;
	};

	curvedGroup.designType = "curved-text";
	curvedGroup.__curveConfig = cfg;

	return group;
}
