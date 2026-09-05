"use client";

import {
	Anton,
	Bebas_Neue,
	Cormorant_Garamond,
	Great_Vibes,
	Inter,
	Montserrat,
	Pacifico,
	Playfair_Display,
	Poppins,
	Sora,
} from "next/font/google";
import { useEffect, useState } from "react";
import { DesignerProvider } from "@/Contexts/DesignerContext";
import { HistoryProvider } from "@/Contexts/HistoryContext";
import ProductDesigner from "@/components/Designer/ProductDesigner";

// --- Instagram-level typefaces ---
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({
	subsets: ["latin"],
	variable: "--font-poppins",
	weight: "100",
});
const montserrat = Montserrat({
	subsets: ["latin"],
	variable: "--font-montserrat",
});
const bebas = Bebas_Neue({
	subsets: ["latin"],
	variable: "--font-bebas",
	weight: "400",
});
const anton = Anton({
	subsets: ["latin"],
	variable: "--font-anton",
	weight: "400",
});
const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const playfair = Playfair_Display({
	subsets: ["latin"],
	variable: "--font-playfair",
});
const cormorant = Cormorant_Garamond({
	subsets: ["latin"],
	variable: "--font-cormorant",
});
const pacifico = Pacifico({
	subsets: ["latin"],
	variable: "--font-pacifico",
	weight: "400",
});
const greatvibes = Great_Vibes({
	subsets: ["latin"],
	variable: "--font-greatvibes",
	weight: "400",
});

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
		<div
			className={`
        ${inter.variable} ${poppins.variable} ${montserrat.variable}
        ${bebas.variable} ${anton.variable} ${sora.variable}
        ${playfair.variable} ${cormorant.variable} ${pacifico.variable}
        ${greatvibes.variable}
      `}
		>
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
