import type { Product } from "@/lib/api/products";
import { pesos } from "./datos";

/** El precio, renglón por renglón: la prenda y lo que suma cada decisión. */
export default function Desglose({ product }: { product: Product }) {
	const p = product.pricing;
	if (!p) return null;

	const extras = [
		{ label: "Cada lado que imprimas", monto: p.perSidePrice },
		{ label: "Cada diseño", monto: p.perDesignPrice },
		{ label: "Cada color del diseño", monto: p.perColorPrice },
		{ label: "Si lo quieres bordado", monto: p.embroideryExtra },
	].filter((e): e is { label: string; monto: number } => Boolean(e.monto));

	return (
		<section className="px-5 pt-14 md:px-14 md:pt-22">
			<div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-18">
				<div className="flex flex-col gap-4 md:w-[520px] md:shrink-0 md:gap-[22px]">
					<h2 className="font-display text-[30px] font-extrabold leading-[37px] tracking-[-0.021em] text-tinta md:text-[40px] md:leading-[48px]">
						Cómo se arma el precio
					</h2>
					<p className="text-[15px] leading-[26px] text-tinta md:text-[17px] md:leading-[29px]">
						Empiezas con el precio de la prenda y sumas sólo lo que tu diseño
						realmente use. Nada se cobra por adelantado ni aparece al final.
					</p>
				</div>

				<div className="flex grow flex-col">
					<div className="flex flex-col border-b border-tinta/14">
						<Renglon label="La prenda" monto={pesos(p.basePrice)} fuerte />
						{extras.map((e) => (
							<Renglon
								key={e.label}
								label={e.label}
								monto={`+ ${pesos(e.monto)}`}
							/>
						))}
					</div>
					<span className="pt-3 text-[13px] text-tinta/70 md:pt-4 md:text-sm">
						Todo por pieza. El escalonado por cantidad lo pone el proveedor.
					</span>
				</div>
			</div>
		</section>
	);
}

function Renglon({
	label,
	monto,
	fuerte = false,
}: {
	label: string;
	monto: string;
	fuerte?: boolean;
}) {
	return (
		<div className="flex items-baseline justify-between gap-5 border-t border-tinta/14 py-[15px] md:py-[18px]">
			<span
				className={`text-[15px] text-tinta md:text-[17px] ${
					fuerte ? "font-semibold" : ""
				}`}
			>
				{label}
			</span>
			<span className="text-[15px] text-tinta md:text-[17px]">{monto}</span>
		</div>
	);
}
