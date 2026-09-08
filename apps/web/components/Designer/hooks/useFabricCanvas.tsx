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
import {
	cargarDisenoGuardado,
	rutaDisenoDeLaUrl,
} from "@/lib/pedido/disenoGuardado";
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
			/* El sangrado viaja PEGADO al objeto del área y no por otro canal: lo
			   necesitan siete sitios distintos —el clip de cada herramienta y la
			   exportación— y pasarlo por props obligaría a hilarlo por toda la
			   jerarquía del editor. Aquí lo leen todos del mismo dato. */
			(area as FabricObject & { sangradoPx?: number }).sangradoPx =
				shape.sangradoPx;
			/* MARCA DE ANDAMIO. El área es un objeto del lienzo como cualquier
			   diseño, y algo que recorra los objetos no tiene cómo distinguirla:
			   el plateado del grabado la tiñó entera por no saberlo. Se marca al
			   crearla —y no consultando la lista registrada— porque esa lista se
			   publica DESPUÉS de añadirla al lienzo, y quien escuche
			   `object:added` la ve antes de que exista. */
			(area as FabricObject & { esAndamio?: boolean }).esAndamio = true;
			c.add(area);
			areas.push(area);
		}

		setEditableAreas(side, areas);
		registerCanvas(side, c);

		/* ---- abrir con un diseño ya hecho ----

		   Los objetos se reponen encima de las guías que se acaban de crear. Se
		   guardan SÓLO los objetos del cliente, no el lienzo entero, así que aquí
		   no hay que filtrar nada ni se duplican los recuadros del área. */
		let cancelado = false;

		/* DOS ORÍGENES, Y LA URL MANDA.

		   `?diseno=<ruta>` abre uno que ya se hizo —de un pedido, o guardado con
		   nombre— para volver a pedirlo con otras tallas. Sin él se restaura el
		   borrador local de siempre.

		   Cuando viene por la URL el borrador se IGNORA a propósito: si no,
		   quien abre su logo de cada mes se encontraría encima lo que dejó a
		   medias hace un rato, y los objetos de los dos diseños mezclados. */
		const desdeLaUrl = rutaDisenoDeLaUrl();

		const objetosDelLado = desdeLaUrl
			? cargarDisenoGuardado(desdeLaUrl).then((d) => d?.[side])
			: leerBorrador().then((b) =>
					b && b.productoId === product.id ? b.diseno?.[side] : undefined,
				);

		objetosDelLado
			.then(async (guardados) => {
				if (cancelado || !guardados?.length) return;

				const vivos = await util.enlivenObjects<FabricObject>(guardados);

				// El lienzo pudo desmontarse mientras Fabric cargaba las imágenes
				// del diseño: añadirlos ahí reventaría sobre un canvas ya dispuesto.
				if (cancelado) return;

				const bloquearBase =
					typeof window !== "undefined" &&
					new URLSearchParams(window.location.search).get("bloquear") === "1";
				const primeraCargaDeBase =
					typeof window !== "undefined" &&
					new URLSearchParams(window.location.search).get("baseEvento") === "1";
				for (const objeto of vivos) {
					const objetoDeEvento = objeto as FabricObject & {
						esBaseDeEvento?: boolean;
					};
					if (primeraCargaDeBase) objetoDeEvento.esBaseDeEvento = true;
					if (bloquearBase && objetoDeEvento.esBaseDeEvento) {
						objeto.set({
							selectable: false,
							evented: false,
							lockMovementX: true,
							lockMovementY: true,
							lockScalingX: true,
							lockScalingY: true,
							lockRotation: true,
						});
					}
					c.add(objeto);
				}
				c.requestRenderAll();
			})
			.catch(() => {
				// Un diseño ilegible no puede impedir diseñar desde cero.
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

		// Una sola vez: estaba registrado dos veces con un solo `off` en la
		// limpieza, así que el manejador corría por duplicado y cada montaje
		// dejaba un oyente vivo sobre un lienzo ya dispuesto.
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
