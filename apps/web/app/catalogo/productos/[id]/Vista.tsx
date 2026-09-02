"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Sora } from "next/font/google";

import { useSearch } from "@/Contexts/SearchContext";
import SearchResults from "@/components/Catalogo/SearchResults";
import { getCatalogo, type ProductoDeCatalogo } from "@/lib/api/catalogo";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export default function VistaPorCategoria() {
  const { id } = useParams<{ id: string }>();
  const { query } = useSearch();

  const [products, setProducts] = useState<ProductoDeCatalogo[]>([]);
  const [loading, setLoading] = useState(true);

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    if (!id) return;

    async function load() {
      setLoading(true);
      try {
        // El catálogo llega entero y la categoría se aplica aquí: son
        // decenas de productos, y una ruta por categoría obligaría a un
        // índice más en DynamoDB para no ganar nada.
        const todos = await getCatalogo().catch(() => []);
        setProducts(todos.filter((p) => p.categoryIds?.includes(id)));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  /* ================= SEARCH ================= */

  if (isSearching) {
    return <SearchResults query={query} />;
  }

  /* ================= UI ================= */

  return (
    <main className={`px-6 py-10 ${sora.className}`}>

      {/* LOADING */}
      {loading && <ProductsGridSkeleton />}

      {/* EMPTY */}
      {!loading && products.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay productos en esta categoría.
        </p>
      )}

      {/* GRID */}
      {!loading && products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </main>
  );
}

/* =========================
   PRODUCT CARD (HOVER IMAGE)
========================= */

function ProductCard({ product }: { product: ProductoDeCatalogo }) {
  const [hover, setHover] = useState(false);

  const firstImage = product.images?.[0]?.url;
  const secondImage = product.images?.[1]?.url;

  return (
    <Link href={`/product/${product.id}`} className="block">
      <article
        className="
          bg-white
          border
          rounded-[0.25rem]
          overflow-hidden
          cursor-pointer
          transition-shadow
          hover:shadow-md
        "
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* IMAGE */}
        <div className="relative w-full aspect-[4/5] bg-[#f5f5f1]">
          {firstImage ? (
            <Image
              src={hover && secondImage ? secondImage : firstImage}
              alt={product.name}
              fill
              className="object-contain transition-opacity duration-200"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
              Sin imagen
            </div>
          )}
        </div>

        {/* INFO */}
        <div className="p-3 space-y-1">
          <h3 className="text-sm font-semibold leading-snug">
            {product.name}
          </h3>

          {product.basePrice != null && (
            <p className="text-sm font-semibold">
              Desde ${product.basePrice.toLocaleString()}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}

/* =========================
   SKELETON
========================= */

function ProductsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          className="bg-white border rounded-[0.25rem] overflow-hidden"
        >
          <Skeleton className="w-full aspect-[4/5]" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}