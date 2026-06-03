"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { buildOrderDesignExport } from "@/lib/designer/orderDesignExport";
import type { ProductTemplate } from "@/lib/products/types";
import DesignerCanvasSide from "./DesignerCanvasSide";
import DesignerNoticeModal from "./DesignerNoticeModal";
import ExportProgressOverlay from "./ExportProgressOverlay";
import { usePriceBreakdown } from "./hooks/useProductConfig";
import DesignerHeaderMobile from "./MobileControllers/DesignerHeaderMobile";
import DesignerSideSwitcher from "./MobileControllers/DesignerSideSwitcherMobile";
import DesignerToolbarMobile from "./MobileControllers/DesignerToolbarMobile";
import MobileImageToolbarContainer from "./MobileControllers/MobileTextToolbar/MobileImageToolbar/ImageToolbarContainer";
import MobileTextToolbarContainer from "./MobileControllers/MobileTextToolbar/MobiletextToolbarContainer";

export default function MobileDesignerShell({
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
	const { activeSide, setActiveSide, sides, config } = useDesigner();
	const router = useRouter();
	const [exporting, setExporting] = useState(false);
	const [progress, setProgress] = useState<{ done: number; total: number }>({
		done: 0,
		total: 0,
	});
	const { lines, total } = usePriceBreakdown();

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
						console.warn("Error exiting text editing in mobile handleSave:", e);
					}
				}
			}

			// Guardar el borrador como diseño completado en la base de datos
			const designId = await saveDraft(false, "completed");

			// Exportar en HD: compuesto por lado + cada componente por separado,
			// subiéndolos a Cloudinary.
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
		<div
			className="
    fixed inset-0       /* 🔒 evita scroll del viewport */
    w-full
    h-[calc(var(--vh,1vh)*100)]
    flex flex-col
    overflow-hidden
    bg-[#f2f3ea]
  "
		>
			{/* 🔙 Header superior */}
			<DesignerHeaderMobile onSave={handleSave} saving={saving || exporting} />

			{/* 🎨 Canvas */}
			<div className="flex-1 relative flex items-center justify-center bg-[#f2f3ea]">
				{product.sides.map((side) => (
					<DesignerCanvasSide key={side} side={side} product={product} />
				))}
				<MobileTextToolbarContainer openFontDrawer={() => {}} />
				<MobileImageToolbarContainer />
			</div>

			<DesignerSideSwitcher
				currentSide={activeSide}
				sides={product.sides}
				product={product}
				onChange={setActiveSide}
			/>

			{/* 🧰 Toolbar inferior */}
			<DesignerToolbarMobile />

			<DesignerNoticeModal />
			<ExportProgressOverlay open={exporting} progress={progress} />
		</div>
	);
}
