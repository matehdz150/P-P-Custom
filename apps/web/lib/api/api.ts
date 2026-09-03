// En el navegador siempre NEXT_PUBLIC_API_URL (localhost:8000).
// En el servidor (SSR dentro de Docker) usa API_URL_INTERNAL para
// alcanzar la API por el nombre del servicio (http://api:8000).
function resolveApiUrl(): string {
	if (typeof window === "undefined") {
		return (
			process.env.API_URL_INTERNAL ??
			process.env.NEXT_PUBLIC_API_URL ??
			"http://localhost:8000"
		);
	}
	return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

/**
 * Si esta API existe donde se está corriendo.
 *
 * Lo que queda en Nest —paquetes y cuentas de comprador— **no se despliega**.
 * En el sitio publicado, cada llamada acababa en un `ERR_CONNECTION_REFUSED`
 * contra `localhost:8000`, que no dice nada de lo que pasa: parece que el
 * servidor se cayó, cuando en realidad esa API nunca estuvo ahí.
 *
 * Se comprueba con la página, no con el entorno: quien abra el sitio desde
 * su propia máquina de desarrollo SÍ tiene Nest al lado y debe seguir
 * hablándole.
 */
function apiAlcanzable(url: string): boolean {
	if (typeof window === "undefined") return true;

	const local = /^(localhost|127\.0\.0\.1|\[::1\])$/;
	const apuntaALocal = local.test(new URL(url).hostname);

	return !apuntaALocal || local.test(window.location.hostname);
}

/** Error de la API con el código a la mano, para poder distinguir un 404. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly path: string,
		readonly body: string,
	) {
		super(`API ${status} en ${path}${body ? ` — ${body}` : ""}`);
		this.name = "ApiError";
	}
}

export async function apiFetch<T>(
	path: string,
	options?: RequestInit,
): Promise<T> {
	const base = resolveApiUrl();

	// Falla aquí, y diciendo por qué, en vez de estrellarse contra un puerto
	// que no existe. Quien llama ya sabe seguir sin esto: las secciones que
	// dependen de Nest simplemente no se pintan.
	if (!apiAlcanzable(base)) {
		throw new ApiError(
			503,
			path,
			"La API de Nest no está desplegada: esto sólo funciona en desarrollo.",
		);
	}

	const res = await fetch(`${base}${path}`, {
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		...options,
	});

	if (!res.ok) {
		// El cuerpo trae el mensaje de Nest; sin él el log queda ciego.
		const body = await res.text().catch(() => "");
		throw new ApiError(res.status, path, body.slice(0, 300));
	}

	return res.json();
}

export async function fetchMe() {
	return apiFetch<{
		id: string;
		email: string;
		name: string | null;
	}>("/auth/me");
}

export async function refreshSession() {
	return apiFetch<{ ok: true }>("/auth/refresh", { method: "POST" });
}

export async function logout() {
	await apiFetch("/auth/logout", { method: "POST" });
	window.location.href = "/catalogo";
}

export async function registerUser(data: {
	email: string;
	password: string;
	name?: string;
}) {
	return apiFetch<{ ok: true }>("/auth/register", {
		method: "POST",
		body: JSON.stringify(data),
	});
}

export async function loginUser(email: string, password: string) {
	return apiFetch<{ ok: true }>("/auth/login", {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
}
