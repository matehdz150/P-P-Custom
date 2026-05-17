import {
  getCategories,
  getPackageCategories,
} from "@/lib/api/categories";
import { CategoriesTable } from "@/components/Admin/categorias/CategoriesTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CategoryFormDialog } from "@/components/Admin/categorias/CategoryFormDialog";

export default async function CategoriesAdminPage() {
  const [productCategories, packageCategories] = await Promise.all([
    getCategories(),
    getPackageCategories(),
  ]);

  return (
    <main className="px-6 py-10 space-y-12">
      {/* ================= PRODUCT CATEGORIES ================= */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Categorías de productos
            </h1>
            <p className="text-sm text-muted-foreground">
              Administra las categorías de productos
            </p>
          </div>

          <CategoryFormDialog
            defaultType="product"
            trigger={
              <Button className="flex items-center gap-2">
                <Plus size={18} />
                Nueva categoría
              </Button>
            }
          />
        </div>

        <CategoriesTable
          categories={productCategories}
          type="product"
        />
      </section>

      {/* ================= PACKAGE CATEGORIES ================= */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Categorías de paquetes
            </h2>
            <p className="text-sm text-muted-foreground">
              Administra las categorías de paquetes
            </p>
          </div>

          <CategoryFormDialog
            defaultType="package"
            trigger={
              <Button className="flex items-center gap-2">
                <Plus size={18} />
                Nueva categoría
              </Button>
            }
          />
        </div>

        <CategoriesTable
          categories={packageCategories}
          type="package"
        />
      </section>
    </main>
  );
}