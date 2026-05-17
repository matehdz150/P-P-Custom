"use client";

import { useEffect, useState } from "react";
import { Sora } from "next/font/google";
import Image from "next/image";
import { getPackageCategoryWithPackagesByName } from "@/lib/api/categories";
import { useSearch } from "@/Contexts/SearchContext";
import SearchResults from "@/components/Catalogo/SearchResults";
import ProductGrid from "@/components/Catalogo/ProductGrid";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

type PackageItem = {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  basePrice: number;
};

export default function EmpresarialCatalogPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { query } = useSearch();

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const category =
          await getPackageCategoryWithPackagesByName("empresariales");

        setPackages(
          (category.packages ?? []).map((pkg) => ({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            image: pkg.image,
            basePrice: pkg.basePrice,
          }))
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="min-h-screen">
      {isSearching ? (
        <SearchResults query={query} />
      ) : (
        <main className={` py-7  ${sora.className}`}>

          {/* LOADING */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-[0.2rem] border overflow-hidden animate-pulse"
                >
                  <div className="w-full aspect-[4/3] bg-muted" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-muted w-3/4" />
                    <div className="h-3 bg-muted w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* EMPTY */}
          {!loading && packages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay paquetes de eventos disponibles por ahora.
            </p>
          )}

          {/* GRID */}
          {!loading && packages.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-5">
              {packages.map((pkg) => (
                <article
                  key={pkg.id}
                  className="bg-white rounded-[0.2rem] border hover:shadow-md transition-shadow cursor-pointer"
                >
                  {/* IMAGE */}
                  <div className="relative w-full aspect-[4/3] bg-[#f5f5f1] overflow-hidden">
                    {pkg.image ? (
                      <Image
                        src={pkg.image}
                        alt={pkg.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        Sin imagen
                      </div>
                    )}
                  </div>

                  {/* INFO */}
                  <div className="p-4 space-y-1">
                    <h3 className="text-sm font-semibold leading-snug">
                      {pkg.name}
                    </h3>

                    {pkg.description && (
                      <p className="text-xs text-muted-foreground">
                        {pkg.description}
                      </p>
                    )}

                    <p className="text-sm font-semibold mt-2">
                      Desde ${pkg.basePrice.toLocaleString()}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );
}