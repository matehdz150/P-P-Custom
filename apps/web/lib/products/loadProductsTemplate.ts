// lib/products/loadProductTemplate.ts
// lib/products/loadProductTemplate.ts
// lib/products/loadProductTemplate.ts
import { getProduct } from "@/lib/api/products";
import type { DesignerProductTemplate } from "@/lib/api/products";

export async function loadProductTemplate(
  productId: string,
): Promise<DesignerProductTemplate> {
  const product = await getProduct(productId);

  if (!product.productTemplateData) {
    throw new Error(
      `El producto ${productId} no tiene productTemplateData`,
    );
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
    sides: tpl.sides,
    sideLabels: tpl.sideLabels,
    mockups: tpl.mockups,
    editableAreas: tpl.editableAreas,
    customizationRules: {
      maxDesigns: (rules.maxDesigns as number) ?? undefined,
      allowText: (rules.allowText as boolean) ?? true,
      allowImages: (rules.allowImages as boolean) ?? true,
      maxColorsPerDesign: (rules.maxColorsPerDesign as number) ?? undefined,
    },
    pricing: product.pricing,
  };
}