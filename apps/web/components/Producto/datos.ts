import type { Product } from "@/lib/api/products";

/** Una vista del producto en la galería. */
export type Vista = {
	key: string;
	label: string;
	src: string;
};

/**
 * Lo que se ve en la galería son las FOTOS del producto, no los mockups: el
 * mockup es el lienzo del editor y ahí se ve descolorido y sin contexto.
 * Sólo si el producto no trae fotos caemos a los mockups de la plantilla
 * para no dejar la galería vacía.
 */
export function vistasDe(product: Product): Vista[] {
	const fotos = product.images
		.slice()
		.sort((a, b) => a.order - b.order)
		.map((img, i) => ({
			key: `foto-${i}`,
			label: `Vista ${i + 1}`,
			src: img.url,
		}));

	if (fotos.length > 0) return fotos;

	const plantilla = product.productTemplateData;

	return (
		plantilla?.sides
			?.map((key) => ({
				key,
				label: plantilla.sideLabels?.[key] ?? key,
				src: plantilla.mockups?.[key] ?? "",
			}))
			.filter((v) => v.src) ?? []
	);
}

export type Reglas = {
	maxDesigns?: number;
	allowText?: boolean;
	allowImages?: boolean;
	maxColorsPerDesign?: number;
};

/**
 * Las reglas de personalización. La API las devuelve envueltas en la fila de
 * `product_customization_rules` (`{ id, productId, rules }`), así que hay que
 * bajar un nivel; algunos productos las traen planas.
 */
export function reglasDe(product: Product): Reglas {
	const crudas = product.customizationRules;
	if (!crudas) return {};

	return (crudas.rules ?? crudas) as Reglas;
}

/** "Textiles del Bajío · serigrafía · 9 días", saltándose lo que falte. */
export function fichaTecnica(product: Product) {
	const meta = product.production?.meta;

	return [
		product.production?.provider ?? product.provider?.displayName,
		meta?.tecnica,
		meta?.diasProduccion ? `${meta.diasProduccion} días` : null,
	]
		.filter(Boolean)
		.join(" · ");
}

/**
 * Estimado por pieza del escenario más común: la prenda, un lado impreso y
 * un diseño. El precio real se cierra en el editor, cuando ya se sabe
 * cuántos lados y cuántos colores lleva.
 */
export function porPieza(product: Product) {
	const p = product.pricing;
	if (!p) return null;

	return p.basePrice + (p.perSidePrice ?? 0) + (p.perDesignPrice ?? 0);
}

export function pesos(n: number) {
	return `$${n.toLocaleString("es-MX")}`;
}
