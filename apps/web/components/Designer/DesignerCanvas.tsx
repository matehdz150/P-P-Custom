import { useEffect, useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { CanvasEngine } from "@/lib/fabric/core/canvasEngine";
import { loadProductDefinition } from "@/lib/fabric/core/productEngine";
import DesignerSidebar from "./DesignerSidebar";
import DesignerBottomBar from "./design/DesignerBottomBar";
import DesignerPropertiesPanel from "./design/DesignerpropertiesPanel";
import DesignerSideSwitcher from "./design/DesignerSideSwitcher";

export default function DesignerCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const engineRef = useRef<CanvasEngine | null>(null);

	const { setCanvas, setActiveObject } = useDesigner();

	const [side, setSide] = useState<"front" | "back">("front");
	const [zoom, setZoom] = useState(1);
	const [isPanning, setIsPanning] = useState(false);

	useEffect(() => {
		if (!canvasRef.current) return;

		// Create engine
		const engine = new CanvasEngine(canvasRef.current);
		engineRef.current = engine;

		// The REAL fabric canvas is inside engine.core.canvas
		setCanvas(engine.core.canvas);

		// Sync React when zoom changes
		engine.zoom.setZoomCallback((z) => setZoom(z));

		// Load product
		loadProductDefinition("tshirt").then((product) => {
			engine.loadProduct(product, "front");
		});

		// Fabric event listeners
		engine.core.canvas.on("selection:created", () => {
			setActiveObject(engine.core.canvas.getActiveObject() ?? null);
		});

		engine.core.canvas.on("selection:updated", () => {
			setActiveObject(engine.core.canvas.getActiveObject() ?? null);
		});

		engine.core.canvas.on("selection:cleared", () => {
			setActiveObject(null);
		});
	}, [setActiveObject, setCanvas]);

	// CAMBIO DE LADO
	useEffect(() => {
		const engine = engineRef.current;
		if (!engine) return;
		if (!engine.currentProduct) return;

		engine.switchSide(side);
	}, [side]);

	return (
		<div className="flex w-full h-screen">
			<DesignerSidebar />
			<div className="relative flex-1">
				<canvas ref={canvasRef} />

				<DesignerBottomBar
					zoom={zoom}
					zoomIn={() => engineRef.current?.zoom.zoomIn()}
					zoomOut={() => engineRef.current?.zoom.zoomOut()}
					isPanning={isPanning}
					togglePan={() => {
						const eng = engineRef.current;
						if (!eng) return;

						if (!isPanning) eng.pan.enablePan();
						else eng.pan.disablePan();

						setIsPanning(!isPanning);
					}}
				/>

				<DesignerSideSwitcher side={side} onChange={setSide} />
			</div>
			<DesignerPropertiesPanel />
		</div>
	);
}
