"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { ProductTemplate } from "@/lib/products/types";
import DesignerCanvasSide from "./DesignerCanvasSide";
import DesignerNoticeModal from "./DesignerNoticeModal";
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
	const { lines, total } = usePriceBreakdown();

	async function handleSave() {
		setExporting(true);
		try {
			// Guardar el borrador como diseño completado en la base de datos
			await saveDraft(false, "completed");

			// Export each side — remove background first to avoid tainted-canvas error
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
					const area =
						product.editableAreas[
							side as keyof typeof product.editableAreas
						]?.[0];
					let cropOpts:
						| { left: number; top: number; width: number; height: number }
						| undefined;
					if (area) {
						if (area.type === "circle") {
							cropOpts = {
								left: area.cx - area.radius,
								top: area.cy - area.radius,
								width: area.radius * 2,
								height: area.radius * 2,
							};
						} else {
							cropOpts = {
								left: area.left,
								top: area.top,
								width: area.width,
								height: area.height,
							};
						}
					}

					try {
						snapshots[side] = c.toDataURL({
							format: "png",
							multiplier: 1,
							...cropOpts,
						});
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
			const sortedImages = [...(product.images ?? [])].sort(
				(a, b) => a.order - b.order,
			);
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
		</div>
	);
}
