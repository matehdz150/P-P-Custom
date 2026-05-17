"use client";

import { ProductForm } from "@/components/Admin/productos/ProductForm";

export default function Page() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Nuevo producto</h1>
        <p className="text-sm text-muted-foreground">
          Crea un producto para el catálogo
        </p>
      </div>

      <ProductForm />
    </div>
  );
}