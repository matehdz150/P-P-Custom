// apps/web/lib/fabric/insertDesignTemplate.ts

import { type Canvas, Rect } from "fabric";
import { createCurvedTextGroup } from "./curvedTextEngine";
import type { CurvedTextTemplate } from "./types";

/**
 * Inserta directamente un texto curvo (no plano) usando createCurvedTextGroup.
 */
export async function insertDesignTemplate(canvas: Canvas, templateId: string) {
	const res = await fetch(`/design-templates/${templateId}.json`);
	if (!res.ok) {
		console.error("No se pudo cargar la plantilla:", templateId);
		return;
	}

	const template = (await res.json()) as CurvedTextTemplate;
	if (!template) return;

	const area = (canvas as Canvas & { editableArea?: Rect }).editableArea;
	if (!area) return;

	const cx = area.left + area.width / 2;
	const cy = area.top + area.height / 2;

	// 👉 Crear texto directamente curvado
	const curved = createCurvedTextGroup(template, cx, cy);

	// 👉 Guardar configuración para permitir edición luego
	(
		curved as typeof curved & {
			designType?: string;
			template?: CurvedTextTemplate;
		}
	).designType = "curved-text";
	(
		curved as typeof curved & {
			designType?: string;
			template?: CurvedTextTemplate;
		}
	).template = template;

	// 👉 Clip dentro del área editable
	curved.clipPath = new Rect({
		left: area.left,
		top: area.top,
		width: area.width,
		height: area.height,
		absolutePositioned: true,
	});

	canvas.add(curved);
	canvas.setActiveObject(curved);
	canvas.requestRenderAll();
}
