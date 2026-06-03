"use client";

import { Textbox } from "fabric";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { buildOrderDesignExport } from "@/lib/designer/orderDesignExport";
import type { ProductTemplate } from "@/lib/products/types";
import DesignerCanvasSide from "./DesignerCanvasSide";
import DesignerNoticeModal from "./DesignerNoticeModal";
import ExportProgressOverlay from "./ExportProgressOverlay";
import DesignerSidebar from "./DesignerSidebar/DesignerSidebar";
import CurvedTextEditor from "./design/CurvedTextEditor";
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
	const [progress, setProgress] = useState<{ done: number; total: number }>({
		done: 0,
		total: 0,
	});

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
			activeObjects.forEach((obj) => {
				canvas.remove(obj);
			});
			canvas.requestRenderAll();
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [getCanvas]);

	async function handleSave() {
		setExporting(true);
		setProgress({ done: 0, total: 0 });
		try {
			// Forzar salida de edición de texto en todos los lados antes de guardar
			for (const [, state] of Object.entries(sides)) {
				if (state.canvas) {
					try {
						const c = state.canvas;
						const activeObj = c.getActiveObject();
						if (activeObj && typeof (activeObj as any).exitEditing === "function" && (activeObj as any).isEditing) {
							(activeObj as any).exitEditing();
						}
						const objects = c.getObjects();
						for (const obj of objects) {
							if (obj && typeof (obj as any).exitEditing === "function" && (obj as any).isEditing) {
								(obj as any).exitEditing();
							}
						}
					} catch (e) {
						console.warn("Error exiting text editing in handleSave:", e);
					}
				}
			}

			// Guardar el borrador como diseño completado en la base de datos
			const designId = await saveDraft(false, "completed");

			// Exportar en HD: compuesto por lado + cada componente por separado,
			// subiéndolos a Cloudinary. Reutiliza el canvas en vivo (fuentes/imágenes
			// ya cargadas en resolución nativa).
			const { snapshots, assets } = await buildOrderDesignExport(
				sides,
				product,
				(done, total) => setProgress({ done, total }),
			);

			// Store summary payload in sessionStorage
			const sortedImages = [...(product.images ?? [])].sort(
				(a, b) => a.order - b.order,
			);
			const payload = {
				designId,
				productId: product.id,
				productName: config?.name ?? product.name,
				productImage: sortedImages[0]?.url ?? null,
				mockups: product.mockups,
				snapshots,
				designAssets: assets,
				sides: product.sides,
				sideLabels: product.sideLabels ?? {},
				pricingLines: lines,
				total,
				editableAreas: product.editableAreas,
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
			<ExportProgressOverlay open={exporting} progress={progress} />
		</div>
	);
}
