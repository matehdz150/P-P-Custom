"use client";

import { MoreHorizontal, Package, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useProviderAuth } from "@/Contexts/ProviderAuthContext";
import { getMyProducts, type ProviderProduct } from "@/lib/api/providers";

const STATUS_LABEL: Record<string, string> = {
	active: "Activo",
	draft: "Borrador",
	archived: "Archivado",
};

const STATUS_COLOR: Record<string, string> = {
	active: "bg-emerald-50 text-emerald-700",
	draft: "bg-amber-50 text-amber-700",
	archived: "bg-[#f3f3f1] text-[#888]",
};

export default function ProviderProductsPage() {
	const { provider } = useProviderAuth();
	const [products, setProducts] = useState<ProviderProduct[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		getMyProducts()
			.then(setProducts)
			.finally(() => setLoading(false));
	}, []);

	const ownerName = provider?.displayName || provider?.name || "Proveedor";

	return (
		<div className="min-h-screen bg-white px-6 py-6 sm:px-8">
			{/* Page header */}
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-[22px] font-bold text-[#1a1a1a]">Mis productos</h1>
					{!loading && (
						<p className="mt-0.5 text-[13px] text-[#888]">
							{products.length === 0
								? "Aún no tienes productos"
								: `${products.length} producto${products.length !== 1 ? "s" : ""}`}
						</p>
					)}
				</div>
				<Link
					href="/proveedor/productos/nuevo"
					className="flex items-center gap-1.5 rounded-md bg-[#1a1a1a] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#333] transition-colors"
				>
					<Plus className="h-3.5 w-3.5" />
					Nuevo producto
				</Link>
			</div>

			{/* Loading */}
			{loading && (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{Array.from({ length: 8 }).map((_, i) => (
						<div key={i} className="animate-pulse space-y-2">
							<div className="aspect-square rounded-xl bg-[#f3f3f1]" />
							<div className="h-3.5 w-3/4 rounded bg-[#f3f3f1]" />
							<div className="h-3 w-1/2 rounded bg-[#f3f3f1]" />
						</div>
					))}
				</div>
			)}

			{/* Empty state */}
			{!loading && products.length === 0 && (
				<div className="flex flex-col items-center justify-center py-24 text-center">
					<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3f3f1]">
						<Package className="h-7 w-7 text-[#bbb]" />
					</div>
					<p className="mt-4 text-[15px] font-semibold text-[#1a1a1a]">Todavía no tienes productos</p>
					<p className="mt-1.5 max-w-xs text-[13px] text-[#888]">
						Crea tu primer producto para empezar a armar tu catálogo.
					</p>
					<Link
						href="/proveedor/productos/nuevo"
						className="mt-5 flex items-center gap-1.5 rounded-md bg-[#1a1a1a] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#333] transition-colors"
					>
						<Plus className="h-3.5 w-3.5" />
						Crear primer producto
					</Link>
				</div>
			)}

			{/* Products grid */}
			{!loading && products.length > 0 && (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{products.map((product) => (
						<ProductCard
							key={product.id}
							product={product}
							ownerName={ownerName}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function ProductCard({
	product,
	ownerName,
}: {
	product: ProviderProduct;
	ownerName: string;
}) {
	const img = product.images?.[0]?.url;
	const status = product.status ?? "draft";

	return (
		<article className="group relative">
			{/* Image */}
			<div className="relative aspect-square overflow-hidden rounded-xl bg-[#f5f5f3]">
				{img ? (
					<Image
						src={img}
						alt={product.name}
						fill
						className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
						sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
					/>
				) : (
					<div className="flex h-full items-center justify-center">
						<Package className="h-8 w-8 text-[#ccc]" />
					</div>
				)}

				{/* Status badge */}
				<span
					className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_COLOR[status] ?? STATUS_COLOR.draft}`}
				>
					{STATUS_LABEL[status] ?? status}
				</span>

				{/* Options button */}
				<button
					type="button"
					className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
				>
					<MoreHorizontal className="h-4 w-4 text-[#555]" />
				</button>
			</div>

			{/* Info */}
			<div className="mt-2.5 px-0.5">
				<p className="truncate text-[13px] font-semibold text-[#1a1a1a]">{product.name}</p>
				<div className="mt-0.5 flex items-center justify-between">
					<p className="text-[12px] text-[#888]">{ownerName}</p>
					<p className="text-[12px] font-semibold text-[#1a1a1a]">
						{product.pricing ? `$${product.pricing.basePrice}` : "—"}
					</p>
				</div>
			</div>
		</article>
	);
}
