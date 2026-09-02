// hooks/useFabricCanvas.ts
"use client";

import {
	Canvas,
	Circle,
	Ellipse,
	type FabricObject,
	Rect,
	Textbox,
	Triangle,
	util,
} from "fabric";
import { useEffect, useRef } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { leerBorrador } from "@/lib/pedido/borrador";
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

	if (shape.type === "ellipse") {
		return new Ellipse({
			left: shape.left,
			top: shape.top,
			rx: shape.width / 2,
			ry: shape.height / 2,
			fill: "rgba(0,0,0,0.05)",
			selectable: false,
			evented: false,
		});
	}

	if (shape.type === "triangle") {
		return new Triangle({
			left: shape.left,
			top: shape.top,
			width: shape.width,
			height: shape.height,
			fill: "rgba(0,0,0,0.05)",
			selectable: false,
			evented: false,
		});
	}

	// legacy: círculo con cx/cy/radius
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
		c.selectionBorderColor = "#2b2812";
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

		/* ---- volver del checkout con el diseño puesto ----

		   Si hay un borrador de ESTE producto, sus objetos se reponen encima de
		   las guías que se acaban de crear. Sin esto, el enlace "volver a editar"
		   de la pantalla de pedido devolvería un lienzo en blanco y habría que
		   rehacer el diseño entero para cambiar una talla.

		   Se guardan sólo los objetos del cliente, no el lienzo completo, así que
		   aquí no hay que filtrar nada ni se duplican las guías. */
		let cancelado = false;

		leerBorrador()
			.then(async (borrador) => {
				if (cancelado || !borrador) return;
				if (borrador.productoId !== product.id) return;

				const guardados = borrador.diseno?.[side];
				if (!guardados?.length) return;

				const vivos = await util.enlivenObjects<FabricObject>(guardados);

				// El lienzo pudo desmontarse mientras Fabric cargaba las imágenes
				// del diseño: añadirlos ahí reventaría sobre un canvas ya dispuesto.
				if (cancelado) return;

				for (const objeto of vivos) c.add(objeto);
				c.requestRenderAll();
			})
			.catch(() => {
				// Un borrador ilegible no puede impedir diseñar desde cero.
			});

		// ---- selection ----
		const onSel = () => setActiveObject(c.getActiveObject() ?? null);
		const onClear = () => setActiveObject(null);

		// ---- auto select all text on edit ----
		const onTextEditingEntered = (options: { target?: FabricObject }) => {
			const target = options.target;

			if (!(target instanceof Textbox)) return;

			// ✅ Espera EXACTA a que Fabric monte el textarea interno
			requestAnimationFrame(() => {
				target.selectAll();
				c.requestRenderAll();
			});
		};

		c.on("text:editing:entered", onTextEditingEntered);

		c.on("text:editing:entered", onTextEditingEntered);
		c.on("selection:created", onSel);
		c.on("selection:updated", onSel);
		c.on("selection:cleared", onClear);

		return () => {
			cancelado = true;

			c.off("selection:created", onSel);
			c.off("selection:updated", onSel);
			c.off("selection:cleared", onClear);
			c.off("text:editing:entered", onTextEditingEntered);

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
