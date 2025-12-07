// apps/web/lib/fabric/editableCurvedText.ts
import { type Canvas, type Group, IText, type Text } from "fabric";
import { createCurvedTextGroup } from "./curvedTextEngine";

type CurveConfig = {
	id?: string;
	text: string;
	radius: number;
	spacing: number;
	direction: "arc-up" | "arc-down";
	fontSize?: number;
	fontFamily?: string;
	totalAngle?: number;
	scaleX?: number;
	scaleY?: number;
	curved?: number;
	curvedAbs?: number;
	baseTotalAngle?: number;
	baseDirection?: "arc-up" | "arc-down";

	// 👇 añadimos estos campos para plantillas
	centerX?: number;
	centerY?: number;
	bakedFontSize?: number;
};

type CurvedMeta = {
	designType?: "curved-text";
	__curveConfig?: CurveConfig & Record<string, unknown>;
	_objects?: Text[];
};

/**
 * Convertir texto curvo → editable
 */
export function convertCurvedToEditable(canvas: Canvas, group: Group) {
	const cfg = (group as Group & CurvedMeta).__curveConfig;
	if (!cfg) return;

	const letters = ((group as Group & CurvedMeta)._objects ?? []) as Text[];
	const first = letters?.[0];

	// escala del grupo (por si lo hiciste más chico/grande en el canvas)
	const groupScale = group.scaleX ?? 1;
	const letterScale = first?.scaleX ?? 1;

	// 🔥 tamaño real del texto en pantalla
	const bakedFontSize =
		(first?.fontSize ?? cfg.fontSize ?? 40) * groupScale * letterScale;

	// 🔥 radio real después de escalar el grupo
	const effectiveRadius = (cfg.radius ?? 150) * groupScale;

	const originalText = cfg.text ?? "";
	const originalLen = Math.max(originalText.length - 1, 0);
	const totalAngle = cfg.totalAngle ?? (cfg.spacing ?? 0) * originalLen;

	const editable = new IText(originalText, {
		left: group.left,
		top: group.top,
		originX: "center",
		originY: "center",
		fontSize: bakedFontSize,
		fontFamily: cfg.fontFamily ?? "Inter",
		editable: true,
	});

	editable.clipPath = group.clipPath;

	// 💾 guardamos TODO lo necesario para reconstruir la plantilla igualita
	(editable as IText & CurvedMeta).__curveConfig = {
		...cfg,
		radius: effectiveRadius, // ya incluye la escala
		totalAngle,
		centerX: group.left,
		centerY: group.top,
		bakedFontSize,
	};

	// importante: el editable NO lleva escala, ya la horneamos en bakedFontSize
	editable.scaleX = 1;
	editable.scaleY = 1;

	group.off();
	canvas.remove(group);
	canvas.add(editable);
	canvas.setActiveObject(editable);
	canvas.requestRenderAll();

	editable.enterEditing();
	editable.selectAll();

	editable.once("editing:exited", () => {
		convertEditableToCurved(canvas, editable);
	});
}

/**
 * Convertir texto editable → curvo otra vez
 */
export function convertEditableToCurved(canvas: Canvas, textbox: IText) {
	const cfg = (textbox as IText & CurvedMeta).__curveConfig;
	if (!cfg) return;

	const textStr = textbox.text ?? "";
	const len = Math.max(textStr.length - 1, 0);

	// usamos siempre el mismo ángulo total de la plantilla
	const totalAngle =
		cfg.totalAngle ??
		(cfg.spacing ?? 0) * Math.max((cfg.text ?? "").length - 1, 0);

	const spacing = len > 0 ? totalAngle / len : 0;

	const centerX = cfg.centerX ?? textbox.left ?? 0;
	const centerY = cfg.centerY ?? textbox.top ?? 0;

	const curved = createCurvedTextGroup(
		{
			text: textStr,
			radius: cfg.radius ?? 150, // radio ya “fixeado”
			spacing,
			direction: cfg.direction,
			fontSize: cfg.bakedFontSize ?? cfg.fontSize ?? textbox.fontSize,
			fontFamily: cfg.fontFamily ?? (textbox.fontFamily as string) ?? "Inter",
		},
		centerX,
		centerY,
	);

	curved.clipPath = textbox.clipPath;

	// 🚫 NO re-aplicamos escala: ya está “horneada” en radius + fontSize
	curved.scaleX = 1;
	curved.scaleY = 1;

	const curvedMeta = curved as Group & CurvedMeta;
	curvedMeta.designType = "curved-text";
	curvedMeta.__curveConfig = {
		...cfg,
		text: textStr,
		spacing,
		totalAngle,
		centerX,
		centerY,
		bakedFontSize: cfg.bakedFontSize ?? textbox.fontSize,
	};

	textbox.off();
	canvas.remove(textbox);
	canvas.add(curved);
	canvas.setActiveObject(curved);
	canvas.requestRenderAll();
}

type PlainCurveCfg = {
	radius: number;
	spacing: number;
	direction: "arc-up" | "arc-down";
	curved?: number;
};

