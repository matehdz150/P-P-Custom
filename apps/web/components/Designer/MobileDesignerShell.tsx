"use client";

import { useDesigner } from "@/Contexts/DesignerContext";
import type { ProductTemplate } from "@/lib/products/types";
import DesignerCanvasSide from "./DesignerCanvasSide";
import DesignerHeaderMobile from "./MobileControllers/DesignerHeaderMobile";
import DesignerSideSwitcher from "./MobileControllers/DesignerSideSwitcherMobile";
import DesignerToolbarMobile from "./MobileControllers/DesignerToolbarMobile";
import MobileTextToolbar from "./MobileControllers/MobileTextToolbar";

export default function MobileDesignerShell({
	product,
}: {
	product: ProductTemplate;
}) {
	const { activeSide, setActiveSide } = useDesigner();

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
			<DesignerHeaderMobile />

			{/* 🎨 Canvas */}
			<div className="flex-1 relative flex items-center justify-center bg-[#f2f3ea]">
				{product.sides.map((side) => (
					<DesignerCanvasSide key={side} side={side} product={product} />
				))}
				<MobileTextToolbar openFontDrawer={() => {}} />
			</div>

			<DesignerSideSwitcher
				currentSide={activeSide}
				sides={product.sides}
				product={product}
				onChange={setActiveSide}
			/>

			{/* 🧰 Toolbar inferior */}
			<DesignerToolbarMobile />
		</div>
	);
}
