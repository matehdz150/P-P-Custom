import type { DesignAsset } from "@/lib/designer/orderDesignExport";
import { apiFetch } from "./api";
import type { OrderStatus, OrderStatusHistory } from "./orders";

export type { DesignAsset };

/* ===== Types ===== */

export type PackageOrderItem = {
	id: string;
	packageOrderId: string;
	productId: string;
	designId: string | null;
	quantity: number;
	designSnapshot: Record<string, string> | null;
	designAssets: Record<string, DesignAsset[]> | null;
	product?: {
		id: string;
		name: string;
		images?: { url: string; order: number }[];
	};
};

export type PackageOrder = {
	id: string;
	userId: string;
	packageId: string;
	packageDesignId: string | null;
	providerId: string | null;
	status: OrderStatus;
	totalPrice: string | null;
	notes: string | null;
	providerNote: string | null;
	shippingAddress: Record<string, string> | null;
	createdAt: string;
	updatedAt: string;
	confirmedAt: string | null;
	shippedAt: string | null;
	deliveredAt: string | null;
	cancelledAt: string | null;
	package?: {
		id: string;
		name: string;
		image: string | null;
	};
	items?: PackageOrderItem[];
	statusHistory?: OrderStatusHistory[];
};

/* ===== Usuario ===== */

export function createPackageOrder(data: {
	packageDesignId: string;
	notes?: string;
	shippingAddress?: Record<string, string>;
}) {
	return apiFetch<{ id: string; status: OrderStatus }>("/package-orders", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export function getMyPackageOrders() {
	return apiFetch<PackageOrder[]>("/package-orders/my");
}

/* ===== Proveedor ===== */

export function getProviderPackageOrders(status?: string) {
	const url = status
		? `/package-orders/provider?status=${status}`
		: "/package-orders/provider";
	return apiFetch<PackageOrder[]>(url);
}

export function getProviderPackageOrderDetail(id: string) {
	return apiFetch<PackageOrder>(`/package-orders/provider/${id}`);
}

export function updatePackageOrderStatus(
	id: string,
	status: OrderStatus,
	note?: string,
) {
	return apiFetch<{ ok: boolean; status: OrderStatus }>(
		`/package-orders/provider/${id}/status`,
		{
			method: "PATCH",
			body: JSON.stringify({ status, note }),
		},
	);
}
