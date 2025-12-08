// lib/products/loadProductTemplate.ts
import type { ProductTemplate } from "./types";

export async function loadProductTemplate(
	productId: string,
): Promise<ProductTemplate> {
	const res = await fetch(`/productsMockup/${productId}.json`);

	if (!res.ok) {
		throw new Error(`No se encontró la plantilla de producto: ${productId}`);
	}

	const data = (await res.json()) as ProductTemplate;
	return data;
}
