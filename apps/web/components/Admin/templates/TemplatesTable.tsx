"use client";

import { Button } from "@/components/ui/button";

import type { ProductTemplate } from "@/lib/api/templates";

type Props = {
  templates: ProductTemplate[];
  onDelete: (id: string) => void;
  onEdit: (tpl: ProductTemplate) => void;
};

export function TemplatesTable({ templates, onDelete, onEdit }: Props) {
  if (templates.length === 0) {
    return (
      <div className="border border-dashed rounded p-8 text-center text-muted-foreground">
        No hay templates creados
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((tpl) => (
        <div
          key={tpl.id}
          className="p-4 flex items-center justify-between gap-4 border rounded-[0.2rem] bg-[#f5f5f1]"
        >
          <div>
            <div className="font-medium">{tpl.name}</div>
            <div className="text-sm text-muted-foreground">
              ID: {tpl.id} · Lados:{" "}
              {tpl.data.sides.join(", ")}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onEdit(tpl)}>
              Editar
            </Button>

            <Button
              variant="default"
              onClick={() => onDelete(tpl.id)}
            >
              Eliminar
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}