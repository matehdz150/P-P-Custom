/* =========================
   TYPES
========================= */

import { apiFetch } from "./api";

/* ===== Backend raw types ===== */

type PackageApiResponse = {
	id: string;
	name: string;
	description?: string | null;
	status: "draft" | "active" | "archived";
	image?: string | null;
	createdAt: string;

	items?: PackageItem[];
	pricing?: PackagePricing;
};

/* ===== Frontend types ===== */

export type PackageItemProduct = {
	id: string;
	name: string;
	pricing?: {
		basePrice: number;
	};
};

export type PackageItem = {
	id: string;
	productId: string;
	quantity: number;
	designRequired: boolean;

	product?: PackageItemProduct;
};

export type PackagePricing = {
	basePrice: number;
};

export type Package = {
	id: string;
	name: string;
	description?: string | null;
	status: "draft" | "active" | "archived";
	image?: string | null;
	createdAt: string;

	items?: PackageItem[];
	pricing?: PackagePricing;
};

/* =========================
   INPUTS
========================= */

export type CreatePackageInput = {
	name: string;
	description?: string;

	// ⚠️ esto es solo para enviar IDs al backend
	categories?: string[];

	items: {
		productId: string;
		quantity: number;
	}[];

	pricing: {
		basePrice: number;
	};
};

export type UpdatePackageInput = Partial<CreatePackageInput> & {
	status?: "draft" | "active" | "archived";
};

/* =========================
   API CALLS
========================= */

export type GetPackagesParams = {
	packageCategoryId?: string;
	categoryName?: string;
	limit?: number;
};

export async function getPackages(
	params?: GetPackagesParams,
): Promise<Package[]> {
	const search = new URLSearchParams();

	if (params?.categoryName) {
		search.set("categoryName", params.categoryName);
	}

	if (params?.packageCategoryId) {
		search.set("packageCategoryId", params.packageCategoryId);
	}

	if (params?.limit) {
		search.set("limit", String(params.limit));
	}

	const query = search.toString();
	const url = query ? `/packages?${query}` : "/packages";

	return apiFetch<Package[]>(url);
}

export async function getPackage(id: string): Promise<Package> {
	const pkg = await apiFetch<PackageApiResponse>(`/packages/${id}`);

	return {
		...pkg,
	};
}

export function createPackage(data: CreatePackageInput) {
	return apiFetch<{ id: string }>("/packages", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export function updatePackage(id: string, data: UpdatePackageInput) {
	return apiFetch<{ ok: true }>(`/packages/${id}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export function deletePackage(id: string) {
	return apiFetch<{ ok: true }>(`/packages/${id}`, {
		method: "DELETE",
	});
}
