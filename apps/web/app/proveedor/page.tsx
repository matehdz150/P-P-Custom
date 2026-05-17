"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getMyProducts, type ProviderProduct } from "@/lib/api/providers";

export default function ProviderProductsPage() {
	const [products, setProducts] = useState<ProviderProduct[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		getMyProducts()
			.then(setProducts)
			.finally(() => setLoading(false));
	}, []);

	return (
		<div className="max-w-5xl space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Mis productos</h1>
					<p className="text-sm text-muted-foreground">
						Productos que has subido al catálogo.
					</p>
				</div>
				<Link href="/proveedor/productos/nuevo">
					<Button className="bg-[#fe6241] text-black hover:bg-[#e5573a]">
						Nuevo producto
					</Button>
				</Link>
			</div>

			{loading ? (
				<p className="text-sm text-muted-foreground">Cargando…</p>
			) : products.length === 0 ? (
				<div className="border border-dashed rounded-lg p-10 text-center text-muted-foreground">
					Aún no has subido productos.
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{products.map((p) => (
						<div
							key={p.id}
							className="border rounded-xl overflow-hidden bg-background"
						>
							<div className="relative aspect-square bg-[#f5f5f3]">
								{p.images?.[0]?.url && (
									<Image
										src={p.images[0].url}
										alt={p.name}
										fill
										className="object-contain p-4"
									/>
								)}
							</div>
							<div className="p-4">
								<p className="font-medium truncate">{p.name}</p>
								<div className="flex items-center justify-between mt-1">
									<span className="text-sm text-muted-foreground">
										{p.pricing
											? `$${p.pricing.basePrice}`
											: "Sin precio"}
									</span>
									<span className="text-xs px-2 py-0.5 rounded-full bg-muted">
										{p.status}
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
