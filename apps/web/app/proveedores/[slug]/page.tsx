"use client";

import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Header } from "@/components/Header/Header";
import { getPublicProvider, type PublicProvider } from "@/lib/api/providers";

export default function PublicProviderPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = use(params);
	const [data, setData] = useState<PublicProvider | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		getPublicProvider(slug)
			.then(setData)
			.catch(() => setNotFound(true))
			.finally(() => setLoading(false));
	}, [slug]);

	if (loading)
		return (
			<>
				<Header />
				<p className="p-10 text-center text-muted-foreground">
					Cargando…
				</p>
			</>
		);

	if (notFound || !data)
		return (
			<>
				<Header />
				<p className="p-10 text-center text-muted-foreground">
					Proveedor no encontrado.
				</p>
			</>
		);

	const { provider, products } = data;
	const name = provider.displayName || provider.name || "Proveedor";

	return (
		<>
			<Header />

			{/* BANNER */}
			<div className="relative w-full h-48 sm:h-60 bg-[#f5f5f3]">
				{provider.bannerUrl && (
					<Image
						src={provider.bannerUrl}
						alt="Portada"
						fill
						className="object-cover"
						priority
					/>
				)}
			</div>

			<div className="max-w-5xl mx-auto px-6">
				{/* HEADER PROVEEDOR */}
				<div className="flex items-end gap-5 -mt-12">
					<div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-white border-4 border-white shadow-sm shrink-0">
						{provider.avatarUrl ? (
							<Image
								src={provider.avatarUrl}
								alt={name}
								fill
								className="object-cover"
							/>
						) : (
							<div className="w-full h-full bg-[#1a1a17] flex items-center justify-center text-white text-2xl font-bold">
								{name.charAt(0)}
							</div>
						)}
					</div>
					<div className="pb-2">
						<h1 className="text-2xl font-bold">{name}</h1>
						<div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
							<Star size={15} className="text-gray-300" />
							<span>
								Sin reseñas todavía · {products.length} producto(s)
							</span>
						</div>
					</div>
				</div>

				{/* BIO */}
				{provider.bio && (
					<p className="mt-6 text-[#444] leading-relaxed max-w-2xl">
						{provider.bio}
					</p>
				)}

				{/* PRODUCTOS */}
				<h2 className="text-lg font-bold mt-10 mb-4">Productos</h2>
				{products.length === 0 ? (
					<div className="border border-dashed rounded-xl p-10 text-center text-muted-foreground">
						Este proveedor aún no tiene productos publicados.
					</div>
				) : (
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-16">
						{products.map((p) => (
							<Link
								key={p.id}
								href={`/product/${p.id}`}
								className="border rounded-xl overflow-hidden bg-white hover:shadow-md transition"
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
								<div className="p-3">
									<p className="text-sm font-medium truncate">
										{p.name}
									</p>
									<p className="text-sm text-muted-foreground">
										{p.pricing
											? `$${p.pricing.basePrice}`
											: ""}
									</p>
								</div>
							</Link>
						))}
					</div>
				)}
			</div>
		</>
	);
}
