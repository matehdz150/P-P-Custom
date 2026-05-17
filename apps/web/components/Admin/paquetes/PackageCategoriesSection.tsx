"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { getPackageCategories } from "@/lib/api/categories";

type PackageCategory = {
  id: string;
  name: string;
  description?: string | null;
};

type Props = {
  value: string[]; // ids seleccionados
  onChange: (next: string[]) => void;
};

export function PackageCategoriesSection({ value, onChange }: Props) {
  const [categories, setCategories] = useState<PackageCategory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getPackageCategories()
      .then(setCategories)
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold">Categorías del paquete</h3>

      {loading && (
        <p className="text-sm text-muted-foreground">
          Cargando categorías…
        </p>
      )}

      {!loading && categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay categorías de paquetes creadas.
        </p>
      )}

      {!loading && categories.length > 0 && (
        <div className="space-y-2">
          {categories.map((cat) => (
            <label
              key={cat.id}
              className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted"
            >
              <Checkbox
                checked={value.includes(cat.id)}
                onCheckedChange={() => toggle(cat.id)}
              />
              <div>
                <p className="text-sm font-medium">{cat.name}</p>
                {cat.description && (
                  <p className="text-xs text-muted-foreground">
                    {cat.description}
                  </p>
                )}
              </div>
            </label>
          ))}
        </div>
      )}
    </Card>
  );
}