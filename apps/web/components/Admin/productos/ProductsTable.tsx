"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/api/products";
import { ProductActions } from "./ProductsAction";

type Props = {
  products: Product[];
  loading: boolean;
  onDelete: (id: string) => void;
};

export function ProductsTable({
  products,
  loading,
  onDelete,
}: Props) {
  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">
        Cargando productos…
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No hay productos
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Precio</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {products.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">
              {p.name}
            </TableCell>

            <TableCell>{p.sku}</TableCell>

            <TableCell>
              {p.category ?? "—"}
            </TableCell>

            <TableCell>
              {p.pricing?.basePrice
                ? `$${p.pricing.basePrice}`
                : "—"}
            </TableCell>

            <TableCell>
              <Badge
                variant={
                  p.status === "active"
                    ? "default"
                    : p.status === "draft"
                    ? "secondary"
                    : "outline"
                }
              >
                {p.status}
              </Badge>
            </TableCell>

            <TableCell>
              <ProductActions
                productId={p.id}
                onDelete={onDelete}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}