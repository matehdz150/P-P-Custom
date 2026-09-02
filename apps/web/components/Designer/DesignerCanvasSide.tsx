"use client";

import { RefreshCw, X } from "lucide-react";
import { useRef, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { ProductSide, ProductTemplate } from "@/lib/products/types";
import { LoadingOverlay } from "./design/LoadingOverlay";
import { useMobilePanZoomGesture } from "./hooks/UseMobilePanZoomGesture";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useFabricCanvas } from "./hooks/useFabricCanvas";
import { useFabricMockup } from "./hooks/useFabricMockup";
import { useIsMobile } from "./hooks/useIsMobile";
import { useMobileTextareaFix } from "./hooks/useMobileTextareaFix";

type Props = {
	side: ProductSide;
	product: ProductTemplate;
};

export default function DesignerCanvasSide({ side, product }: Props) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const { activeSide, colorPrenda } = useDesigner();

	const isMobile = useIsMobile();
	const scale = isMobile ? 0.6 : 1;

	// ---------------------------
	// Core Fabric setup
	// ---------------------------
	const { getCanvas } = useFabricCanvas(hostRef, side, product);

	// ---------------------------
	// Mockup loader
	// ---------------------------
	const { isLoading, reload } = useFabricMockup(
		getCanvas,
		product.mockups[side],
		colorPrenda?.hex,
	);

	const [noticeHidden, setNoticeHidden] = useState(false);

	// ---------------------------
	// Gestures
	// ---------------------------
	const canvas = getCanvas();

	// 🖥 Desktop zoom
	useCanvasZoom(!isMobile ? canvas : null);

	// 📱 Mobile pan + pinch zoom
	useMobilePanZoomGesture(
		canvas,
		isMobile, // ✅ enabled
		{ minZoom: 0.3, maxZoom: 3 },
	);

	// 📱 Fix textarea mobile
	useMobileTextareaFix(canvas, isMobile);

	const isVisible = activeSide === side;

	return (
		<div
			className={`
        absolute inset-0 flex justify-center items-center transition-opacity duration-200
        ${
					isVisible
						? "opacity-100 pointer-events-auto"
						: "opacity-0 pointer-events-none"
				}
      `}
			style={{ zIndex: isVisible ? 2 : 1 }}
		>
			{/* Aviso: recargar el mockup si no se ve */}
			{isVisible && !isLoading && !noticeHidden && (
				<div className="absolute top-4 left-1/2 -translate-x-1/2 z-50">
					<div className="flex items-center gap-2 bg-white/95 backdrop-blur border border-gray-200 shadow-md rounded-full pl-4 pr-1.5 py-1.5">
						<span className="text-xs text-gray-600">¿No ves el producto?</span>
						<button
							type="button"
							onClick={() => reload()}
							className="flex items-center gap-1.5 bg-tinta text-hueso-suave text-xs font-semibold rounded-full px-3 py-1.5 hover:bg-[#3a3618] transition-colors"
						>
							<RefreshCw size={13} />
							Recargar imagen
						</button>
						<button
							type="button"
							onClick={() => setNoticeHidden(true)}
							aria-label="Cerrar aviso"
							className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
						>
							<X size={14} />
						</button>
					</div>
				</div>
			)}

			<div
				className="relative"
				style={{
					transform: `scale(${scale})`,
					transformOrigin: "top center",
					marginTop: isMobile ? 300 : 0,
					marginLeft: isMobile ? 10 : 0,
				}}
			>
				{/* Loader profesional */}
				{isLoading && <LoadingOverlay />}

				{/* Fabric vive aquí */}
				<div
					ref={hostRef}
					className="fabric-gesture-surface relative w-[1445px] h-[825px]"
				/>
			</div>
		</div>
	);
}
