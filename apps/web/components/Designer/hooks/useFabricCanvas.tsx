// hooks/useFabricCanvas.ts
"use client";

import { Canvas, Circle, type FabricObject, Rect } from "fabric";
import { useEffect, useRef } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type {
	EditableShape,
	ProductSide,
	ProductTemplate,
} from "@/lib/products/types";

function createAreaFromShape(
	shape: EditableShape & { type: string },
): FabricObject {
	if (shape.type === "rect") {
		return new Rect({
			left: shape.left,
			top: shape.top,
			width: shape.width,
			height: shape.height,
			fill: "rgba(0,0,0,0.05)",
			selectable: false,
			evented: false,
		});
	}

	if (shape.type === "circle") {
		return new Circle({
			left: shape.cx - shape.radius,
			top: shape.cy - shape.radius,
			radius: shape.radius,
			fill: "rgba(0,0,0,0.05)",
			selectable: false,
			evented: false,
		});
	}

	throw new Error("Unsupported shape type");
}

type HostRef = React.RefObject<HTMLDivElement | null>;

export function useFabricCanvas(
	hostRef: HostRef,
	side: ProductSide,
	product: ProductTemplate,
) {
	const fabricRef = useRef<Canvas | null>(null);
	const { registerCanvas, setEditableAreas, setActiveObject } = useDesigner();

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		// ✅ React no renderiza el canvas, lo creamos nosotros
		const el = document.createElement("canvas");
		el.width = 1445;
		el.height = 825;
		el.className = "absolute inset-0";
		host.appendChild(el);

		const c = new Canvas(el, {
			width: 1445,
			height: 825,
			selection: true,
		});

		fabricRef.current = c;

		c.backgroundColor = "#f2f3ea";
		c.selectionColor = "rgba(254, 98, 65, 0.15)";
		c.selectionBorderColor = "#fe6241";
		c.selectionLineWidth = 2;

		// ---- editable areas ----
		const shapes = product.editableAreas[side] ?? [];
		const areas: FabricObject[] = [];

		for (const shape of shapes) {
			const area = createAreaFromShape(shape);
			c.add(area);
			areas.push(area);
		}

		setEditableAreas(side, areas);
		registerCanvas(side, c);

		// ---- selection ----
		const onSel = () => setActiveObject(c.getActiveObject() ?? null);
		const onClear = () => setActiveObject(null);

		c.on("selection:created", onSel);
		c.on("selection:updated", onSel);
		c.on("selection:cleared", onClear);

		return () => {
			c.off("selection:created", onSel);
			c.off("selection:updated", onSel);
			c.off("selection:cleared", onClear);

			c.dispose();
			fabricRef.current = null;

			// limpiar DOM creado
			el.remove();
		};
	}, [
		hostRef,
		side,
		product,
		registerCanvas,
		setEditableAreas,
		setActiveObject,
	]);

	// ✅ NO leas refs durante render → devolvemos getter
	return {
		getCanvas: () => fabricRef.current,
	};
}
