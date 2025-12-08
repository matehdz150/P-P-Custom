"use client";

import { useEffect, useRef, useState } from "react";
import "@/lib/fabricOverrides";
import { Canvas, Image as FabricImage, Rect } from "fabric";
import { useDesigner } from "@/Contexts/DesignerContext";
import { loadProductTemplate } from "@/lib/products/loadProductsTemplate";
import type {
	EditableShape,
	ProductSide,
	ProductTemplate,
} from "@/lib/products/types";
import DesignerSidebar from "./DesignerSidebar";
import DesignerBottomBar from "./design/DesignerBottomBar";
import DesignerSideSwitcher from "./design/DesignerSideSwitcher";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasZoom } from "./hooks/useCanvasZoom";

// -----------------------------
// Helpers para crear áreas editables desde JSON
// -----------------------------
function createAreaFromShape(shape: EditableShape): Rect {
	// por ahora solo type: "rect"
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

// -----------------------------
// Canvas de UN lado
// -----------------------------
function DesignerCanvasSide({
	side,
	product,
}: {
	side: ProductSide;
	product: ProductTemplate;
}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const { registerCanvas, setEditableAreas, setActiveObject, activeSide } =
		useDesigner();

	useEffect(() => {
		if (!canvasRef.current) return;

		const c = new Canvas(canvasRef.current, {
			width: 1200,
			height: 750,
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

		// áreas editables definidas en JSON
		const shapes = product.editableAreas[side] ?? [];
		const areaRects: Rect[] = [];
		type CanvasWithEditableAreas = Canvas & { editableAreas?: Rect[] };

		shapes.forEach((shape) => {
			const areaObj = createAreaFromShape(shape);
			c.add(areaObj);
			areaRects.push(areaObj);
		});

		// guardamos TODAS las áreas en el contexto
		setEditableAreas(side, areaRects);

		// también guardamos todas en el canvas mismo para usarlas después
		(c as CanvasWithEditableAreas).editableAreas = areaRects;

		// registrar canvas en contexto
		registerCanvas(side, c);

		// listeners de selección → actualizan activeObject global
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
      absolute inset-0 flex justify-center items-center
      transition-opacity duration-200
      ${
				isVisible
					? "opacity-100 pointer-events-auto"
					: "opacity-0 pointer-events-none"
			}
    `}
			style={{ zIndex: isVisible ? 2 : 1 }} // asegura stacking correcto
		>
			<canvas
				ref={canvasRef}
				width={1200}
				height={750}
				style={{
					maxWidth: "100%",
					maxHeight: "100%",
					display: "block",
				}}
			/>
		</div>
	);
}

// -----------------------------
// Shell completo
// -----------------------------
export default function DesignerCanvas() {
	const { getCanvas, activeSide, setActiveSide } = useDesigner();
	const [isPanning, setIsPanning] = useState(false);
	const [product, setProduct] = useState<ProductTemplate | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadProductTemplate("tshirt")
			.then(setProduct)
			.catch((err) => {
				console.error(err);
				setError("No se pudo cargar la plantilla de producto.");
			});
	}, []);

	// 🔥 DELETE KEY HANDLER — eliminas objetos seleccionados
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Delete (Win) o Backspace (Mac también)
			if (e.key !== "Delete" && e.key !== "Backspace") return;

			const canvas = getCanvas();
			if (!canvas) return;

			const activeObjects = canvas.getActiveObjects();
			if (!activeObjects || activeObjects.length === 0) return;

			// Opcional: prevenir borrar cosas "sistémicas"
			// como las áreas editables (pero ya las tenemos como selectable: false)

			// Limpia selección primero
			canvas.discardActiveObject();

			// Eliminar todos los objetos seleccionados
			activeObjects.forEach((obj) => {
				canvas.remove(obj);
			});

			canvas.requestRenderAll();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [getCanvas]);

	const canvas = getCanvas();
	const { zoom, zoomIn, zoomOut } = useCanvasZoom(canvas);
	useCanvasPan({ fabricCanvas: canvas, isPanning });

	if (error) {
		return <div className="p-4 text-red-600">{error}</div>;
	}

	if (!product) {
		return <div className="p-4">Cargando producto...</div>;
	}

	return (
		<div className="w-full h-screen flex overflow-hidden">
			<DesignerSidebar />

			<div className="flex-1 bg-white relative overflow-hidden flex justify-center items-center">
				{product.sides.map((side) => (
					<DesignerCanvasSide key={side} side={side} product={product} />
				))}

				<DesignerSideSwitcher
					currentSide={activeSide}
					sides={product.sides}
					onChange={setActiveSide}
				/>

				<DesignerBottomBar
					zoom={zoom}
					zoomIn={zoomIn}
					zoomOut={zoomOut}
					isPanning={isPanning}
					togglePan={() => setIsPanning(!isPanning)}
				/>
			</div>
		</div>
	);
}
