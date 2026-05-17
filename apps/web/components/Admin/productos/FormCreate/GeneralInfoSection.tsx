"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoriesSelector } from "./CategorySelector";

export type ProductStatus = "draft" | "active" | "archived";

export type GeneralInfo = {
  slug: string;
  name: string;
  internalName: string;
  sku: string;
  description?: string;
  brand?: string;
  categoryIds?: string[];
  status: ProductStatus;
};

type Props = {
  value: GeneralInfo;
  onChange: <K extends keyof GeneralInfo>(
    key: K,
    value: GeneralInfo[K]
  ) => void;
};

export function GeneralInfoSection({ value, onChange }: Props) {
  return (
    <section className="border p-4 rounded space-y-3">
      <h3 className="font-semibold mb-3">Información general</h3>

      {/* STATUS */}
      <div>
        <label className="text-sm font-medium">Estado del producto</label>
        <Select
          value={value.status}
          onValueChange={(v) => onChange("status", v as ProductStatus)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft (borrador)</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="archived">Archivado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Input
        placeholder="Slug (ej: unisex-tshirt-blanca)"
        value={value.slug}
        onChange={(e) => onChange("slug", e.target.value)}
      />

      <Input
        placeholder="Nombre"
        value={value.name}
        onChange={(e) => onChange("name", e.target.value)}
      />

      <Input
        placeholder="Internal name"
        value={value.internalName}
        onChange={(e) => onChange("internalName", e.target.value)}
      />

      <Input
        placeholder="SKU"
        value={value.sku}
        onChange={(e) => onChange("sku", e.target.value)}
      />

      <Textarea
        placeholder="Descripción"
        value={value.description ?? ""}
        onChange={(e) => onChange("description", e.target.value)}
      />

      <Input
        placeholder="Marca"
        value={value.brand ?? ""}
        onChange={(e) => onChange("brand", e.target.value)}
      />

      <CategoriesSelector
        selected={value.categoryIds ?? []}
        onChange={(ids) => onChange("categoryIds", ids)}
      />
    </section>
  );
}
