// lib/products/loadProductTemplate.ts
// lib/products/loadProductTemplate.ts
// lib/products/loadProductTemplate.ts
import { aProductoViejo, getFichaDeProducto } from "@/lib/api/catalogo";
import type { DesignerProductTemplate } from "@/lib/api/products";
import type { EditableShape } from "@/lib/products/types";

export async function loadProductTemplate(
	productId: string,
): Promise<DesignerProductTemplate> {
	// Del catálogo público: el editor lo abre un cliente sin sesión, y la
	// plantilla ya viene resuelta dentro de la ficha.
	const ficha = await getFichaDeProducto(productId);
	const product = aProductoViejo(ficha);

	if (!product.productTemplateData) {
		throw new Error(`El producto ${productId} no tiene productTemplateData`);
	}

	const tpl = product.productTemplateData;

	// la relación devuelve { productId, rules: {...} }
	const rawRules = (product.customizationRules ?? {}) as Record<
		string,
		unknown
	>;
	const rules: Record<string, unknown> =
		rawRules.rules && typeof rawRules.rules === "object"
			? (rawRules.rules as Record<string, unknown>)
			: rawRules;

	return {
		id: product.id,
		name: product.name,
		forma: tpl.forma ?? "plano",
		sides: tpl.sides,
		sideLabels: tpl.sideLabels,
		mockups: tpl.mockups,
		editableAreas: conSangrado(tpl.editableAreas, product.printSides),
		customizationRules: {
			maxDesigns: (rules.maxDesigns as number) ?? undefined,
			allowText: (rules.allowText as boolean) ?? true,
			allowImages: (rules.allowImages as boolean) ?? true,
			maxColorsPerDesign: (rules.maxColorsPerDesign as number) ?? undefined,
		},
		pricing: product.pricing,
		colors: product.colors,
		sizes: product.sizes,
		printSides: product.printSides,
		/* Se toma de la ficha y no de `aProductoViejo`: ese adaptador existe para
		   alimentar a los componentes viejos con la forma que ya esperaban, y
		   esto es nuevo. Metérselo ahí obligaría a ensanchar `Product` entero. */
		fotosReales: ficha.fotosReales ?? [],
	};
}

/**
 * Le pega a cada área el sangrado que declaró el taller, ya en píxeles.
 *
 * ES EL ÚNICO SITIO donde se conocen a la vez los dos números que hacen falta:
 * los centímetros del `printSide` y lo que mide el área en la plantilla. La
 * regla de tres es `px por cm = anchoDelArea / widthCm`, y de ahí sale cuánto
 * hay que desbordar en el lienzo.
 *
 * Se hace aquí y no en cada consumidor porque son TRES —el recorte de los
 * objetos, el clip y la exportación— y tenerla escrita tres veces es garantía
 * de que una se quede corta y el arte salga sin desbordar por un lado.
 *
 * SIN `widthCm` NO SE PUEDE, y no se inventa: sin el declarado no hay escala,
 * y un sangrado calculado a ojo sería peor que ninguno.
 */
function conSangrado(
	areas: Record<string, EditableShape[]>,
	printSides: DesignerProductTemplate["printSides"],
): Record<string, EditableShape[]> {
	if (!printSides?.length) return areas;

	return Object.fromEntries(
		Object.entries(areas).map(([lado, formas]) => {
			const medidas = printSides.find((s) => s.sideKey === lado);
			const sangradoCm = Number(medidas?.sangradoCm ?? 0);
			const anchoCm = Number(medidas?.widthCm ?? 0);

			if (!(sangradoCm > 0 && anchoCm > 0)) return [lado, formas];

			return [
				lado,
				formas.map((forma) => {
					const anchoPx = "width" in forma ? Number(forma.width) : 0;
					if (!(anchoPx > 0)) return forma;

					return { ...forma, sangradoPx: (anchoPx / anchoCm) * sangradoCm };
				}),
			];
		}),
	);
}
