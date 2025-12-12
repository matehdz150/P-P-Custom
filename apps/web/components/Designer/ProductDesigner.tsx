"use client";

import { useEffect, useState } from "react";
import { loadProductTemplate } from "@/lib/products/loadProductsTemplate";
import type { ProductTemplate } from "@/lib/products/types";
import DesktopDesignerShell from "./DesktopDesignerShell";
import { useIsMobile } from "./hooks/useIsMobile";
import MobileDesignerShell from "./MobileDesignerShell";

export default function ProductDesigner({ productId }: { productId: string }) {
	const isMobile = useIsMobile();
	const [product, setProduct] = useState<ProductTemplate | null>(null);

	useEffect(() => {
		loadProductTemplate(productId).then(setProduct);
	}, [productId]);

	if (!product) return <div>Cargando...</div>;

	return isMobile ? (
		<MobileDesignerShell product={product} />
	) : (
		<DesktopDesignerShell product={product} />
	);
}
