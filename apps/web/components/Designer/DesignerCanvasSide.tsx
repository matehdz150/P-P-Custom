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

	const unknownShape: { type?: string } = shape;
	const exhaustiveCheck: never = shape;
	void exhaustiveCheck;
	throw new Error(`Unsupported shape type: ${unknownShape.type ?? "unknown"}`);
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
		type CanvasWithEditableAreas = Canvas & { editableAreas?: FabricObject[] };

		shapes.forEach((shape) => {
			const areaObj = createAreaFromShape(shape);
			c.add(areaObj);
			areaRects.push(areaObj);
		});

		setEditableAreas(side, areaRects);
		(c as CanvasWithEditableAreas).editableAreas = areaRects;

		registerCanvas(side, c);

		// listeners de selección
		const onSelCreated = () => setActiveObject(c.getActiveObject() ?? null);
		const onSelUpdated = () => setActiveObject(c.getActiveObject() ?? null);
		const onSelCleared = () => setActiveObject(null);

		c.on("selection:created", onSelCreated);
		c.on("selection:updated", onSelUpdated);
		c.on("selection:cleared", onSelCleared);

		return () => {
			c.off("selection:created", onSelCreated);
			c.off("selection:updated", onSelUpdated);
			c.off("selection:cleared", onSelCleared);
			c.dispose();
		};
	}, [product, side, registerCanvas, setEditableAreas, setActiveObject]);

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
			<canvas
				ref={canvasRef}
				width={1445}
				height={825}
				className="absolute inset-0 w-full h-full"
			/>
		</div>
	);
}
