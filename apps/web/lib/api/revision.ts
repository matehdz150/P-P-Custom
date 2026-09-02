import { adminFetch } from "./admin";
import type { EstadoProducto } from "./proveedores";

/**
 * La cola de revisión de productos, desde el admin.
 *
 * Los productos los escribe el taller por su propia API; aquí sólo se
 * aprueban o se regresan. Va por `adminFetch`, o sea por el puente de Next
 * que pone la llave del lado del servidor.
 */

export type ProductoEnRevision = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  estado: EstadoProducto;
  proveedorId: string;
  /** Se resuelve al leer, no se guarda: el taller puede cambiarse el nombre. */
  proveedorNombre: string;
  templateId: string;
  images: { url: string; order: number }[];
  printSides: { sideKey: string; widthCm: number; heightCm: number }[];
  sizes: { size: string; widthIn: number; lengthIn: number }[];
  colors: { name: string; hex: string }[];
  pricing: { basePrice: number; [k: string]: number | undefined };
  notaRevision: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Sin estado, trae los que esperan revisión: es la cola de trabajo. */
export function getProductosEnRevision(estado?: EstadoProducto) {
  const query = estado ? `?estado=${estado}` : "";
  return adminFetch<ProductoEnRevision[]>(`/productos${query}`);
}

export function getProductoEnRevision(id: string) {
  return adminFetch<ProductoEnRevision>(`/productos/${id}`);
}

/**
 * Aprueba un producto: entra al catálogo.
 *
 * Falla con 409 si alguien más ya lo resolvió o si el taller lo movió
 * mientras tanto. Eso no es un error a esconder: la lista está vieja y hay
 * que recargarla.
 */
export function aprobarProducto(id: string) {
  return adminFetch<ProductoEnRevision>(`/productos/${id}/revision`, {
    method: "PATCH",
    body: JSON.stringify({ decision: "aprobar" }),
  });
}

/** Lo regresa al taller. La nota es obligatoria: es lo único que él verá. */
export function rechazarProducto(id: string, nota: string) {
  return adminFetch<ProductoEnRevision>(`/productos/${id}/revision`, {
    method: "PATCH",
    body: JSON.stringify({ decision: "rechazar", nota }),
  });
}
