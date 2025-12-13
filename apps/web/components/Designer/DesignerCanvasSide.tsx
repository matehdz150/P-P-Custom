"use client";

import { useRef } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { ProductSide, ProductTemplate } from "@/lib/products/types";
import { LoadingOverlay } from "./design/LoadingOverlay";
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
	const { activeSide } = useDesigner();

	const isMobile = useIsMobile();
	const scale = isMobile ? 0.6 : 1;

	// ✅ core
	const { getCanvas } = useFabricCanvas(hostRef, side, product);

	// ✅ extras (sin leer refs en render)
	const { isLoading } = useFabricMockup(getCanvas, product.mockups[side]);
	useCanvasZoom(getCanvas()); // si tu hook acepta Canvas|null, esto está ok
	useMobileTextareaFix(getCanvas(), isMobile);

	const isVisible = activeSide === side;

	return (
		<div
			className={`
        absolute inset-0 flex justify-center items-center transition-opacity duration-200
        ${isVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
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
				{/* ✅ overlay loader */}
				{isLoading && <LoadingOverlay />}

				{/* ✅ Fabric vive aquí, React no renderiza canvas */}
				<div ref={hostRef} className="relative w-[1445px] h-[825px]" />
			</div>
		</div>
	);
}
