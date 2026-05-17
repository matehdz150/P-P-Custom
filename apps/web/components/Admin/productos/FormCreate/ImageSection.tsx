"use client";

import { useState } from "react";
import Image from "next/image";
import { uploadImage } from "@/lib/api/uploads";
import type { ProductImage } from "@/lib/api/products";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  value: ProductImage[];
  onChange: (next: ProductImage[]) => void;
};

export function ImagesSection({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);

    const uploaded: ProductImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const res = await uploadImage(files[i]);
      uploaded.push({
        url: res.url,
        order: value.length + i,
      });
    }

    const next = [...value, ...uploaded].map((img, idx) => ({
      ...img,
      order: idx,
    }));

    onChange(next);
    setUploading(false);

    // reset input para poder re-subir el mismo archivo si quieres
    e.target.value = "";
  }

  function removeAt(index: number) {
    const next = value
      .filter((_, i) => i !== index)
      .map((img, idx) => ({ ...img, order: idx }));
    onChange(next);
  }

  function swap(i: number, j: number) {
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next.map((img, idx) => ({ ...img, order: idx })));
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold">Imágenes (mínimo 2)</h3>
        <div className="text-xs text-muted-foreground">
          {value.length} / 2+
        </div>
      </div>

      <input
        type="file"
        multiple
        accept="image/*"
        className="border p-2 w-full rounded mb-3"
        onChange={onFilesSelected}
      />

      {uploading && (
        <p className="text-sm text-muted-foreground mb-3">
          Subiendo imágenes…
        </p>
      )}

      {value.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {value
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((img, idx) => (
              <div key={img.url} className="border rounded p-2">
                <div className="relative w-full aspect-square rounded overflow-hidden bg-muted">
                  {/* Si no quieres configurar next/image aún, cambia a <img /> */}
                  <Image
                    src={img.url}
                    alt={`img-${idx}`}
                    fill
                    className="object-contain"
                  />
                </div>

                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="text-xs text-muted-foreground">
                    order: {idx}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={idx === 0}
                      onClick={() => swap(idx, idx - 1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={idx === value.length - 1}
                      onClick={() => swap(idx, idx + 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeAt(idx)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>

                {idx === 0 && (
                  <div className="mt-2 text-xs font-medium">
                    ✅ Principal (order 0)
                  </div>
                )}
                {idx === 1 && (
                  <div className="mt-2 text-xs font-medium">
                    🟦 Hover (order 1)
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {value.length > 0 && value.length < 2 && (
        <p className="text-sm text-red-600 mt-3">
          Te falta 1 imagen mínimo.
        </p>
      )}
    </Card>
  );
}