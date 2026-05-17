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