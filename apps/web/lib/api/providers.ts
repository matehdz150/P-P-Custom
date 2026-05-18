import { apiFetch } from "./api";

export type Provider = {
	id: string;
	email: string;
	name: string | null;
	slug: string | null;
	displayName?: string | null;
	bio?: string | null;
	avatarUrl?: string | null;
	bannerUrl?: string | null;
	createdAt: string;
};

export type PublicProvider = {
	provider: {
		id: string;
		slug: string | null;
		displayName: string | null;
		name: string | null;
		bio: string | null;
		avatarUrl: string | null;
		bannerUrl: string | null;
		createdAt: string;
	};
	products: ProviderProduct[];
};

export type ProviderProduct = {
	id: string;
	name: string;
	slug: string;
	status: string;
	images?: { url: string; order: number }[];
	pricing?: { basePrice: number } | null;
};

/* ---- Admin ---- */
export function getProviders() {
	return apiFetch<Provider[]>("/providers");
}

export function createProvider(data: {
	email: string;
	password: string;
	name?: string;
}) {
	return apiFetch<Provider>("/providers", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

/* ---- Provider auth ---- */
export function providerLogin(email: string, password: string) {
	return apiFetch<{ ok: true }>("/providers/login", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
}

export function providerLogout() {
	return apiFetch<{ ok: true }>("/providers/logout", { method: "POST" });
}

export function providerMe() {
	return apiFetch<Provider>("/providers/me");
}

export function getMyProducts() {
	return apiFetch<ProviderProduct[]>("/providers/me/products");
}

export function updateMyProfile(data: {
	displayName?: string;
	bio?: string;
	avatarUrl?: string;
	bannerUrl?: string;
	slug?: string;
}) {
	return apiFetch<Provider>("/providers/me/profile", {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export function getPublicProvider(slug: string) {
	return apiFetch<PublicProvider>(
		`/providers/public/${encodeURIComponent(slug)}`,
	);
}

/* ---- Provider product creation ---- */
// biome-ignore lint/suspicious/noExplicitAny: payload reuses admin product shape
export function createProviderProduct(payload: any) {
	return apiFetch<{ id: string }>("/providers/products", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}

/* ---- Provider packages ---- */
export type ProviderPackage = {
	id: string;
	name: string;
	status: string;
	image?: string | null;
	pricing?: { basePrice: number } | null;
};

export function getMyPackages() {
	return apiFetch<ProviderPackage[]>("/providers/me/packages");
}

// biome-ignore lint/suspicious/noExplicitAny: payload reuses admin package shape
export function createProviderPackage(payload: any) {
	return apiFetch<{ id: string }>("/providers/packages", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}
