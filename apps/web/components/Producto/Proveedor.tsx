import Link from "next/link";
import type { Product } from "@/lib/api/products";
import { reglasDe } from "./datos";
import { Chevron } from "./Iconos";

/** Quién produce la pieza. Bloque gris: el lavanda ya lo usa el escaparate. */
export default function Proveedor({ product }: { product: Product }) {
	const nombre = product.production?.provider ?? product.provider?.displayName;
	if (!nombre) return null;

	const meta = product.production?.meta;
	const tintas = reglasDe(product).maxColorsPerDesign;
	const detalle = [
		meta?.tecnica ? `${capitalizar(meta.tecnica)}` : null,
		tintas ? `hasta ${tintas} tintas por diseño` : null,
		meta?.diasProduccion ? `${meta.diasProduccion} días de producción` : null,
	]
		.filter(Boolean)
		.join(", ");

	return (
		<section className="px-5 pt-14 md:px-14 md:pt-22">
			<div className="flex flex-col gap-[18px] rounded-[22px] bg-gris px-6 py-7 md:flex-row md:items-center md:justify-between md:gap-12 md:rounded-[28px] md:px-11 md:py-10">
				<div className="flex flex-col gap-2.5 md:max-w-[620px] md:gap-3">
					<span className="text-xs tracking-[1.3px] text-tinta/70 md:text-sm md:tracking-[1.4px]">
						QUIÉN LA PRODUCE
					</span>
					<h2 className="font-display text-[26px] font-extrabold leading-8 tracking-[-0.021em] text-tinta md:text-[34px] md:leading-[41px]">
						{nombre}
					</h2>
					<p className="text-[15px] leading-[25px] text-tinta md:text-base md:leading-[27px]">
						{detalle && `${detalle}. `}
						Este mismo modelo lo publican otros proveedores con su propio precio
						y su propio tiempo.
					</p>
				</div>

				<Link
					href="/proveedores"
					className="flex h-13 shrink-0 items-center justify-center gap-2.5 whitespace-nowrap rounded-full bg-tinta px-7 text-[15px] font-semibold text-hueso md:h-14 md:px-[30px] md:text-base"
				>
					Ver otros proveedores
					<Chevron />
				</Link>
			</div>
		</section>
	);
}

function capitalizar(s: string) {
	return s.charAt(0).toUpperCase() + s.slice(1);
}
