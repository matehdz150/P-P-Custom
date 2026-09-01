// lib/api/search.ts
import { apiFetch } from "./api";

export type SearchResultItem = {
  type: "product" | "package";
  id: string;
  name: string;
  image: string | null;
  price?: number | null;
};

export type ProductFromCategory = {
  id: string;
  name: string;
  description?: string | null;
  images: { url: string }[];
  basePrice?: number;

  // Vienen de product_production y product_colors: alimentan la ficha del
  // catálogo (proveedor · técnica · días) y los filtros del listado.
  provider?: string | null;
  technique?: string | null;
  productionDays?: number | null;
  colors?: { name: string; hex?: string | null }[];
};

export async function searchCatalog(
  q: string,
  limit = 12
): Promise<SearchResultItem[]> {
  if (!q.trim()) return [];

  return apiFetch<SearchResultItem[]>(
    `/search?q=${encodeURIComponent(q)}&limit=${limit}`
  );
}

export async function getProductsByCategory(
  categoryId: string
): Promise<ProductFromCategory[]> {
  return apiFetch<ProductFromCategory[]>(
    `/categories/${categoryId}/products`
  );
}