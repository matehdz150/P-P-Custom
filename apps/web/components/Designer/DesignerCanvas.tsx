"use client";

import {
	Canvas,
	Image as FabricImage,
	type FabricObject,
	type Group,
	Rect,
} from "fabric";
import { useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { convertCurvedToEditable } from "@/lib/fabric/editableCurvedText";
import DesignerSidebar from "./DesignerSidebar";
import DesignerBottomBar from "./design/DesignerBottomBar";
import DesignerPropertiesPanel from "./design/DesignerpropertiesPanel";
import DesignerSideSwitcher from "./design/DesignerSideSwitcher";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasZoom } from "./hooks/useCanvasZoom";

export default function DesignerCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// ⬅️ Traemos canvas + setters desde el contexto
	const { canvas, setCanvas, setActiveObject } = useDesigner();

	const [side, setSide] = useState<"front" | "back">("front");
	const [isPanning, setIsPanning] = useState(false);

	const { zoom, zoomIn, zoomOut } = useCanvasZoom(canvas);
	useCanvasPan({ fabricCanvas: canvas, isPanning });

	// -----------------------------------------------------------
	// INIT CANVAS
	// -----------------------------------------------------------
	useEffect(() => {
		if (!canvasRef.current) return;
		if (canvas) return; // ya inicializado

		const c = new Canvas(canvasRef.current, {
			width: 1200,
			height: 750,
			selection: true,
		});

		c.backgroundColor = "#f2f3ea";

		const editableArea = new Rect({
			left: 460,
			top: 235,
			width: 270,
			height: 350,
			fill: "rgba(0,0,0,0.05)",
			selectable: false,
			evented: false,
		});

		c.add(editableArea);

		// Guardamos referencia a la zona editable en el canvas
		(c as Canvas & { editableArea?: Rect }).editableArea = editableArea;

		// Guardamos canvas en el contexto
		setCanvas(c);

		// Listeners para actualizar selectedObject
		const updateActive = () => {
			setActiveObject(c.getActiveObject() ?? null);
		};

		c.on("selection:created", updateActive);

		c.on("selection:updated", updateActive);

		c.on("selection:cleared", () => {
			setActiveObject(null);
		});

		return () => {
			c.off("selection:created", updateActive);
			c.off("selection:updated", updateActive);
			c.dispose();
		};
	}, [canvas, setActiveObject, setCanvas]);

	// -----------------------------------------------------------
	// LOAD MOCKUP
	// -----------------------------------------------------------
	useEffect(() => {
		if (!canvas) return;

		const url =
			side === "front" ? "/mockups/tshirtfront.png" : "/mockups/tshirtback.png";

		FabricImage.fromURL(url).then((img) => {
			img.scaleToWidth(700);
			img.originX = "center";
			img.originY = "center";
			img.left = canvas.getWidth() / 2;
			img.top = canvas.getHeight() / 2;
			img.selectable = false;

			canvas.backgroundImage = img;
			canvas.requestRenderAll();
		});
	}, [side, canvas]);

	// -----------------------------------------------------------
	// DOUBLE CLICK → CURVED → EDITABLE
	// -----------------------------------------------------------
	useEffect(() => {
		if (!canvas) return;

		const dblHandler = (e: { target?: FabricObject }) => {
			const obj = e.target;
			if (!obj) return;

			if (
				(obj as FabricObject & { designType?: string }).designType ===
				"curved-text"
			) {
				convertCurvedToEditable(canvas, obj as Group);
			}
		};

		canvas.on("mouse:dblclick", dblHandler);

		return () => {
			canvas.off("mouse:dblclick", dblHandler);
		};
	}, [canvas]);

	// -----------------------------------------------------------
	// RENDER
	// -----------------------------------------------------------
	return (
		<div className="w-full h-screen flex overflow-hidden">
			<DesignerSidebar />

			<div className="flex-1 flex justify-center items-center bg-white relative">
				<canvas ref={canvasRef} className="border shadow-md" />

				<DesignerSideSwitcher side={side} onChange={setSide} />
				<DesignerBottomBar
					zoom={zoom}
					zoomIn={zoomIn}
					zoomOut={zoomOut}
					isPanning={isPanning}
					togglePan={() => setIsPanning(!isPanning)}
				/>
			</div>

			<DesignerPropertiesPanel />
		</div>
	);
}
