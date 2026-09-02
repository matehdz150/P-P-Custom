"use client";

import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { loadProductTemplate } from "@/lib/products/loadProductsTemplate";
import type { ProductTemplate } from "@/lib/products/types";
import DesktopDesignerShell from "./DesktopDesignerShell";
import { useIsMobile } from "./hooks/useIsMobile";
import Loading from "./Loading";
import MobileDesignerShell from "./MobileDesignerShell";
import PanelPedido from "./PanelPedido";

export default function ProductDesigner({ productId }: { productId: string }) {
	const isMobile = useIsMobile();
	const { setConfig, setColores } = useDesigner();
	const [product, setProduct] = useState<ProductTemplate | null>(null);
	/** La misma plantilla sin recortar: el pedido necesita tallas y medidas. */
	const [ficha, setFicha] = useState<DesignerProductTemplate | null>(null);
	const [pidiendo, setPidiendo] = useState(false);

	useEffect(() => {
		loadProductTemplate(productId).then((tpl) => {
			setProduct(tpl as unknown as ProductTemplate);
			setFicha(tpl);
			setColores(tpl.colors ?? []);
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
	}, [productId, setConfig, setColores]);

	if (!product) return <Loading />;

	return (
		<>
			{isMobile ? (
				<MobileDesignerShell product={product} />
			) : (
				<DesktopDesignerShell product={product} />
			)}

			{/* La salida del editor. Va flotando encima de los dos shells en vez
			    de dentro de cada uno: es la misma acción en escritorio y en
			    móvil, y duplicarla eran dos sitios donde olvidarse de cambiarla. */}
			<button
				type="button"
				onClick={() => setPidiendo(true)}
				className="fixed bottom-5 right-5 z-40 flex h-12 items-center rounded-full bg-tinta px-6 text-[15px] font-semibold text-lima shadow-lg"
			>
				Pedir
			</button>

			{pidiendo && ficha && (
				<PanelPedido producto={ficha} onCerrar={() => setPidiendo(false)} />
			)}
		</>
	);
}
