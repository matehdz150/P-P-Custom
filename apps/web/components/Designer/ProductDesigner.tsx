"use client";

import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import { loadProductTemplate } from "@/lib/products/loadProductsTemplate";
import type { ProductTemplate } from "@/lib/products/types";
import DesktopDesignerShell from "./DesktopDesignerShell";
import { useIsMobile } from "./hooks/useIsMobile";
import Loading from "./Loading";
import MobileDesignerShell from "./MobileDesignerShell";

export default function ProductDesigner({ productId }: { productId: string }) {
	const isMobile = useIsMobile();
	const { setConfig } = useDesigner();
	const [product, setProduct] = useState<ProductTemplate | null>(null);

	useEffect(() => {
		loadProductTemplate(productId).then((tpl) => {
			setProduct(tpl as unknown as ProductTemplate);
			setConfig({
				name: tpl.name,
				rules: {
					allowText: tpl.customizationRules?.allowText ?? true,
					allowImages: tpl.customizationRules?.allowImages ?? true,
					maxDesigns: tpl.customizationRules?.maxDesigns,
					maxColorsPerDesign:
						tpl.customizationRules?.maxColorsPerDesign,
				},
				pricing: {
					basePrice: tpl.pricing?.basePrice ?? 0,
					perSidePrice: tpl.pricing?.perSidePrice,
					perDesignPrice: tpl.pricing?.perDesignPrice,
					perColorPrice: tpl.pricing?.perColorPrice,
					embroideryExtra: tpl.pricing?.embroideryExtra,
				},
			});
		});
	}, [productId, setConfig]);

	if (!product) return <Loading />;

	return isMobile ? (
		<MobileDesignerShell product={product} />
	) : (
		<DesktopDesignerShell product={product} />
	);
}
