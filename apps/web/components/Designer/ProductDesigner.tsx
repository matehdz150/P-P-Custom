"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { loadProductTemplate } from "@/lib/products/loadProductsTemplate";
import type { ProductTemplate } from "@/lib/products/types";
import AvisoDeSalida from "./AvisoDeSalida";
import DesktopDesignerShell from "./DesktopDesignerShell";
import { useAvisoDeSalida } from "./hooks/useAvisoDeSalida";
import { useHayDiseno } from "./hooks/useHayDiseno";
import { useIsMobile } from "./hooks/useIsMobile";
import Loading from "./Loading";
import MobileDesignerShell from "./MobileDesignerShell";
import AgregarAlCarrito from "./AgregarAlCarrito";
import SalidaAPedir from "./SalidaAPedir";

export default function ProductDesigner({ productId }: { productId: string }) {
	const router = useRouter();
	const isMobile = useIsMobile();
	const {
		setConfig,
		setColores,
		pidiendo,
		setPidiendo,
		agregando,
		setAgregando,
		sides,
	} = useDesigner();

	/* Mientras haya algo dibujado y no se haya pedido, salir de aquí pierde el
	   diseño: sólo vive dentro del lienzo. */
	const hayDiseno = useHayDiseno(sides);
	const { preguntando, salir, quedarse, solicitarSalida } = useAvisoDeSalida(
		hayDiseno && !pidiendo,
	);
	const [product, setProduct] = useState<ProductTemplate | null>(null);
	/** La misma plantilla sin recortar: el pedido necesita tallas y medidas. */
	const [ficha, setFicha] = useState<DesignerProductTemplate | null>(null);

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
					maxColorsPerDesign: tpl.customizationRules?.maxColorsPerDesign,
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
				<DesktopDesignerShell
					product={product}
					onVolverAlCatalogo={() => solicitarSalida("/catalogo")}
				/>
			)}

			{preguntando && <AvisoDeSalida onSalir={salir} onQuedarse={quedarse} />}

			{/* Lo disparan los botones de cada shell — la barra de abajo en
			    escritorio, la cabecera en móvil — a través del contexto. No es
			    un formulario: exporta el arte y se va a `/pedir`, porque el
			    lienzo deja de existir en cuanto se navega. */}
			{pidiendo && ficha && (
				<SalidaAPedir producto={ficha} onCancelar={() => setPidiendo(false)} />
			)}

			{/* El carrito se abre sólo después de que el arte terminó de subir y la
			    referencia quedó guardada localmente. */}
			{agregando && ficha && (
				<AgregarAlCarrito
					producto={ficha}
					onListo={() => {
						setAgregando(false);
						router.push("/carrito");
					}}
					onCancelar={() => setAgregando(false)}
				/>
			)}
		</>
	);
}
