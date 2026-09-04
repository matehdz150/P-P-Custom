"use client";

import { notFound, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDesigner } from "@/Contexts/DesignerContext";
import type { DesignerProductTemplate } from "@/lib/api/products";
import { rutaDelBorrador } from "@/lib/plantillas/borrador";
import { loadProductTemplate } from "@/lib/products/loadProductsTemplate";
import type { ProductTemplate } from "@/lib/products/types";
import AgregarAlCarrito from "./AgregarAlCarrito";
import AgregarAPlantilla from "./AgregarAPlantilla";
import AvisoDeSalida from "./AvisoDeSalida";
import DesktopDesignerShell from "./DesktopDesignerShell";
import { useAvisoDeSalida } from "./hooks/useAvisoDeSalida";
import { useHayDiseno } from "./hooks/useHayDiseno";
import { useIsMobile } from "./hooks/useIsMobile";
import Loading from "./Loading";
import MobileDesignerShell from "./MobileDesignerShell";
import SalidaAPedir from "./SalidaAPedir";

export default function ProductDesigner({ productId }: { productId: string }) {
	const router = useRouter();

	const isMobile = useIsMobile();
	const {
		activeSide,
		setActiveSide,
		setConfig,
		setColores,
		pidiendo,
		setPidiendo,
		agregando,
		setAgregando,
		plantilla,
		setPlantilla,
		sides,
	} = useDesigner();

	/* Para qué se está diseñando. Se lee de `window` y no con
	   `useSearchParams`: en el export estático ese hook obliga a un Suspense y
	   Next abandona el prerender de todo lo que hay dentro — ya pasó con el
	   catálogo. Aquí basta con saberlo tras montar.

	   Va al contexto porque quien tiene que cambiar son los botones de salida,
	   y viven en las shells: la barra de abajo en escritorio y la cabecera en
	   móvil. */
	useEffect(() => {
		const clave = new URLSearchParams(window.location.search).get("plantilla");
		if (clave === null) return;

		// `?plantilla=1` es "una fila nueva"; cualquier otro valor es la clave
		// de la fila del borrador a la que hay que devolverle el arte.
		setPlantilla({ clave: clave === "1" || clave === "" ? null : clave });
	}, [setPlantilla]);

	const paraPlantilla = plantilla !== null;

	/* Mientras haya algo dibujado y no se haya pedido, salir de aquí pierde el
	   diseño: sólo vive dentro del lienzo. */
	const hayDiseno = useHayDiseno(sides);
	const { preguntando, salir, quedarse, solicitarSalida } = useAvisoDeSalida(
		hayDiseno && !pidiendo,
	);
	const [product, setProduct] = useState<ProductTemplate | null>(null);
	/* El producto puede haber desaparecido DESPUÉS de que esta página se
	   horneara: el taller lo quitó y el diseño guardado que trajo a alguien
	   hasta aquí sigue apuntándolo. Sin esto, la rueda giraba para siempre. */
	const [seFue, setSeFue] = useState(false);
	/** La misma plantilla sin recortar: el pedido necesita tallas y medidas. */
	const [ficha, setFicha] = useState<DesignerProductTemplate | null>(null);

	useEffect(() => {
		loadProductTemplate(productId)
			.then((tpl) => {
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
			})
			.catch(() => setSeFue(true));
	}, [productId, setConfig, setColores]);

	/* EL LADO ACTIVO TIENE QUE EXISTIR EN ESTE PRODUCTO.
	
	   El contexto arranca en `"front"` porque es lo que tiene una prenda; una
	   taza tiene `wrap` y nada más. Sin esto el editor abría en blanco —pidiendo
	   el lienzo de un lado que no existe— hasta que alguien pulsaba el único
	   botón de la barra de lados.
	
	   Se corrige aquí y no en las shells porque son dos y esto es una sola
	   regla: el lado activo tiene que estar entre los del producto. */
	useEffect(() => {
		const lados = product?.sides ?? [];
		if (lados.length > 0 && !lados.includes(activeSide)) {
			setActiveSide(lados[0]);
		}
	}, [product, activeSide, setActiveSide]);

	/* Se enseña el 404 en vez de pintar el aviso aquí: es la MISMA situación
	   que llegar a `/design/<id>` de un producto que nunca se horneó, y las dos
	   tienen que contarse igual.

	   `notFound()` y NO un `router.replace`: la página de error mira la ruta
	   para decidir si habla de un producto o de una dirección cualquiera, y
	   navegar a otro sitio le quitaría justo el dato que necesita. Además deja
	   la URL en pie, así que recargar no cambia lo que se ve. */
	if (seFue) notFound();

	if (!product) return <Loading />;

	return (
		<>
			{isMobile ? (
				<MobileDesignerShell product={product} />
			) : (
				<DesktopDesignerShell
					product={product}
					fotosReales={ficha?.fotosReales ?? []}
					onVolverAlCatalogo={() =>
						solicitarSalida(paraPlantilla ? rutaDelBorrador() : "/catalogo")
					}
				/>
			)}

			{preguntando && <AvisoDeSalida onSalir={salir} onQuedarse={quedarse} />}

			{/* Lo disparan los botones de cada shell — la barra de abajo en
			    escritorio, la cabecera en móvil — a través del contexto. No es
			    un formulario: exporta el arte y se va a `/pedir`, porque el
			    lienzo deja de existir en cuanto se navega. */}
			{pidiendo && ficha && !paraPlantilla && (
				<SalidaAPedir producto={ficha} onCancelar={() => setPidiendo(false)} />
			)}

			{/* El destino del arte depende de para qué se está diseñando. Con
			    `?plantilla=1` en la URL se viene de armar una plantilla, y el arte
			    tiene que ir al prefijo que NO caduca; si no, al del carrito. Es lo
			    único que cambia entre los dos: el editor es el mismo. */}
			{agregando && ficha && plantilla && (
				<AgregarAPlantilla
					producto={ficha}
					clave={plantilla.clave}
					onListo={() => {
						setAgregando(false);
						// La ruta la decide el borrador: puede ser una plantilla nueva
						// o una guardada que se está editando.
						router.push(rutaDelBorrador());
					}}
					onCancelar={() => setAgregando(false)}
				/>
			)}

			{/* El carrito se abre sólo después de que el arte terminó de subir y la
			    referencia quedó guardada localmente. */}
			{agregando && ficha && !paraPlantilla && (
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
