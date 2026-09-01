import type { Product } from "@/lib/api/products";
import { reglasDe } from "./datos";

/**
 * Los límites duros en una sola tira, justo debajo del escaparate: es el
 * dato que decide si la pieza sirve, y cae antes que cualquier otra cosa.
 */
export default function Limites({ product }: { product: Product }) {
	const lados = (product.printSides ?? []).filter((s) => s.enabled !== false);
	const area = lados[0];
	const reglas = reglasDe(product);

	const partes = [
		area ? `${area.widthCm} × ${area.heightCm} cm` : null,
		lados.length > 0
			? `${lados.length} ${lados.length === 1 ? "lado" : "lados"}`
			: null,
		reglas.maxDesigns
			? `${reglas.maxDesigns} ${reglas.maxDesigns === 1 ? "diseño" : "diseños"}`
			: null,
		reglas.maxColorsPerDesign
			? `${reglas.maxColorsPerDesign} colores por diseño`
			: null,
		area?.dpi ? `${area.dpi} dpi` : null,
	].filter(Boolean);

	if (partes.length === 0) return null;

	const proveedor =
		product.production?.provider ?? product.provider?.displayName;
	const tecnica = product.production?.meta?.tecnica;

	return (
		<section className="bg-tinta px-5 py-6 md:px-14 md:py-[30px]">
			<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-8">
				<span className="text-base font-semibold text-lima md:text-[17px]">
					{partes.join(" · ")}
				</span>
				{proveedor && tecnica && (
					<span className="text-sm leading-[22px] text-hueso/60 md:text-[15px]">
						Los límites los pone {esaTecnica(tecnica)} de {proveedor}.
					</span>
				)}
			</div>
		</section>
	);
}

/** "bordado" → "el bordado"; "serigrafía" → "la serigrafía". */
function esaTecnica(tecnica: string) {
	return `${/a$/.test(tecnica) ? "la" : "el"} ${tecnica}`;
}
