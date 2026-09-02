/**
 * Cliente de la API de proveedores (la Lambda en AWS, detrás de Cognito).
 *
 * Va directo a API Gateway, sin puente de Next: aquí no hay ningún secreto
 * que esconder, el permiso lo lleva el propio token del proveedor. El
 * autorizador JWT valida firma y caducidad antes de invocar la función, así
 * que una petición sin token ni siquiera llega a ejecutar código nuestro.
 */

import { borrarSesion, tokenVigente } from "@/lib/auth/cognito";
import type { Category } from "./categories";
import type { ProductTemplate } from "./templates";

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

/**
 * El mismo `pedir`, para los módulos del panel que viven en otro archivo
 * (hoy `pedidos.ts`). Se exporta la función y no se duplica el `fetch` para
 * que el manejo del token muerto —limpiar la sesión en un 401— siga estando
 * en un solo sitio.
 */
export const pedirComoProveedor = pedir;

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

/* ─── El catálogo que necesita el asistente de alta ──────────────────────
   Las prendas base y las categorías las administra el admin, pero el taller
   las LEE por su propia API. Antes las pedía por `/api/admin/*`, o sea con
   la llave del admin puesta: eso funciona hoy sólo porque ese puente no
   exige sesión, y se rompería en cuanto el admin tenga login. */

export function plantillasParaAlta() {
  return pedir<ProductTemplate[]>("/proveedores/plantillas");
}

export function categoriasParaAlta() {
  return pedir<Category[]>("/proveedores/categorias");
}

/* ─── Los productos del taller ──────────────────────────────────────────── */

/**
 * Por dónde va un producto.
 *
 * El taller mueve entre `borrador`, `en_revision` y `archivado`; `activo` y
 * `rechazado` los pone el admin al revisar. Editar uno ya aprobado lo manda
 * de vuelta a revisión: la aprobación es del producto, no del momento.
 */
export type EstadoProducto =
  | "borrador"
  | "en_revision"
  | "activo"
  | "rechazado"
  | "archivado";

export const ETIQUETA_ESTADO_PRODUCTO: Record<EstadoProducto, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  activo: "Publicado",
  rechazado: "Necesita cambios",
  archivado: "Archivado",
};

export type ProductoDeTaller = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  sku?: string;
  templateId: string;
  categoryIds?: string[];
  images: { url: string; order: number }[];
  printSides: { sideKey: string; widthCm: number; heightCm: number }[];
  sizes: { size: string; widthIn: number; lengthIn: number }[];
  colors: { name: string; hex: string }[];
  pricing: { basePrice: number; [k: string]: number | undefined };
  estado: EstadoProducto;
  /** Por qué el admin lo regresó. Lo escribe él al rechazar. */
  notaRevision: string | null;
  createdAt: string;
  updatedAt: string;
};

export function misProductos() {
  return pedir<ProductoDeTaller[]>("/proveedores/productos");
}

export function miProducto(id: string) {
  return pedir<ProductoDeTaller>(`/proveedores/productos/${id}`);
}

/**
 * Guarda un producto nuevo. `enviar` decide si va a revisión o se queda en
 * borrador; publicar no está en manos del taller.
 */
export function crearMiProducto(datos: Record<string, unknown>) {
  return pedir<{ id: string; slug: string; estado: EstadoProducto }>(
    "/proveedores/productos",
    { method: "POST", body: JSON.stringify(datos) },
  );
}

export function actualizarMiProducto(id: string, datos: Record<string, unknown>) {
  return pedir<ProductoDeTaller>(`/proveedores/productos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  });
}

/**
 * Sube una foto de producto a S3 en dos pasos: la API firma el permiso y el
 * navegador hace PUT directo. El archivo no pasa por la Lambda.
 *
 * La carpeta la decide el token, no esta función: cada taller escribe sólo
 * bajo la suya. Devuelve la RUTA (`/medios/...`), que es lo que se guarda.
 */
export async function subirFotoDeProducto(file: File): Promise<string> {
  const permiso = await pedir<{ uploadUrl: string; path: string }>(
    "/proveedores/subidas/foto",
    { method: "POST", body: JSON.stringify({ contentType: file.type }) },
  );

  const res = await fetch(permiso.uploadUrl, {
    method: "PUT",
    // Exactamente el tipo que se firmó, o S3 rechaza la firma.
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!res.ok) throw new Error(`S3 rechazó la subida (${res.status})`);

  return permiso.path;
}
