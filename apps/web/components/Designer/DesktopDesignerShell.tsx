"use client";

import { Textbox } from "fabric";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { ProductTemplate } from "@/lib/products/types";
import CurvedTextEditor from "./design/CurvedTextEditor";
import DesignerNoticeModal from "./DesignerNoticeModal";
import DesignerCanvasSide from "./DesignerCanvasSide";
import DesignerSidebar from "./DesignerSidebar/DesignerSidebar";
import DesignerBottomBar from "./design/DesignerBottomBar";
import DesignerSideSwitcher from "./design/DesignerSideSwitcher";
import PreviewEditButtons from "./design/PreviewEditButtons";
import RightLayersPanel from "./design/RightLayersPanel/RightLayersPanel";
import ImageToolbar from "./design/toolbar/ImageToolbar";
import ShapeToolbar from "./design/toolbar/ShapeToolbar";
import TextToolbar from "./design/toolbar/TextToolbar";
import UndoRedoButtons from "./design/UndoRedoButtons";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { usePriceBreakdown } from "./hooks/useProductConfig";

export default function DesktopDesignerShell({
	product,
	saveDraft,
	saving,
}: {
	product: ProductTemplate;
	saveDraft: (
		manual?: boolean,
		status?: "draft" | "completed",
	) => Promise<string | null>;
	saving: boolean;
}) {
	const router = useRouter();
	const { activeSide, setActiveSide, getCanvas, sides, config } = useDesigner();

	const canvas = getCanvas();
	const { zoom, zoomIn, zoomOut } = useCanvasZoom(canvas);
	const [isPanning, setIsPanning] = useState(false);
	useCanvasPan({ fabricCanvas: canvas, isPanning });
	const [layersOpen, setLayersOpen] = useState(true);
	const [exporting, setExporting] = useState(false);

	const { lines, total } = usePriceBreakdown();

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key !== "Delete" && e.key !== "Backspace") return;

			const t = e.target as HTMLElement | null;
			if (
				t &&
				(t.tagName === "INPUT" ||
					t.tagName === "TEXTAREA" ||
					t.isContentEditable)
			) {
				return;
			}

			const canvas = getCanvas();
			if (!canvas) return;

			const activeObjects = canvas.getActiveObjects();
			if (activeObjects.length === 0) return;

			const isEditingText = activeObjects.some(
				(obj) => obj instanceof Textbox && obj.isEditing,
			);
			if (isEditingText) return;

			canvas.discardActiveObject();
			activeObjects.forEach((obj) => canvas.remove(obj));
			canvas.requestRenderAll();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [getCanvas]);

	async function handleSave() {
		setExporting(true);
		try {
			// Guardar el borrador como diseño completado en la base de datos
			await saveDraft(false, "completed");

			// Export each side — remove background first to avoid tainted-canvas error
			// (the mockup is loaded without crossOrigin so it taints the canvas).
			// We export only the design layer cropped to the editable area, then restore.
			const snapshots: Record<string, string> = {};
			for (const [side, state] of Object.entries(sides)) {
				if (state.canvas) {
					const c = state.canvas;
					c.discardActiveObject();

					// stash and remove background
					const bg = c.backgroundImage;
					// biome-ignore lint/suspicious/noExplicitAny: fabric backgroundImage accepts undefined
					(c as any).backgroundImage = undefined;

					// Reset viewport to identity so crop coords match canvas coords
					const savedVP = c.viewportTransform;
					c.setViewportTransform([1, 0, 0, 1, 0, 0]);
					c.requestRenderAll();

					await new Promise((r) => setTimeout(r, 60));

					// Compute bounding box from the first editable area shape
					const area = product.editableAreas[side as keyof typeof product.editableAreas]?.[0];
					let cropOpts: { left: number; top: number; width: number; height: number } | undefined;
					if (area) {
						if (area.type === "circle") {
							cropOpts = { left: area.cx - area.radius, top: area.cy - area.radius, width: area.radius * 2, height: area.radius * 2 };
						} else {
							cropOpts = { left: area.left, top: area.top, width: area.width, height: area.height };
						}
					}

					try {
						snapshots[side] = c.toDataURL({ format: "png", multiplier: 1, ...cropOpts });
					} catch {
						snapshots[side] = "";
					}

					// Restore viewport and background
					c.setViewportTransform(savedVP);
					if (bg) {
						c.backgroundImage = bg;
					}
					c.requestRenderAll();
				}
			}

			// Store summary payload in sessionStorage
			const sortedImages = [...(product.images ?? [])].sort((a, b) => a.order - b.order);
			const payload = {
				productId: product.id,
				productName: config?.name ?? product.name,
				productImage: sortedImages[0]?.url ?? null,
				mockups: product.mockups,
				snapshots,
				sides: product.sides,
				sideLabels: product.sideLabels ?? {},
				pricingLines: lines,
				total,
			};
			sessionStorage.setItem("designer_order_summary", JSON.stringify(payload));

			router.push(`/design/${product.id}/resumen`);
		} finally {
			setExporting(false);
		}
	}

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
					onSave={handleSave}
					saving={exporting || saving}
					onSaveDraft={() => saveDraft(true, "draft")}
				/>
				<TextToolbar />
				<ImageToolbar />
				<ShapeToolbar />
				<CurvedTextEditor />
			</div>
			<DesignerNoticeModal />
		</div>
	);
}
