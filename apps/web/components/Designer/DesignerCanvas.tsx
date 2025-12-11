"use client";

import { useEffect, useState } from "react";
import "@/lib/fabricOverrides";
import { useDesigner } from "@/Contexts/DesignerContext";
import { loadProductTemplate } from "@/lib/products/loadProductsTemplate";
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

// -----------------------------
// Shell completo
// -----------------------------
export default function DesignerCanvas({ productId }: { productId: string }) {
	const { getCanvas, activeSide, setActiveSide } = useDesigner();
	const [isPanning, setIsPanning] = useState(false);
	const [product, setProduct] = useState<ProductTemplate | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!productId) return;

		loadProductTemplate(productId)
			.then(setProduct)
			.catch((err) => {
				console.error(err);
				setError("No se pudo cargar la plantilla de producto.");
			});
	}, [productId]);

	// 🔥 DELETE KEY HANDLER — eliminas objetos seleccionados (multi)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Delete" && e.key !== "Backspace") return;

			const canvas = getCanvas();
			if (!canvas) return;

			const activeObjects = canvas.getActiveObjects();
			if (!activeObjects || activeObjects.length === 0) return;

			// 🛑 EVITAR BORRAR OBJETOS SI SE ESTÁ EDITANDO TEXTO
			const isEditingText = activeObjects.some(
				(obj) =>
					obj.type === "textbox" &&
					"isEditing" in obj &&
					obj.isEditing === true,
			);

			if (isEditingText) {
				return; // ⚡ deja que el textbox maneje el Backspace
			}

			// 🗑 borrar objetos normalmente
			canvas.discardActiveObject();
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
		<div className="w-full h-screen flex overflow-hidden ">
			<DesignerSidebar />

			<div className="flex-1 h-full w-full relative overflow-hidde">
				{product.sides.map((side) => (
					<DesignerCanvasSide key={side} side={side} product={product} />
				))}

				<UndoRedoButtons />
				<PreviewEditButtons />
				<RightLayersPanel />

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
					togglePan={() => setIsPanning(!isPanning)}
				/>
				<TextToolbar />
				<ImageToolbar />
			</div>
		</div>
	);
}
