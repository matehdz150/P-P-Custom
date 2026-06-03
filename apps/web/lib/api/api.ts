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
    let message = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch { /* ignore */ }
    throw new Error(message);
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