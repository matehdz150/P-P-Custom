"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import Link from "next/link";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
};

export function ProductsHeader({ search, onSearchChange }: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Productos</h1>
        <p className="text-sm text-muted-foreground">
          Administra tu catálogo
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Buscar por nombre, SKU, marca…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-[260px]"
        />

        <Button asChild>
          <Link href="/admin/productos/nuevo">
            <Plus className="w-4 h-4 mr-2" />
            Agregar producto
          </Link>
        </Button>
      </div>
    </div>
  );
}