import { apiFetch } from "./api";

/* ===== Types ===== */

export type PackageDesignUnitDesign = {
	id: string;
	name: string | null;
	snapshots: Record<string, string> | null;
	status: "draft" | "completed";
};

export type PackageDesignUnit = {
	id: string;
	packageItemId: string;
	unitIndex: number;
	designId: string | null;
	design?: PackageDesignUnitDesign | null;
};

export type PackageDesignItemProduct = {
	id: string;
	name: string;
	images?: { url: string; order: number }[];
	pricing?: { basePrice: number } | null;
};

export type PackageDesignItem = {
	id: string;
	productId: string;
	quantity: number;
	designRequired: boolean;
	product?: PackageDesignItemProduct;
};

export type PackageDesign = {
	id: string;
	userId: string;
	packageId: string;
	status: "draft" | "completed";
	units: PackageDesignUnit[];
	package?: {
		id: string;
		name: string;
		image?: string | null;
		items: PackageDesignItem[];
		pricing?: { basePrice: number } | null;
	};
};

export type SetUnitInput = {
	packageItemId: string;
	unitIndex: number;
	designId: string | null;
};

/** Resumen de un borrador de diseño de paquete (para el dashboard). */
export type PackageDesignSummary = {
	id: string;
	packageId: string;
	status: "draft" | "completed";
	createdAt: string;
	updatedAt: string;
	units: { id: string; designId: string | null }[];
	package?: {
		id: string;
		name: string;
		image: string | null;
		items: { id: string; quantity: number }[];
	};
};

/* ===== Calls ===== */

/** Lista los borradores de diseño de paquete del usuario actual. */
export function getMyPackageDesigns() {
	return apiFetch<PackageDesignSummary[]>("/package-designs/my");
}

/** Crea (o recupera) el borrador de diseño del paquete del usuario actual. */
export function ensurePackageDesign(packageId: string) {
	return apiFetch<PackageDesign>("/package-designs/ensure", {
		method: "POST",
		body: JSON.stringify({ packageId }),
	});
}

export function getPackageDesign(id: string) {
	return apiFetch<PackageDesign>(`/package-designs/${id}`);
}

/** Asigna/quita un diseño a una o varias unidades. Devuelve el diseño actualizado. */
export function setPackageDesignUnits(id: string, units: SetUnitInput[]) {
	return apiFetch<PackageDesign>(`/package-designs/${id}/units`, {
		method: "PATCH",
		body: JSON.stringify({ units }),
	});
}

export function updatePackageDesignStatus(
	id: string,
	status: "draft" | "completed",
) {
	return apiFetch<{ ok: true }>(`/package-designs/${id}/status`, {
		method: "PATCH",
		body: JSON.stringify({ status }),
	});
}
