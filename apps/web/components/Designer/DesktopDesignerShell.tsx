"use client";

import { useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { ProductTemplate } from "@/lib/products/types";
import DesignerCanvasSide from "./DesignerCanvasSide";
import DesignerSidebar from "./DesignerSidebar/DesignerSidebar";
import DesignerBottomBar from "./design/DesignerBottomBar";
import DesignerSideSwitcher from "./design/DesignerSideSwitcher";
import PreviewEditButtons from "./design/PreviewEditButtons";
import RightLayersPanel from "./design/RightLayersPanel/RightLayersPanel";
import ImageToolbar from "./design/toolbar/ImageToolbar";
import TextToolbar from "./design/toolbar/TextToolbar";
import UndoRedoButtons from "./design/UndoRedoButtons";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasZoom } from "./hooks/useCanvasZoom";

export default function DesktopDesignerShell({
	product,
}: {
	product: ProductTemplate;
}) {
	const { activeSide, setActiveSide, getCanvas } = useDesigner();

	const canvas = getCanvas();
	const { zoom, zoomIn, zoomOut } = useCanvasZoom(canvas);
	const [isPanning, setIsPanning] = useState(false);
	useCanvasPan({ fabricCanvas: canvas, isPanning });
	const [layersOpen, setLayersOpen] = useState(true);

	return (
		<div className="w-full h-screen flex overflow-hidden">
			<DesignerSidebar />

			<div className="flex-1 h-full w-full relative overflow-hidden">
				{product.sides.map((side) => (
					<DesignerCanvasSide key={side} side={side} product={product} />
				))}

				<UndoRedoButtons />
				<PreviewEditButtons
					isLayersOpen={layersOpen}
					onOpenLayers={() => setLayersOpen(true)}
				/>

				<RightLayersPanel
					open={layersOpen}
					onClose={() => setLayersOpen(false)}
				/>

				<DesignerSideSwitcher
					currentSide={activeSide}
					sides={product.sides}
					product={product}
					onChange={setActiveSide}
				/>

				<DesignerBottomBar
					zoom={zoom}
					zoomIn={zoomIn}
					zoomOut={zoomOut}
					isPanning={isPanning}
					togglePan={() => setIsPanning((p) => !p)}
				/>
				<TextToolbar />
				<ImageToolbar />
			</div>
		</div>
	);
}
