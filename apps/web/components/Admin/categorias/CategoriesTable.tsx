"use client";

import { Category } from "@/lib/api/categories";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash, Pencil } from "lucide-react";
import {
  deleteCategory,
  deletePackageCategory,
} from "@/lib/api/categories";
import { CategoryFormDialog } from "./CategoryFormDialog";
import Image from "next/image";

type CategoryType = "product" | "package";

type Props = {
  categories: Category[];
  type: CategoryType;
};

export function CategoriesTable({ categories, type }: Props) {
  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta categoría?")) return;

    if (type === "product") {
      await deleteCategory(id);
    }

    if (type === "package") {
      await deletePackageCategory(id);
    }

    window.location.reload();
  }

  return (
    <div className="border rounded-md bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            {type === "product" && <TableHead>Imagen</TableHead>}
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {categories.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={type === "product" ? 4 : 3}
                className="text-center text-sm text-muted-foreground py-8"
              >
                No hay categorías registradas.
              </TableCell>
            </TableRow>
          )}

          {categories.map((cat) => (
            <TableRow key={cat.id}>
              {/* IMAGE ONLY FOR PRODUCT CATEGORIES */}
              {type === "product" && (
                <TableCell>
                  <div className="w-12 h-12 relative rounded-md overflow-hidden bg-muted border">
                    {cat.image ? (
                      <Image
                        src={cat.image}
                        alt={cat.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        —
                      </div>
                    )}
                  </div>
                </TableCell>
              )}

              <TableCell className="font-semibold">
                {cat.name}
              </TableCell>

              <TableCell className="text-sm text-muted-foreground">
                {cat.description ?? "—"}
              </TableCell>

              <TableCell className="text-right space-x-2">
                <CategoryFormDialog
                  category={cat}
                  defaultType={type}
                  trigger={
                    <Button size="icon" variant="outline">
                      <Pencil size={16} />
                    </Button>
                  }
                />

                <Button
                  size="icon"
                  variant="destructive"
                  onClick={() => handleDelete(cat.id)}
                >
                  <Trash size={16} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}