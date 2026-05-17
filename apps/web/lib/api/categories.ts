import { apiFetch } from "./api";

/* =========================
   TYPES
========================= */

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  image?: string; // 👈 opcional para soportar package categories
  createdAt: string;
};

/* =========================
   INPUTS
========================= */

// PRODUCT CATEGORIES
export type CreateCategoryInput = {
  name: string;
  description?: string;
  image: string;
};

export type UpdateCategoryInput = Partial<CreateCategoryInput>;

// PACKAGE CATEGORIES
export type CreatePackageCategoryInput = {
  name: string;
  description?: string;
};

export type GetPackagesParams = {
  packageCategoryId?: string;
  categoryName?: string;
  limit?: number;
};

/* =========================
   PRODUCT CATEGORIES
========================= */

/** Obtener todas las categorías de productos */
export async function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/categories");
}

/** Obtener una categoría de producto por ID */
export async function getCategory(id: string): Promise<Category> {
  return apiFetch<Category>(`/categories/${id}`);
}

/** Crear categoría de producto */
export async function createCategory(
  data: CreateCategoryInput
): Promise<Category> {
  return apiFetch<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Actualizar categoría de producto */
export async function updateCategory(
  id: string,
  data: UpdateCategoryInput
): Promise<Category> {
  return apiFetch<Category>(`/categories/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Eliminar categoría de producto */
export async function deleteCategory(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/categories/${id}`, {
    method: "DELETE",
  });
}

/* =========================
   PACKAGE CATEGORIES
========================= */

/** Obtener todas las categorías de paquetes */
export async function getPackageCategories(): Promise<Category[]> {
  return apiFetch<Category[]>("/package-categories");
}

/** Obtener una categoría de paquete por ID */
export async function getPackageCategory(id: string): Promise<Category> {
  return apiFetch<Category>(`/package-categories/${id}`);
}

/** Crear categoría de paquete */
export async function createPackageCategory(
  data: CreatePackageCategoryInput
): Promise<Category> {
  return apiFetch<Category>("/package-categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deletePackageCategory(id: string) {
  return apiFetch<{ ok: true }>(`/package-categories/${id}`, {
    method: "DELETE",
  });
}

export type PackageFromCategory = {
  basePrice: number;
  id: string;
  name: string;
  description?: string | null;
  status: "draft" | "active" | "archived";
  image?: string | null;
  createdAt: string;
};

export type PackageCategoryWithPackages = {
  id: string;
  name: string;
  description?: string | null;
  packages: PackageFromCategory[];
};

export async function getPackageCategoryWithPackagesByName(
  name: string
): Promise<PackageCategoryWithPackages> {
  return apiFetch<PackageCategoryWithPackages>(
    `/package-categories/by-name/${encodeURIComponent(name)}`
  );
}
