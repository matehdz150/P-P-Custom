"use client";

import {
	Canvas,
	Circle,
	Image as FabricImage,
	type FabricObject,
	Rect,
	type TPointerEvent,
	type TPointerEventInfo,
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

		// -----------------------------------------
		// 🔥 ZOOM CON RUEDA DEL MOUSE
		// -----------------------------------------

		const handleWheel = (opt: TPointerEventInfo<WheelEvent>) => {
			const delta = opt.e.deltaY;
			let zoom = c.getZoom();

			zoom *= delta > 0 ? 0.9 : 1.1;
			zoom = Math.max(0.3, Math.min(zoom, 3));

			const pointer = c.getPointer(opt.e);
			c.zoomToPoint(pointer, zoom);

			opt.e.preventDefault();
			opt.e.stopPropagation();
		};

		c.on("mouse:wheel", handleWheel);

		// ---------------------------------------------
		// 🔥 PINCH-ZOOM para mobile (Fabric 6)
		// ---------------------------------------------
		let lastDist = 0;

		const getDistance = (a: Touch, b: Touch) =>
			Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);

		const handleTouchMove = (opt: TPointerEventInfo<TouchEvent>) => {
			const ev = opt.e;

			if (ev.touches.length < 2) return;

			const [t1, t2] = ev.touches;

			const dist = getDistance(t1, t2);

			if (lastDist === 0) {
				lastDist = dist;
				return;
			}

			const delta = dist - lastDist;
			lastDist = dist;

			let zoom = c.getZoom() + delta / 300;
			zoom = Math.max(0.3, Math.min(zoom, 3));

			// 👉 Aquí declaramos mid correctamente (el error que tenías)
			const mid = {
				clientX: (t1.clientX + t2.clientX) / 2,
				clientY: (t1.clientY + t2.clientY) / 2,
			};

			// 👉 Fabric necesita un "evento" compatible
			const fabricEvent: {
				clientX: number;
				clientY: number;
				isTouch?: boolean;
				target?: EventTarget | null;
			} = {
				clientX: mid.clientX,
				clientY: mid.clientY,
				isTouch: true,
			};

			const pe = new PointerEvent("pointermove", {
				clientX: mid.clientX,
				clientY: mid.clientY,
				pointerType: "touch",
			});

			// 👉 Fabric sí acepta un PointerEvent nativo
			const pointer = c.getPointer(pe as unknown as TPointerEvent);
			c.zoomToPoint(pointer, zoom);
			c.zoomToPoint(pointer, zoom);

			ev.preventDefault();
			ev.stopPropagation();
		};

		const resetPinch = () => {
			lastDist = 0;
		};

		c.on("mouse:move", handleTouchMove);
		c.on("mouse:up", resetPinch);

		// -----------------------------------------
		// 🔥 MOCKUP IMAGE
		// -----------------------------------------
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

		// -----------------------------------------
		// Editable areas
		// -----------------------------------------
		const shapes = product.editableAreas[side] ?? [];
		const areaRects: FabricObject[] = [];

		shapes.forEach((shape) => {
			const areaObj = createAreaFromShape(shape);
			c.add(areaObj);
			areaRects.push(areaObj);
		});

		setEditableAreas(side, areaRects);
		registerCanvas(side, c);

		// -----------------------------------------
		// Selection listeners
		// -----------------------------------------
		const onSel = () => setActiveObject(c.getActiveObject() ?? null);
		const onClear = () => setActiveObject(null);

		c.on("selection:created", onSel);
		c.on("selection:updated", onSel);
		c.on("selection:cleared", onClear);

		// -----------------------------------------
		// 🔥 FIX FABRIC TEXTAREA POSITION ON MOBILE
		// -----------------------------------------
		if (isMobile) {
			const fixTextareaPosition = () => {
				const textarea = document.querySelector(
					'textarea[data-fabric="textarea"]',
				) as HTMLTextAreaElement | null;

				if (!textarea) return;

				textarea.style.position = "fixed";
				textarea.style.left = "100px";
				textarea.style.top = "120px";
				textarea.style.width = "1px";
				textarea.style.height = "1px";
				textarea.style.opacity = "0";
				textarea.style.zIndex = "-1";
				textarea.style.transform = "none";
				textarea.style.fontSize = "16px";
			};

			const handleEditingEntered = () => {
				requestAnimationFrame(fixTextareaPosition);
			};

			c.on("text:editing:entered", handleEditingEntered);

			// cleanup MOBILE
			return () => {
				c.off("mouse:wheel", handleWheel);
				c.off("mouse:move", handleTouchMove);
				c.off("mouse:up", resetPinch);
				c.off("selection:created", onSel);
				c.off("selection:updated", onSel);
				c.off("selection:cleared", onClear);
				c.off("text:editing:entered", handleEditingEntered);
				c.dispose();
			};
		}

		// cleanup DESKTOP
		return () => {
			c.off("mouse:wheel", handleWheel);
			c.off("mouse:move", handleTouchMove);
			c.off("mouse:up", resetPinch);
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
        ${
					isVisible
						? "opacity-100 pointer-events-auto"
						: "opacity-0 pointer-events-none"
				}
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
