import Link from "next/link";
import type { Product } from "@/lib/api/products";
import { pesos } from "./datos";
import { Chevron } from "./Iconos";

/**
 * Precio y llamada a la acción siempre a la mano en móvil. Es `sticky` y no
 * `fixed` a propósito: se despega sola cuando llega el footer, sin dejar un
 * hueco al final de la página.
 */
export default function BarraMovil({ product }: { product: Product }) {
	if (!product.pricing) return null;

	return (
		<div className="sticky bottom-0 z-30 flex items-center justify-between gap-3.5 border-t border-tinta/12 bg-hueso/97 px-5 pb-5 pt-3.5 backdrop-blur md:hidden">
			<div className="flex flex-col gap-0.5">
				<span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.021em] text-tinta">
					{pesos(product.pricing.basePrice)}
				</span>
				<span className="text-[11px] text-tinta">por pieza</span>
			</div>

			<Link
				href={`/design/${product.id}`}
				className="flex h-[54px] grow items-center justify-center gap-2 rounded-full bg-tinta text-base font-semibold text-lima"
			>
				Diseñar
				<Chevron />
			</Link>
		</div>
	);
}
