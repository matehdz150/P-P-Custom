import type { Product } from "@/lib/api/products";

/** Tabla de tallas. Reglas de 1px, sin zebra ni caja. */
export default function Medidas({ product }: { product: Product }) {
	const tallas = product.sizes ?? [];
	if (tallas.length === 0) return null;

	return (
		<section id="medidas" className="scroll-mt-8 px-5 pt-14 md:px-14 md:pt-22">
			<div className="flex flex-col gap-[18px] md:gap-[26px]">
				<div className="flex items-baseline justify-between gap-4 md:gap-6">
					<h2 className="font-display text-[30px] font-extrabold leading-[37px] tracking-[-0.021em] text-tinta md:text-[40px] md:leading-[48px]">
						Medidas
					</h2>
					<span className="shrink-0 text-[13px] text-tinta md:text-[15px]">
						<span className="md:hidden">pulgadas</span>
						<span className="hidden md:inline">
							En pulgadas, prenda extendida
						</span>
					</span>
				</div>

				<div className="flex flex-col">
					<div className="grid grid-cols-3 gap-3 border-b-[1.5px] border-tinta pb-[11px] md:gap-5 md:pb-3.5">
						{["TALLA", "ANCHO", "LARGO"].map((t) => (
							<span
								key={t}
								className="text-[11px] tracking-[1.2px] text-tinta/45 md:text-[13px] md:tracking-[1.4px]"
							>
								{t}
							</span>
						))}
					</div>

					{tallas.map((t) => (
						<div
							key={t.size}
							className="grid grid-cols-3 gap-3 border-b border-tinta/14 py-3.5 md:gap-5 md:py-[17px]"
						>
							<span className="text-[15px] font-semibold text-tinta md:text-[17px]">
								{t.size}
							</span>
							<span className="text-[15px] text-tinta md:text-[17px]">
								{t.widthIn}"
							</span>
							<span className="text-[15px] text-tinta md:text-[17px]">
								{t.lengthIn}"
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
