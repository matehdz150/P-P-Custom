import "server-only";

/**
 * La misma API de admin, pero llamada DESDE el servidor.
 *
 * El helper del navegador (`admin.ts`) pega a `/api/admin/*`, una ruta
 * relativa que del lado del servidor no resuelve. Aquí se va directo a la
 * Lambda con la llave, que en el servidor sí se puede tener.
 *
 * El `server-only` de arriba no es decoración: si alguien importa esto
 * desde un componente de cliente, la compilación falla en vez de mandar la
 * llave al navegador.
 */
const API = process.env.KUSTTO_ADMIN_API;
const CLAVE = process.env.KUSTTO_CLAVE_ADMIN;

export async function adminFetchServidor<T>(
	ruta: string,
	opciones?: RequestInit,
): Promise<T> {
	if (!API || !CLAVE) {
		throw new Error(
			"Falta KUSTTO_ADMIN_API o KUSTTO_CLAVE_ADMIN en el entorno del servidor",
		);
	}

	const res = await fetch(`${API}${ruta}`, {
		headers: {
			"content-type": "application/json",
			"x-clave-admin": CLAVE,
		},
		// El admin siempre quiere el estado de ahora, no uno cacheado.
		cache: "no-store",
		...opciones,
	});

	if (!res.ok) {
		const cuerpo = await res.json().catch(() => null);
		throw new Error(
			cuerpo?.message ?? `La API de admin respondió ${res.status}`,
		);
	}

	return res.json();
}
