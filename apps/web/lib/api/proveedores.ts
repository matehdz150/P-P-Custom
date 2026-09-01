/**
 * Cliente de la API de proveedores (la Lambda en AWS, detrás de Cognito).
 *
 * Va directo a API Gateway, sin puente de Next: aquí no hay ningún secreto
 * que esconder, el permiso lo lleva el propio token del proveedor. El
 * autorizador JWT valida firma y caducidad antes de invocar la función, así
 * que una petición sin token ni siquiera llega a ejecutar código nuestro.
 */

import { borrarSesion, tokenVigente } from "@/lib/auth/cognito";

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

export class ErrorProveedor extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorProveedor";
  }

  /** No hay sesión, o ya no sirve. Quien lo cache debe mandar al login. */
  get sinSesion() {
    return this.status === 401 || this.status === 403;
  }
}

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  const token = await tokenVigente();
  if (!token) throw new ErrorProveedor(401, "No hay sesión");

  const res = await fetch(`${API}${ruta}`, {
    ...opciones,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...opciones?.headers,
    },
  });

  if (!res.ok) {
    // Un 401 desde el autorizador significa token muerto: se limpia para no
    // dejar al panel en el limbo de "hay sesión pero nada carga".
    if (res.status === 401) borrarSesion();

    const cuerpo = await res.json().catch(() => null);
    throw new ErrorProveedor(
      res.status,
      cuerpo?.message ?? `La API respondió ${res.status}`,
    );
  }

  return res.json();
}

export type Proveedor = {
  id: string;
  email: string;
  name: string | null;
  slug: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  createdAt: string;
};

/** El perfil del proveedor que trae el token. Nunca el de otro. */
export function miPerfil() {
  return pedir<Proveedor>("/proveedores/yo");
}

export function actualizarMiPerfil(datos: {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
}) {
  return pedir<Proveedor>("/proveedores/yo", {
    method: "PATCH",
    body: JSON.stringify(datos),
  });
}
