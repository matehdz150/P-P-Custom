"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearch } from "@/Contexts/SearchContext";
import PackagesSection from "@/components/Catalogo/PackageSection";
import ProductGrid from "@/components/Catalogo/ProductGrid";
import SearchResults from "@/components/Catalogo/SearchResults";
import { getPackageCategories } from "@/lib/api/categories";
import { getCatalogProducts, type CatalogProduct } from "@/lib/api/products";
import { Skeleton } from "@/components/ui/skeleton";

type PackageCategory = {
  id: string;
  name: string;
};

type CategoryMap = {
  eventos?: string;
  empresariales?: string;
};

export default function Page() {
  const { query } = useSearch();
  const [categoryIds, setCategoryIds] = useState<CategoryMap>({});
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    async function loadCategories() {
      try {
        const categories: PackageCategory[] = await getPackageCategories();
        const map: CategoryMap = {};

        for (const cat of categories) {
          const name = cat.name.toLowerCase();

          if (name === "eventos") {
            map.eventos = cat.id;
          }

          if (
            name === "empresarial" ||
            name === "empresariales" ||
            name === "empresas"
          ) {
            map.empresariales = cat.id;
          }
        }
        setCategoryIds(map);
      } catch (err) {
        console.error("Error loading categories:", err);
      }
    }

    async function loadProducts() {
      try {
        const data = await getCatalogProducts();
        setProducts(data ?? []);
      } catch (err) {
        console.error("Error loading catalog products:", err);
      } finally {
        setProductsLoading(false);
      }
    }

    loadCategories();
    loadProducts();
  }, []);

  return (
    <div className="min-h-screen">
      {isSearching ? (
        <SearchResults query={query} />
      ) : (
        <>
          <ProductGrid />

          {/* PRODUCTOS PERSONALIZABLES */}
          <div className="mt-12 mb-10">
            <h2 className="text-xl md:text-2xl font-bold mb-6 text-neutral-900">
              Productos Personalizables
            </h2>

            {productsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
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
            ) : products.length === 0 ? (
              <p className="text-sm text-neutral-500">
                No hay productos disponibles en este momento.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>

          {/* EVENTOS */}
          {categoryIds.eventos && (
            <PackagesSection
              title="Paquetes para eventos"
              description="Combos pensados para graduaciones, bodas y eventos especiales."
              href="/catalogo/eventos"
              categoryName="eventos"
              limit={4}
            />
          )}

          {/* EMPRESARIALES */}
          {categoryIds.empresariales && (
            <PackagesSection
              title="Paquetes empresariales"
              description="Soluciones personalizadas para equipos, oficinas y marcas."
              href="/catalogo/empresariales"
              categoryName="empresariales"
              limit={4}
            />
          )}
        </>
      )}
    </div>
  );
}

/* =========================
   PRODUCT CARD (HOVER IMAGE)
========================= */
function ProductCard({ product }: { product: CatalogProduct }) {
  const [hover, setHover] = useState(false);

  const firstImage = product.images?.[0]?.url;
  const secondImage = product.images?.[1]?.url;
  const basePrice = product.pricing?.basePrice;

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
          <h3 className="text-sm font-semibold leading-snug text-neutral-900">
            {product.name}
          </h3>

          {basePrice != null ? (
            <p className="text-sm font-semibold text-neutral-900">
              Desde ${basePrice.toLocaleString()}
            </p>
          ) : (
            <p className="text-sm text-gray-400">Consultar precio</p>
          )}
        </div>
      </article>
    </Link>
  );
}
