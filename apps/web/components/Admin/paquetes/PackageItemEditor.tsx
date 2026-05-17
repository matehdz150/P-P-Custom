"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/api/products";

type Item = {
  product: Product;
  quantity: number;
};

type Props = {
  items: Item[];
  onChange: (next: Item[]) => void;
};

export function PackageItemsEditor({ items, onChange }: Props) {
  function updateQuantity(i: number, quantity: number) {
    const next = [...items];
    next[i] = { ...next[i], quantity };
    onChange(next);
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Productos del paquete</h3>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Agrega al menos un producto.
        </p>
      )}

      {items.map((item, i) => (
        <div
          key={item.product.id}
          className="grid grid-cols-[1fr_120px_auto] gap-2 items-center"
        >
          <div>
            <div className="text-sm font-medium">{item.product.name}</div>
            <div className="text-xs text-muted-foreground">
              {item.product.category}
            </div>
          </div>

          <Input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) =>
              updateQuantity(i, Number(e.target.value) || 1)
            }
          />

          <Button
            variant="destructive"
            size="sm"
            onClick={() => remove(i)}
          >
            Quitar
          </Button>
        </div>
      ))}
    </Card>
  );
}