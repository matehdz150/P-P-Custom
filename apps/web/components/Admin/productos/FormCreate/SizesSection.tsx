"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type ProductSize = {
  size: string;
  widthIn: number;
  lengthIn: number;
};

type Props = {
  value: ProductSize[];
  onChange: (next: ProductSize[]) => void;
};

const PRESET_SIZES = ["XS", "S", "M", "L", "XL", "2XL"];

export function SizesSection({ value, onChange }: Props) {
  const [size, setSize] = useState("");
  const [widthIn, setWidthIn] = useState<number | "">("");
  const [lengthIn, setLengthIn] = useState<number | "">("");

  const canAdd =
    size.trim() &&
    widthIn !== "" &&
    lengthIn !== "" &&
    !value.find((s) => s.size === size);

  function add() {
    if (!canAdd) return;

    onChange([
      ...value,
      {
        size: size.trim(),
        widthIn: Number(widthIn),
        lengthIn: Number(lengthIn),
      },
    ]);

    setSize("");
    setWidthIn("");
    setLengthIn("");
  }

  function remove(sizeKey: string) {
    onChange(value.filter((s) => s.size !== sizeKey));
  }

  function update(
    sizeKey: string,
    field: "widthIn" | "lengthIn",
    val: number
  ) {
    onChange(
      value.map((s) =>
        s.size === sizeKey ? { ...s, [field]: val } : s
      )
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <h3 className="font-semibold">Tallas y medidas</h3>

      {/* ADD SIZE */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <Input
          placeholder="Talla (ej. M)"
          list="sizes"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />

        <Input
          type="number"
          min={0}
          step="0.1"
          placeholder="Ancho (in)"
          value={widthIn}
          onChange={(e) =>
            setWidthIn(e.target.value === "" ? "" : Number(e.target.value))
          }
        />

        <Input
          type="number"
          min={0}
          step="0.1"
          placeholder="Largo (in)"
          value={lengthIn}
          onChange={(e) =>
            setLengthIn(e.target.value === "" ? "" : Number(e.target.value))
          }
        />

        <Button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="md:col-span-2"
        >
          Agregar talla
        </Button>

        <datalist id="sizes">
          {PRESET_SIZES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {/* LIST */}
      {value.length > 0 ? (
        <div className="space-y-2">
          {value.map((s) => (
            <div
              key={s.size}
              className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center border rounded p-2"
            >
              <div className="font-medium">{s.size}</div>

              <Input
                type="number"
                min={0}
                step="0.1"
                value={s.widthIn}
                onChange={(e) =>
                  update(s.size, "widthIn", Number(e.target.value))
                }
              />

              <Input
                type="number"
                min={0}
                step="0.1"
                value={s.lengthIn}
                onChange={(e) =>
                  update(s.size, "lengthIn", Number(e.target.value))
                }
              />

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => remove(s.size)}
                className="md:col-span-2"
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Agrega al menos una talla con sus medidas.
        </p>
      )}
    </Card>
  );
}