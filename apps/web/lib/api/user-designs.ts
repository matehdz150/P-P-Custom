import { apiFetch } from "./api";

export type UserDesign = {
  id: string;
  userId: string;
  productId: string;
  name: string | null;
  canvasData: Record<string, any>;
  snapshots: Record<string, string> | null;
  status: "draft" | "completed";
  createdAt: string;
  updatedAt: string;
  product?: {
    id: string;
    name: string;
    images?: { url: string; order: number }[];
    pricing?: { basePrice: number };
  };
};

export type SaveUserDesignInput = {
  id?: string;
  productId: string;
  name?: string;
  canvasData: Record<string, any>;
  snapshots?: Record<string, string>;
  status?: "draft" | "completed";
};

export function getUserDesigns(params?: { status?: string; productId?: string }) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.productId) search.set("productId", params.productId);

  const query = search.toString();
  const url = query ? `/user-designs?${query}` : "/user-designs";
  return apiFetch<UserDesign[]>(url);
}

export function getUserDesign(id: string) {
  return apiFetch<UserDesign>(`/user-designs/${id}`);
}

export function saveUserDesign(data: SaveUserDesignInput) {
  return apiFetch<{ id: string }>("/user-designs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteUserDesign(id: string) {
  return apiFetch<{ ok: true }>(`/user-designs/${id}`, {
    method: "DELETE",
  });
}

export function updateUserDesignStatus(id: string, status: "draft" | "completed") {
  return apiFetch<{ ok: true }>(`/user-designs/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
