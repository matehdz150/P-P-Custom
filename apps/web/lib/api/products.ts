import { apiFetch } from "./api";

/* =========================
   TYPES
========================= */



export type ProductImage = {
  url: string;
  order: number;
};

export type ProductPrintSide = {
  sideKey: "front" | "back" | "left" | "right";
  widthCm: number;
  heightCm: number;
  dpi?: number;
  enabled?: boolean;
};

/* ✅ NUEVO */
export type ProductSize = {
  size: string;        // S | M | L | XL | etc
  widthIn: number;     // ancho (inches)
  lengthIn: number;    // largo (inches)
};

export type ProductColor = {
  name: string;
  hex: string;
};

export type ProductPricing = {
  basePrice: number;
  perSidePrice?: number;
  perDesignPrice?: number;
  perColorPrice?: number;
  embroideryExtra?: number;
};

export type ProductProduction = {
  provider: string;
  providerSku?: string;
  meta?: Record<string, any>;
};

export type ProductTemplateData = {
  sides: string[];
  sideLabels: Record<string, string>;
  mockups: Record<string, string>;
  editableAreas: Record<string, any[]>;
};

export type DesignerCustomizationRules = {
  maxDesigns?: number;
  allowText?: boolean;
  allowImages?: boolean;
  maxColorsPerDesign?: number;
};

export type DesignerProductTemplate = {
  id: string;
  name?: string;
  sides: string[];
  sideLabels: Record<string, string>;
  mockups: Record<string, string>;
  editableAreas: Record<string, any[]>;
  customizationRules?: DesignerCustomizationRules;
  pricing?: ProductPricing;
  /** Los colores en que se puede pedir la prenda. Tiñen el mockup. */
  colors?: ProductColor[];
  /** Las tallas que el taller maneja: son las que se piden desde el editor. */
  sizes?: ProductSize[];
  /**
   * El área imprimible de cada lado, en centímetros.
   *
   * No es decoración: de aquí sale a qué resolución se exporta el archivo que
   * el taller manda a máquina. Sin esto habría que adivinar los DPI.
   */
  printSides?: ProductPrintSide[];
};

export type Product = {
  id: string;
  slug: string;
  sku: string;
  internalName: string;
  name: string;
  description?: string | null;

  brand?: string | null;
  category?: string | null;

  status: "draft" | "active" | "archived";
  templateId: string;
  isCustomizable: boolean;

  // ✅ AQUI ESTABA EL PROBLEMA
  productTemplateData: ProductTemplateData;

  images: ProductImage[];
  printSides?: ProductPrintSide[];
  sizes?: ProductSize[];
  colors?: ProductColor[];
  pricing?: ProductPricing;
  customizationRules?: Record<string, any>;
  production?: ProductProduction;

  provider?: {
    id: string;
    slug: string | null;
    displayName: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null;

  createdAt: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  description?: string | null;
  images: {
    url: string;
    order: number;
  }[];
  pricing: {
    basePrice: number;
  };
};

/* =========================
   INPUTS
========================= */

export type CreateProductInput = {
  name: string;
  sku: string;
  internalName: string;
  templateId: string;

  /* Aceptan `null` porque los formularios mandan el campo vacío como `null`,
     que es lo que guarda la base. Declararlos sólo como `string` obligaba a
     limpiarlos en cada sitio que construye un payload. */
  description?: string | null;
  brand?: string | null;
  category?: string | null;

  status: string;

  images: ProductImage[]; // 👈 OBLIGATORIO (mín 2)

  printSides?: ProductPrintSide[];

  /* ✅ ACTUALIZADO */
  sizes?: ProductSize[];

  colors?: ProductColor[];
  pricing?: ProductPricing;
  customizationRules?: Record<string, any>;
  production?: ProductProduction;
};

export type UpdateProductInput = Partial<CreateProductInput> & {
  status?: "draft" | "active" | "archived";
};

/* =========================
   API CALLS
========================= */

export function getProducts() {
  return apiFetch<Product[]>("/products");
}

export function getProduct(id: string) {
  return apiFetch<Product>(`/products/${id}`);
}

export function createProduct(data: CreateProductInput) {
  if (!data.images || data.images.length < 2) {
    throw new Error("El producto debe tener al menos 2 imágenes");
  }

  return apiFetch<{ id: string }>("/products", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      slug: data.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-"),
      status: data.status ?? "draft",
      isCustomizable: true,
    }),
  });
}

export function updateProduct(id: string, data: UpdateProductInput) {
  return apiFetch(`/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteProduct(id: string) {
  return apiFetch(`/products/${id}`, {
    method: "DELETE",
  });
}

export function getCatalogProducts() {
  return apiFetch<CatalogProduct[]>("/products/catalog");
}