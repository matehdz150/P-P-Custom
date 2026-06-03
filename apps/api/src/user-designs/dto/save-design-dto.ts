export interface SaveDesignDto {
  id?: string; // Si se proporciona, actualiza ese diseño
  productId: string;
  name?: string;
  canvasData: Record<string, any>;
  snapshots?: Record<string, string>;
  status?: "draft" | "completed";
}
