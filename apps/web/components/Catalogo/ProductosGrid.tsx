"use client";

import Image from "next/image";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import Aparece from "./Aparece";
import type { ProductFromCategory } from "@/lib/api/search";

/** Cuántas piezas asoman aquí antes de mandar al listado completo. */
const TANDA = 12;

export default function ProductosGrid({
	productos,
	cargando,
}: {
	productos: ProductFromCategory[];
	cargando: boolean;
}) {
	if (cargando) {
		return (
			<section className="px-5 pt-7 md:px-14 md:pt-12">
				<div className="grid grid-cols-2 gap-x-4 gap-y-[26px] md:grid-cols-4 md:gap-x-8 md:gap-y-10">
					{Array.from({ length: 8 }).map((_, i) => (
						<div key={`esqueleto-${i}`} className="flex flex-col gap-3">
							<Skeleton className="h-[158px] w-full md:h-[236px]" />
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-3 w-1/2" />
						</div>
					))}
				</div>
			</section>
		);
	}

	if (productos.length === 0) {
		return (
			<section className="px-5 pt-10 md:px-14 md:pt-12">
				<p className="text-[15px] text-tinta/60">
					Todavía no hay productos en esta categoría.
				</p>
			</section>
		);
	}

	return (
		<section className="px-5 pt-7 md:px-14 md:pt-12">
			<div className="grid grid-cols-2 gap-x-4 gap-y-[26px] md:grid-cols-4 md:gap-x-8 md:gap-y-10">
				{productos.slice(0, TANDA).map((p, i) => (
					<Aparece key={p.id} indice={i}>
						<Pieza producto={p} />
					</Aparece>
				))}
			</div>

			<Aparece className="flex justify-center">
				<Link
					href="/catalogo/productos"
					className="mt-8 flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-lima text-base font-semibold text-tinta md:mt-12 md:h-[58px] md:w-auto md:px-9 md:text-[17px]"
				>
					Ver los {productos.length} productos del catálogo
					<svg
						width="15"
						height="15"
						viewBox="0 0 14 14"
						fill="none"
						aria-hidden="true"
						className="md:h-4 md:w-4"
					>
						<path
							d="M5.833 10.5L9.333 7L5.833 3.5"
							stroke="currentColor"
							strokeWidth="1.7"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</Link>
			</Aparece>
		</section>
	);
}

/** "Textiles del Bajío · bordado · 7 días", saltándose lo que falte. */
export function fichaTecnica(producto: ProductFromCategory) {
	return [
		producto.provider,
		producto.technique,
		producto.productionDays ? `${producto.productionDays} días` : null,
	]
		.filter(Boolean)
		.join(" · ");
}

function Pieza({ producto }: { producto: ProductFromCategory }) {
	const imagen = producto.images?.[0]?.url;

	return (
		<Link href={`/product/${producto.id}`} className="flex flex-col gap-3 md:gap-[15px]">
			<div className="flex h-[158px] items-center justify-center md:h-[236px]">
				{imagen ? (
					<Image
						src={imagen}
						alt={producto.name}
						width={320}
						height={400}
						className="max-h-[96%] w-auto max-w-[80%] object-contain md:max-w-[74%]"
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
					<span className="line-clamp-1 text-[11px] leading-4 text-tinta/50 md:text-xs md:leading-[17px]">
						{fichaTecnica(producto)}
					</span>
				</div>

				{producto.basePrice != null && (
					<span className="whitespace-nowrap text-sm text-tinta/70 md:text-[15px]">
						${producto.basePrice.toLocaleString("es-MX")}
					</span>
				)}
			</div>
		</Link>
	);
}
