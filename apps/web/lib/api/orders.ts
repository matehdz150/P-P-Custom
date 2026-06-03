import type { DesignAsset } from "@/lib/designer/orderDesignExport";
import { apiFetch } from "./api";

export type { DesignAsset };

// ---- Tipos ----
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in_production"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderStatusHistory = {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note: string | null;
  changedBy: string;
  createdAt: string;
};

export type Order = {
  id: string;
  userId: string;
  providerId: string;
  productId: string;
  designId: string | null;
  status: OrderStatus;
  quantity: number;
  totalPrice: string | null;
  notes: string | null;
  providerNote: string | null;
  designSnapshot: Record<string, string> | null;
  designAssets: Record<string, DesignAsset[]> | null;
  shippingAddress: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  product?: {
    id: string;
    name: string;
    images?: { url: string; order: number }[];
    pricing?: { basePrice: number };
  };
  provider?: {
    id: string;
    name: string | null;
    displayName: string | null;
  };
  statusHistory?: OrderStatusHistory[];
};

// ---- Usuario ----
export function createOrder(data: {
  designId: string;
  quantity?: number;
  notes?: string;
  shippingAddress?: Record<string, string>;
  designSnapshot?: Record<string, string>;
  designAssets?: Record<string, DesignAsset[]>;
}) {
  return apiFetch<{ id: string; status: OrderStatus }>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMyOrders() {
  return apiFetch<Order[]>("/orders/my");
}

// ---- Proveedor ----
export function getProviderOrders(status?: string) {
  const url = status ? `/orders/provider?status=${status}` : "/orders/provider";
  return apiFetch<Order[]>(url);
}

export function getProviderOrderDetail(id: string) {
  return apiFetch<Order>(`/orders/provider/${id}`);
}

export function updateOrderStatus(
  id: string,
  status: OrderStatus,
  note?: string,
) {
  return apiFetch<{ ok: boolean; status: OrderStatus }>(
    `/orders/provider/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    },
  );
}
