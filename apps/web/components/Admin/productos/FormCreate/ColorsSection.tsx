"use client";

import { useMemo, useState } from "react";
import type { ProductColor } from "@/lib/api/products";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  value: ProductColor[];
  onChange: (next: ProductColor[]) => void;
};

function isValidHex(hex: string) {
  return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
}

export function ColorsSection({ value, onChange }: Props) {
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#000000");

  const hexValid = useMemo(() => isValidHex(hex), [hex]);

  const canAdd = useMemo(() => {
    return name.trim().length > 0 && hexValid;
  }, [name, hexValid]);

  function add() {
    if (!canAdd) return;

    const next: ProductColor[] = [
      ...value,
      { name: name.trim(), hex: hex.trim() },
    ];

    onChange(next);
    setName("");
    setHex("#000000");
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">Colores</h3>

      {/* INPUTS */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3 items-center">
        {/* Nombre */}
        <Input
          className="md:col-span-2"
          placeholder="Nombre (ej. Blanco)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Hex */}
        <Input
          className={`md:col-span-2 ${
            !hexValid && hex.length > 0
              ? "border-red-500 focus-visible:ring-red-500"
              : ""
          }`}
          placeholder="#FFFFFF"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
        />

        {/* Preview */}
        <div className="flex justify-center">
          <div
            className={`h-8 w-8 rounded-full border transition ${
              hexValid ? "" : "opacity-30"
            }`}
            style={{ backgroundColor: hexValid ? hex : "#000" }}
            title={hexValid ? hex : "HEX inválido"}
          />
        </div>

        <Button
          type="button"
          onClick={add}
          disabled={!canAdd}
        >
          Agregar
        </Button>
      </div>

      {!hexValid && hex.length > 0 && (
        <p className="text-xs text-red-600 mb-3">
          Hex inválido. Usa formato #RGB o #RRGGBB
        </p>
      )}

      {/* LISTA */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((c, i) => (
            <div
              key={`${c.name}-${i}`}
              className="flex items-center justify-between border rounded p-2"
            >
              <div className="flex items-center gap-3">
                {/* Preview grande */}
                <div
                  className="h-6 w-6 rounded-full border"
                  style={{ backgroundColor: c.hex ?? "#000" }}
                />

                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.hex}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => removeAt(i)}
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          (Opcional) Agrega colores si aplica.
        </p>
      )}
    </Card>
  );
}