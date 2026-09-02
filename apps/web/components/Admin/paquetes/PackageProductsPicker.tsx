"use client";

import { useEffect, useState } from "react";
import { getProducts, type Product } from "@/lib/api/products";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
	selectedIds: string[];
	onAdd: (product: Product) => void;
};

export function PackageProductsPicker({ selectedIds, onAdd }: Props) {
	const [products, setProducts] = useState<Product[]>([]);

	useEffect(() => {
		getProducts().then(setProducts);
	}, []);

	return (
		<Card className="p-4 space-y-3">
			<h3 className="font-semibold">Productos disponibles</h3>

			<div className="space-y-2 max-h-[260px] overflow-auto">
				{products.map((p) => {
					const disabled = selectedIds.includes(p.id);

					return (
						<div
							key={p.id}
							className="flex items-center justify-between border rounded p-2"
						>
							<div>
								<div className="text-sm font-medium">{p.name}</div>
								<div className="text-xs text-muted-foreground">
									{p.category ?? "—"}
								</div>
							</div>

							<Button
								size="sm"
								variant="outline"
								disabled={disabled}
								onClick={() => onAdd(p)}
							>
								{disabled ? "Agregado" : "Agregar"}
							</Button>
						</div>
					);
				})}
			</div>
		</Card>
	);
}
