"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import Link from "next/link";

type Props = {
  productId: string;
  onDelete: (id: string) => void;
};

export function ProductActions({ productId, onDelete }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/admin/productos/${productId}`}>
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-red-600"
          onClick={() => onDelete(productId)}
        >
          <Trash className="w-4 h-4 mr-2" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}