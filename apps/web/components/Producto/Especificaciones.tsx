import Eyebrow from "@/components/Kustto/Eyebrow";
import type { Product } from "@/lib/api/products";
import { pesos, reglasDe } from "./datos";

type Dato = { cifra: string; titulo: string; nota: string };

/** Lo que la plantilla y el proveedor permiten imprimir, en números. */
export default function Especificaciones({ product }: { product: Product }) {
	const datos = reunir(product);
	if (datos.length === 0) return null;

	return (
		<section className="px-5 pt-16 md:px-14 md:pt-24">
			<div className="flex flex-col gap-[22px] md:gap-[30px]">
				<Eyebrow>Lo que se puede imprimir</Eyebrow>

				<div className="grid grid-cols-2 gap-x-[18px] gap-y-5 md:grid-cols-4 md:gap-8">
					{datos.map((d) => (
						<div
							key={d.titulo}
							className="flex flex-col gap-[7px] border-t border-tinta/14 pt-[15px] md:gap-2.5 md:pt-[22px]"
						>
							<span className="font-display text-[26px] font-extrabold leading-none tracking-[-0.021em] text-tinta md:text-[34px]">
								{d.cifra}
							</span>
							<span className="hidden text-[15px] font-semibold text-tinta md:block">
								{d.titulo}
							</span>
							<span className="text-[13px] leading-5 text-tinta md:text-sm md:leading-[22px]">
								{d.nota}
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

function reunir(product: Product): Dato[] {
	const datos: Dato[] = [];

	const lados = (product.printSides ?? []).filter((s) => s.enabled !== false);
	const area = lados[0];
	const etiquetas = product.productTemplateData?.sideLabels ?? {};
	const reglas = reglasDe(product);

	if (area) {
		datos.push({
			cifra: `${area.widthCm} × ${area.heightCm}`,
			titulo: "Área imprimible",
			nota: area.dpi
				? `Centímetros, a ${area.dpi} dpi.`
				: "Centímetros de área útil.",
		});
	}

	if (lados.length > 0) {
		const nombres = lados
			.map((s) => etiquetas[s.sideKey] ?? s.sideKey)
			.join(" y ");
		const porLado = product.pricing?.perSidePrice;

		datos.push({
			cifra: `${lados.length} ${lados.length === 1 ? "lado" : "lados"}`,
			titulo: nombres,
			nota: porLado
				? `Cada lado que uses suma ${pesos(porLado)} por pieza.`
				: `${nombres}, listos para imprimir.`,
		});
	}

	if (reglas.maxDesigns) {
		const puede = [
			reglas.allowText ? "texto" : null,
			reglas.allowImages ? "imágenes" : null,
		].filter(Boolean);

		datos.push({
			cifra: `${reglas.maxDesigns} ${reglas.maxDesigns === 1 ? "diseño" : "diseños"}`,
			titulo: "Máximo por prenda",
			nota:
				puede.length > 0
					? `Puedes meter ${puede.join(" e ")}.`
					: "Máximo por prenda.",
		});
	}

	if (reglas.maxColorsPerDesign) {
		datos.push({
			cifra: `${reglas.maxColorsPerDesign} colores`,
			titulo: "Por diseño",
			nota: product.production?.meta?.tecnica
				? `Es el límite de la ${product.production.meta.tecnica} de este proveedor.`
				: "Es el límite por diseño.",
		});
	}

	return datos;
}
