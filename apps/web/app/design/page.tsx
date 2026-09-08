"use client";

import { useEffect, useState } from "react";
import { clasesDeFuentes } from "@/app/design/fuentes";
import { DesignerProvider } from "@/Contexts/DesignerContext";
import { HistoryProvider } from "@/Contexts/HistoryContext";
import ProductDesigner from "@/components/Designer/ProductDesigner";

/**
 * El editor de CUALQUIER producto, por `?id=`.
 *
 * ESTABA ROTO: leía `params.productId` en una ruta SIN segmento dinámico, así
 * que el id era siempre `undefined` y el editor se montaba sin producto. Nadie
 * lo notó porque a esta URL no llega ningún enlace.
 *
 * Ahora es la red de `/design/[productId]`. Esas páginas se hornean al
 * construir con el catálogo de ese momento, y un producto aprobado después da
 * 404 —se ve en el catálogo, se pulsa "Diseñar" y se rompe—. `not-found.tsx`
 * comprueba contra la API y manda aquí, que existe siempre.
 *
 * El `?id=` se lee de `window` y no con `useSearchParams`: ese hook obliga a un
 * `<Suspense>` y Next abandona el prerenderizado de lo que hay dentro.
 */
export default function EditorDirecto() {
	const [productId, setProductId] = useState<string | null>(null);

	useEffect(() => {
		setProductId(new URLSearchParams(window.location.search).get("id"));
	}, []);

	return (
		<div className={clasesDeFuentes}>
			{productId ? (
				<DesignerProvider>
					<HistoryProvider>
						<ProductDesigner productId={productId} />
					</HistoryProvider>
				</DesignerProvider>
			) : (
				/* Sin id no hay nada que editar. El fondo del sitio mientras se lee
				   la URL, y el aviso sólo si de verdad no venía ninguno. */
				<div className="min-h-screen bg-hueso" />
			)}
		</div>
	);
}