export function convertPlainToCurved(
	canvas: Canvas,
	textbox: IText,
	curveCfg: PlainCurveCfg,
) {
	if (textbox.left == null || textbox.top == null) return;

	const { radius, spacing, direction } = curveCfg;

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
	const groupMeta = group as Group & CurvedMeta;
	groupMeta.designType = "curved-text";
	groupMeta.__curveConfig = {
		text: textbox.text ?? "",
		radius,
		spacing,
		direction,
		fontSize: textbox.fontSize,
		fontFamily: textbox.fontFamily ?? "Inter",
	};

	// reemplazar objeto
	textbox.off();
	canvas.remove(textbox);
	canvas.add(group);
	canvas.setActiveObject(group);
	canvas.requestRenderAll();
}

export function convertCurvedToPlain(canvas: Canvas, curvedGroup: Group) {
	const cfg = (curvedGroup as Group & CurvedMeta).__curveConfig;
	if (!cfg) return;

	// Detectar tamaño real (considerando escala)
	const letters = ((curvedGroup as Group & CurvedMeta)._objects ??
		[]) as Text[];
	const first = letters[0];

	const effectiveFontSize =
		(first.fontSize ?? cfg.fontSize ?? 40) * (first.scaleX ?? 1);

	const centerX = curvedGroup.left ?? 0;
	const centerY = curvedGroup.top ?? 0;
	const scaleX = curvedGroup.scaleX ?? 1;
	const scaleY = curvedGroup.scaleY ?? 1;

	// Crear texto plano
	const plain = new IText(cfg.text, {
		left: centerX,
		top: centerY,
		originX: "center",
		originY: "center",
		fontSize: effectiveFontSize,
		fontFamily: cfg.fontFamily ?? "Inter",
		editable: true,
	});

	// Mantener escala visual exacta
	plain.scaleX = scaleX;
	plain.scaleY = scaleY;

	plain.clipPath = curvedGroup.clipPath;

	// Guardar la configuración por si vuelve a curvo después
	(plain as IText & CurvedMeta).__curveConfig = {
		...cfg,
		text: cfg.text,
		//⚠️ IMPORTANTE: guardar totalAngle original para que pueda regresar igual
		totalAngle: cfg.totalAngle,
		centerX,
		centerY,
		bakedFontSize: effectiveFontSize,
		scaleX,
		scaleY,
	};

	// Quitar grupo curvo y reemplazarlo por texto plano
	curvedGroup.off();
	canvas.remove(curvedGroup);
	canvas.add(plain);
	canvas.setActiveObject(plain);
	canvas.requestRenderAll();

	return plain;
}

// 🔧 Actualizar curva de un texto curvo con un slider 0–100
export function updateCurvedAmount(
	canvas: Canvas,
	curvedGroup: Group,
	curvedValue: number,
) {
	const cfg = (curvedGroup as Group & CurvedMeta).__curveConfig;
	if (!cfg) return;

	const text: string = cfg.text;
	const len = Math.max(text.length - 1, 1);

	// clamp -100..100
	const curvedRaw = Math.max(-100, Math.min(100, curvedValue));
	const curvedAbs = Math.abs(curvedRaw);

	// 0 => volver a texto plano
	if (curvedAbs === 0) {
		convertCurvedToPlain(canvas, curvedGroup);
		return;
	}

	const baseTotalAngle = cfg.baseTotalAngle ?? 360;

	let totalAngle = (curvedAbs / 100) * baseTotalAngle; // SIEMPRE positivo
	let spacing = totalAngle / len; // SIEMPRE positivo

	// mejor minSpacing proporcional al fontSize
	const minSpacing = Math.max(2, (cfg.fontSize ?? 40) * 0.08);
	if (spacing < minSpacing) {
		spacing = minSpacing;
		totalAngle = spacing * len;
	}

	// dirección basada SOLO en el signo — pero NO reordenar texto
	const baseDir: "arc-up" | "arc-down" = cfg.direction ?? "arc-up";
	const direction =
		curvedRaw >= 0 ? baseDir : baseDir === "arc-up" ? "arc-down" : "arc-up";

	// USAR SIEMPRE EL CENTRO ORIGINAL
	const centerX = cfg.centerX ?? 0;
	const centerY = cfg.centerY ?? 0;

	const newGroup = createCurvedTextGroup(
		{
			text,
			radius: cfg.radius ?? 150,
			spacing,
			direction,
			fontSize: cfg.fontSize,
			fontFamily: cfg.fontFamily ?? "Inter",
		},
		centerX,
		centerY,
	);

	newGroup.clipPath = curvedGroup.clipPath;
	newGroup.scaleX = curvedGroup.scaleX;
	newGroup.scaleY = curvedGroup.scaleY;

	const newMeta = newGroup as Group & CurvedMeta;
	newMeta.designType = "curved-text";
	newMeta.__curveConfig = {
		...cfg,
		curved: curvedRaw,
		curvedAbs,
		spacing,
		direction,
		centerX,
		centerY,
	};

	canvas.remove(curvedGroup);
	canvas.add(newGroup);
	canvas.setActiveObject(newGroup);
	canvas.requestRenderAll();
}
