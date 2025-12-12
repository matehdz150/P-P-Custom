"use client";

import {
	Canvas,
	Circle,
	Image as FabricImage,
	type FabricObject,
	Rect,
} from "fabric";
import { useEffect, useRef } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type {
	EditableShape,
	ProductSide,
	ProductTemplate,
} from "@/lib/products/types";

import { useIsMobile } from "./hooks/useIsMobile";

// -----------------------------
// Helpers para crear áreas editables desde JSON
// -----------------------------
function createAreaFromShape(shape: EditableShape): FabricObject {
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

	throw new Error(`Unsupported shape type: ${shape.type ?? "unknown"}`);
}

type Props = {
	side: ProductSide;
	product: ProductTemplate;
};

// -----------------------------
// Canvas de UN lado
// -----------------------------
export default function DesignerCanvasSide({ side, product }: Props) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const { registerCanvas, setEditableAreas, setActiveObject, activeSide } =
		useDesigner();

	const isMobile = useIsMobile();
	const scale = isMobile ? 0.6 : 1;

	useEffect(() => {
		if (!canvasRef.current) return;

		const c = new Canvas(canvasRef.current, {
			width: 1445,
			height: 825,
			selection: true,
		});

		c.backgroundColor = "#f2f3ea";
		c.selectionColor = "rgba(254, 98, 65, 0.15)";
		c.selectionBorderColor = "#fe6241";
		c.selectionLineWidth = 2;

		// mockup desde plantilla
		const mockupUrl = product.mockups[side];

		if (mockupUrl) {
			FabricImage.fromURL(mockupUrl).then((img) => {
				img.scaleToWidth(700);
				img.originX = "center";
				img.originY = "center";
				img.left = c.getWidth() / 2;
				img.top = c.getHeight() / 2;
				img.selectable = false;

				c.backgroundImage = img;
				c.requestRenderAll();
			});
		}

		// ÁREAS EDITABLES
		const shapes = product.editableAreas[side] ?? [];
		const areaRects: FabricObject[] = [];

		shapes.forEach((shape) => {
			const areaObj = createAreaFromShape(shape);
			c.add(areaObj);
			areaRects.push(areaObj);
		});

		setEditableAreas(side, areaRects);
		registerCanvas(side, c);

		// listeners de selección
		const onSel = () => setActiveObject(c.getActiveObject() ?? null);
		const onClear = () => setActiveObject(null);

		c.on("selection:created", onSel);
		c.on("selection:updated", onSel);
		c.on("selection:cleared", onClear);

		// 🔥 FIX: reubicar el textarea de Fabric en MOBILE
		if (isMobile) {
			const fixTextareaPosition = () => {
				const textarea = document.querySelector(
					'textarea[data-fabric="textarea"]',
				) as HTMLTextAreaElement | null;

				if (!textarea) return;

				// Lo hacemos fijo y en un lugar estable
				textarea.style.position = "fixed";
				textarea.style.left = "100px";
				textarea.style.top = "120px";

				textarea.style.width = "1px";
				textarea.style.height = "1px";
				textarea.style.opacity = "0";
				textarea.style.zIndex = "-1";
				textarea.style.transform = "none";

				// Evitar zoom raro en mobile
				textarea.style.fontSize = "16px";
			};

			const handleEditingEntered = () => {
				// Dejamos que Fabric lo pinte y luego lo corregimos
				requestAnimationFrame(fixTextareaPosition);
			};

			c.on("text:editing:entered", handleEditingEntered);

			// limpieza
			return () => {
				c.off("selection:created", onSel);
				c.off("selection:updated", onSel);
				c.off("selection:cleared", onClear);
				c.off("text:editing:entered", handleEditingEntered);
				c.dispose();
			};
		}

		// cleanup cuando NO es mobile
		return () => {
			c.off("selection:created", onSel);
			c.off("selection:updated", onSel);
			c.off("selection:cleared", onClear);
			c.dispose();
		};
	}, [
		product,
		side,
		registerCanvas,
		setEditableAreas,
		setActiveObject,
		isMobile,
	]);

	const isVisible = activeSide === side;

	return (
		<div
			className={`
        absolute inset-0 
        flex justify-center items-center
        transition-opacity duration-200
        ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
      `}
			style={{ zIndex: isVisible ? 2 : 1 }}
		>
			{/* wrapper escalado */}
			<div
				style={{
					transform: `scale(${scale})`,
					transformOrigin: "top center",
					marginTop: isMobile ? 300 : 0,
					marginLeft: isMobile ? 10 : 0,
				}}
			>
				<canvas
					ref={canvasRef}
					width={1445}
					height={825}
					className="absolute inset-0"
				/>
			</div>
		</div>
	);
}
