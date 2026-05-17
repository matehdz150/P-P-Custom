"use client";

import { useEffect, useState } from "react";
import type { ProductProduction } from "@/lib/api/products";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProductionMeta = {
  material?: string;
  country?: string;
  notes?: string;
};

type Props = {
  value?: ProductProduction;
  onChange: (next?: ProductProduction) => void;
};

export function ProductionSection({ value, onChange }: Props) {
  const [provider, setProvider] = useState("");
  const [providerSku, setProviderSku] = useState("");

  const [material, setMaterial] = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");

  /* =========================
     LOAD EXISTING VALUE
  ========================= */
  useEffect(() => {
    setProvider(value?.provider ?? "");
    setProviderSku(value?.providerSku ?? "");

    setMaterial(value?.meta?.material ?? "");
    setCountry(value?.meta?.country ?? "");
    setNotes(value?.meta?.notes ?? "");
  }, [value]);

  /* =========================
     BUILD + EMIT
  ========================= */
  function commit(
    nextProvider = provider,
    nextSku = providerSku,
    nextMaterial = material,
    nextCountry = country,
    nextNotes = notes
  ) {
    const hasAny =
      nextProvider.trim() ||
      nextSku.trim() ||
      nextMaterial.trim() ||
      nextCountry.trim() ||
      nextNotes.trim();

    if (!hasAny) {
      onChange(undefined);
      return;
    }

    const meta: ProductionMeta = {};
    if (nextMaterial.trim()) meta.material = nextMaterial.trim();
    if (nextCountry.trim()) meta.country = nextCountry.trim();
    if (nextNotes.trim()) meta.notes = nextNotes.trim();

    onChange({
      provider: nextProvider.trim(),
      providerSku: nextSku.trim() || undefined,
      meta: Object.keys(meta).length ? meta : undefined,
    });
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Producción / Proveedor</h3>

      {/* PROVEEDOR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        <Input
          placeholder="Proveedor (ej. Printful)"
          value={provider}
          onChange={(e) => {
            const v = e.target.value;
            setProvider(v);
            commit(v);
          }}
        />

        <Input
          placeholder="SKU proveedor (opcional)"
          value={providerSku}
          onChange={(e) => {
            const v = e.target.value;
            setProviderSku(v);
            commit(undefined, v);
          }}
        />
      </div>

      {/* META */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        <Input
          placeholder="Material (ej. Algodón)"
          value={material}
          onChange={(e) => {
            const v = e.target.value;
            setMaterial(v);
            commit(undefined, undefined, v);
          }}
        />

        <Input
          placeholder="País de producción (ej. México)"
          value={country}
          onChange={(e) => {
            const v = e.target.value;
            setCountry(v);
            commit(undefined, undefined, undefined, v);
          }}
        />
      </div>

      <Textarea
        placeholder="Notas internas de producción (opcional)"
        value={notes}
        onChange={(e) => {
          const v = e.target.value;
          setNotes(v);
          commit(undefined, undefined, undefined, undefined, v);
        }}
        className="min-h-[100px]"
      />

      <p className="text-xs text-muted-foreground mt-3">
        Esta información es solo para uso interno y logística.
      </p>
    </Card>
  );
}