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

/** Error de la API con el código a la mano, para poder distinguir un 404. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string
  ) {
    super(`API ${status} en ${path}${body ? ` — ${body}` : ""}`);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${resolveApiUrl()}${path}`, {
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