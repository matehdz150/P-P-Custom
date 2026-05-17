"use client";

import { useEffect, useMemo, useState } from "react";
import { getProducts, deleteProduct, type Product } from "@/lib/api/products";
import { ProductsHeader } from "@/components/Admin/productos/ProductsHeader";
import { ProductsTable } from "@/components/Admin/productos/ProductsTable";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setProducts(await getProducts());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase();

    return products.filter((p) =>
      [
        p.name,
        p.sku,
        p.internalName,
        p.brand,
        p.category,
      ]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [products, search]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar producto?")) return;
    await deleteProduct(id);
    load();
  }

  return (
    <div className="space-y-6">
      <ProductsHeader
        search={search}
        onSearchChange={setSearch}
      />

      <ProductsTable
        products={filteredProducts}
        loading={loading}
        onDelete={handleDelete}
      />
    </div>
  );
}