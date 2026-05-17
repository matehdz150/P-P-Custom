// apps/api/src/products/dto/create-product.dto.ts

export type ProductStatus = "draft" | "active" | "archived";

export interface CreateProductDto {
  slug: string;
  sku: string;

  internalName: string;
  name: string;
  description?: string;

  brand?: string;
  categoryIds?: string[];

  status?: ProductStatus;
  templateId: string;
  templateSides: string[];

  isCustomizable?: boolean;

  providerId?: string;

  images?: {
    url: string;
    order?: number;
  }[];

  printSides?: {
    sideKey: string;
    widthCm: number;
    heightCm: number;
    dpi?: number;
    enabled?: boolean;
  }[];

  /* ✅ SIZES CON METRICA */
  sizes?: {
    size: string; // S | M | L | XL | 2XL
    widthIn: number; // ancho pecho a pecho
    lengthIn: number; // largo total
  }[];

  colors?: {
    name: string;
    hex?: string;
  }[];

  pricing?: {
    basePrice: number; // centavos
    perSidePrice?: number;
    perDesignPrice?: number;
    perColorPrice?: number;
    embroideryExtra?: number;
  };

  customizationRules?: Record<string, unknown>;

  production?: {
    provider?: string;
    providerSku?: string;
    meta?: Record<string, unknown>;
  };
}
