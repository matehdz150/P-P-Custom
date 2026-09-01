import { adminFetch } from "./admin";

/* =========================
   TYPES
========================= */

export type EditableAreaShape = "rect" | "ellipse" | "triangle";

export type EditableArea = {
  id: string;
  type: EditableAreaShape;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type ProductTemplateData = {
  /**
   * Lados disponibles del template
   * ej: ["front", "back", "sleeve"]
   */
  sides: string[];

  /**
   * Labels por lado
   * ej: { front: "Delante", back: "Detrás" }
   */
  sideLabels: Record<string, string>;

  /**
   * Mockup por lado (URL en cloud)
   * ej: { front: "https://...", back: "https://..." }
   */
  mockups: Record<string, string>;

  /**
   * Áreas editables por lado
   */
  editableAreas: Record<string, EditableArea[]>;
};

export type ProductTemplate = {
  /**
   * ID único del template
   * ej: "tshirt", "hoodie"
   */
  id: string;

  /**
   * Nombre legible
   * ej: "Basic T-Shirt"
   */
  name: string;

  /**
   * Data estructural del template
   */
  data: ProductTemplateData;

  createdAt: string;
  updatedAt: string;
};

/* =========================
   INPUTS
========================= */

export type CreateTemplateInput = {
  id: string;
  name: string;
  data: ProductTemplateData;
};

export type UpdateTemplateInput = Partial<{
  name: string;
  data: ProductTemplateData;
}>;

/* =========================
   API CALLS
========================= */

/**
 * Obtener todos los templates
 */
export function getTemplates() {
  return adminFetch<ProductTemplate[]>("/templates");
}

/**
 * Obtener un template por ID
 */
export function getTemplate(id: string) {
  return adminFetch<ProductTemplate>(`/templates/${id}`);
}

/**
 * Crear un template
 */
export function createTemplate(data: CreateTemplateInput) {
  return adminFetch<{ id: string }>("/templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Actualizar un template
 */
export function updateTemplate(
  id: string,
  data: UpdateTemplateInput
) {
  return adminFetch<{ ok: true }>(`/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/**
 * Eliminar un template
 */
export function deleteTemplate(id: string) {
  return adminFetch<{ ok: true }>(`/templates/${id}`, {
    method: "DELETE",
  });
}