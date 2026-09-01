import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/api/products";
import { pesos } from "./datos";
import { Chevron } from "./Iconos";

/** Otras piezas del catálogo. Misma pieza sin caja que en el listado. */
export default function Recomendados({
	productos,
}: {
	productos: CatalogProduct[];
}) {
	if (productos.length === 0) return null;

	return (
		<section className="px-5 pt-14 md:px-14 md:pt-22">
			<div className="flex flex-col gap-[22px] md:gap-[30px]">
				<div className="flex items-baseline justify-between gap-4 md:gap-6">
					<h2 className="font-display text-[30px] font-extrabold leading-[37px] tracking-[-0.021em] text-tinta md:text-[40px] md:leading-[48px]">
						También se personalizan
					</h2>
					<Link
						href="/catalogo/productos"
						className="hidden shrink-0 items-center gap-2 text-base font-semibold text-tinta md:flex"
					>
						Ver catálogo completo
						<Chevron className="h-3.5 w-3.5" />
					</Link>
				</div>

				<div className="grid grid-cols-2 gap-x-4 gap-y-[26px] md:grid-cols-4 md:gap-x-8 md:gap-y-10">
					{productos.map((p) => (
						<Pieza key={p.id} producto={p} />
					))}
				</div>
			</div>
		</section>
	);
}

function Pieza({ producto }: { producto: CatalogProduct }) {
	const imagen = producto.images?.[0]?.url;

	return (
		<Link
			href={`/product/${producto.id}`}
			className="flex flex-col gap-3 md:gap-[15px]"
		>
			<div className="flex h-[158px] items-center justify-center md:h-[236px]">
				{imagen ? (
					<Image
						src={imagen}
						alt={producto.name}
						width={320}
						height={400}
						className="max-h-[96%] w-auto max-w-[78%] object-contain md:max-w-[74%]"
					/>
				) : (
					<span className="text-xs text-tinta/40">Sin imagen</span>
				)}
			</div>

			<div className="flex items-baseline justify-between gap-2 border-t border-tinta/14 pt-[11px] md:gap-2.5 md:pt-[13px]">
				<div className="flex min-w-0 flex-col gap-1">
					<span className="text-[15px] font-semibold tracking-[-0.3px] text-tinta md:text-[17px] md:tracking-[-0.4px]">
						{producto.name}
					</span>
					{producto.category && (
						<span className="line-clamp-1 text-[11px] leading-4 text-tinta/50 md:text-xs md:leading-[17px]">
							{producto.category}
						</span>
					)}
				</div>

				{producto.pricing?.basePrice != null && (
					<span className="whitespace-nowrap text-sm text-tinta md:text-[15px]">
						{pesos(producto.pricing.basePrice)}
					</span>
				)}
			</div>
		</Link>
	);
}
