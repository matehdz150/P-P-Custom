"use client";


import { useEffect, useState } from "react";
import { useSearch } from "@/Contexts/SearchContext";
import PackagesSection from "@/components/Catalogo/PackageSection";
import ProductGrid from "@/components/Catalogo/ProductGrid";
import SearchResults from "@/components/Catalogo/SearchResults";
import { getPackageCategories } from "@/lib/api/categories";


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

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    async function loadCategories() {
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
    }

    loadCategories();
  }, []);

  return (
    <div className="min-h-screen">
      {isSearching ? (
        <SearchResults query={query} />
      ) : (
        <>
        

          <ProductGrid />

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
