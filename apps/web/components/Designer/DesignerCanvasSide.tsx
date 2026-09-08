"use client";

import { useRef } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { ProductSide, ProductTemplate } from "@/lib/products/types";
import { LoadingOverlay } from "./design/LoadingOverlay";
import { useMobilePanZoomGesture } from "./hooks/UseMobilePanZoomGesture";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useFabricCanvas } from "./hooks/useFabricCanvas";
import { useFabricMockup } from "./hooks/useFabricMockup";
import { useIsMobile } from "./hooks/useIsMobile";
import { useMobileTextareaFix } from "./hooks/useMobileTextareaFix";
import { usePlateadoDeGrabado } from "./hooks/usePlateadoDeGrabado";

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

	// En un lado de grabado, lo que se dibuja se ve plateado: el láser no
	// imprime color. Igual que en la previsualización, y con la misma rampa.
	usePlateadoDeGrabado(getCanvas, side);

	// ---------------------------
	// Mockup loader
	// ---------------------------
	const { isLoading } = useFabricMockup(
		getCanvas,
		product.mockups[side],
		colorPrenda?.hex,
	);

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
