import { adminFetch } from "./admin";
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

/* ---- Admin: ya en AWS ----

   Los proveedores viven en DynamoDB y su cuenta en Cognito. Estas dos van
   por la Lambda de admin; el resto de este archivo todavía le pega a Nest. */

export function getProviders() {
	return adminFetch<Provider[]>("/providers");
}

/**
 * Lo que devuelve el alta. La contraseña temporal la genera Cognito y la API
 * la manda UNA sola vez: no queda guardada de nuestro lado, así que si el
 * admin no la copia, no hay de dónde volver a sacarla — habría que
 * restablecerla desde Cognito.
 */
export type ProveedorCreado = Provider & { contrasenaTemporal: string };

/**
 * Alta de un taller.
 *
 * Ya no se manda contraseña: la crea Cognito y obliga a cambiarla en el
 * primer ingreso. `name` es obligatorio porque de ahí sale el slug público.
 */
export function createProvider(data: { email: string; name: string }) {
	return adminFetch<ProveedorCreado>("/providers", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

/* ---- Alta pública ---- */

/**
 * Lo que manda el formulario público de `/proveedores/registro`.
 *
 * No crea una cuenta: es una SOLICITUD. El acceso lo damos nosotros a mano
 * con `createProvider`, que es el único que pide contraseña.
 *
 * OJO: `/providers/applications` todavía NO existe en la API. El formulario
 * está completo de este lado; en cuanto el endpoint aterrice, funciona.
 */
export type SolicitudProveedor = {
	taller: string;
	contacto: string;
	email: string;
	whatsapp: string;
	ciudad: string;
	tecnicas: string[];
	produce: string[];
	capacidad: string;
	nota?: string;
};

export function solicitarAlta(datos: SolicitudProveedor) {
	return apiFetch<{ ok: true }>("/providers/applications", {
		method: "POST",
		body: JSON.stringify(datos),
	});
}

/* ---- Provider auth ----

   Ya no vive aquí. La sesión del proveedor la da Cognito directo desde el
   navegador (lib/auth/cognito.ts) y el perfil sale de la Lambda en AWS
   (lib/api/proveedores.ts). Lo que queda abajo sigue pegándole a la API de
   Nest y se migra después. */

export function getMyProducts() {
	return apiFetch<ProviderProduct[]>("/providers/me/products");
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
