"use client";

import { Package, Sparkles, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/api/products";
import { ProductDecorationSelector } from "./ProductDecorationSelector";

type Decoration = "dtg" | "embroidery";

type Props = {
	product: Product;
	onStartDesign: () => void;
};

function formatMXN(value: number) {
	return new Intl.NumberFormat("es-MX", {
		style: "currency",
		currency: "MXN",
		maximumFractionDigits: 0,
	}).format(value);
}

export function ProductInfo({ product, onStartDesign }: Props) {
	const [decoration, setDecoration] = useState<Decoration>("dtg");
	const [color, setColor] = useState<string | null>(
		product.colors?.[0]?.name ?? null,
	);
	const [size, setSize] = useState<string | null>(
		product.sizes?.[0]?.size ?? null,
	);

	const base = product.pricing?.basePrice ?? 0;
	const extra =
		decoration === "embroidery"
			? (product.pricing?.embroideryExtra ?? 0)
			: 0;
	const price = base + extra;
	const linkedProvider = product.provider ?? null;
	const provider =
		linkedProvider?.displayName ||
		linkedProvider?.name ||
		product.production?.provider ||
		"P&P Custom";
	const providerSlug = linkedProvider?.slug ?? null;

	const brandChip = (
		<>
			<div className="w-8 h-8 rounded-lg bg-[#1a1a17] flex items-center justify-center overflow-hidden">
				{linkedProvider?.avatarUrl ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={linkedProvider.avatarUrl}
						alt={provider}
						className="w-full h-full object-cover"
					/>
				) : (
					<span className="text-white text-xs font-bold">
						{provider.charAt(0)}
					</span>
				)}
			</div>
			<span className="text-sm font-medium text-gray-600 group-hover:text-[#fe6241] transition-colors">
				{provider}
			</span>
		</>
	);

	return (
		<div className="flex flex-col gap-6">
			{/* BRAND CHIP */}
			<div className="flex items-center gap-2">
				{providerSlug ? (
					<Link
						href={`/proveedores/${providerSlug}`}
						className="group flex items-center gap-2"
					>
						{brandChip}
					</Link>
				) : (
					<div className="flex items-center gap-2">{brandChip}</div>
				)}
				{product.isCustomizable && (
					<span className="ml-auto flex items-center gap-1 text-xs font-semibold text-[#fe6241] bg-[#fe6241]/10 px-2.5 py-1 rounded-full">
						<Sparkles size={13} />
						Personalizable
					</span>
				)}
			</div>

			{/* TITLE + CATEGORY */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight text-[#1a1a17]">
					{product.name}
				</h1>
				{product.category && (
					<p className="text-sm text-gray-500 mt-1">
						{product.category}
					</p>
				)}
			</div>

			{/* PRICE */}
			<div>
				<div className="flex items-baseline gap-2">
					<span className="text-3xl font-bold text-[#1a1a17]">
						{formatMXN(price)}
					</span>
					<span className="text-sm text-gray-400">desde</span>
				</div>
				<p className="flex items-center gap-1.5 text-sm text-gray-500 mt-2">
					<Truck size={16} />
					Envío calculado al finalizar la compra
				</p>
			</div>

			<div className="h-px bg-gray-100" />

			{/* DECORATION */}
			<ProductDecorationSelector
				value={decoration}
				onChange={setDecoration}
			/>

			{/* COLOR */}
			{product.colors && product.colors.length > 0 && (
				<div className="flex flex-col gap-2">
					<span className="text-sm font-semibold text-[#1a1a17]">
						Color: <span className="text-gray-500 font-normal">{color}</span>
					</span>
					<div className="flex gap-2 flex-wrap">
						{product.colors.map((c) => (
							<button
								key={c.name}
								type="button"
								title={c.name}
								onClick={() => setColor(c.name)}
								className={`w-9 h-9 rounded-full border transition ${
									color === c.name
										? "ring-2 ring-[#fe6241] ring-offset-2 border-transparent"
										: "border-gray-300 hover:scale-105"
								}`}
								style={{ backgroundColor: c.hex }}
							/>
						))}
					</div>
				</div>
			)}

			{/* SIZE */}
			{product.sizes && product.sizes.length > 0 && (
				<div className="flex flex-col gap-2">
					<span className="text-sm font-semibold text-[#1a1a17]">
						Talla
					</span>
					<div className="flex gap-2 flex-wrap">
						{product.sizes.map((s) => (
							<button
								key={s.size}
								type="button"
								onClick={() => setSize(s.size)}
								className={`min-w-[3rem] px-3 py-2 rounded-lg border text-sm font-medium transition ${
									size === s.size
										? "border-[#fe6241] bg-[#fe6241]/5 text-[#1a1a17]"
										: "border-gray-200 text-gray-600 hover:border-gray-300"
								}`}
							>
								{s.size}
							</button>
						))}
					</div>
				</div>
			)}

			{/* CTA */}
			<div className="flex flex-col gap-3 mt-2">
				<button
					type="button"
					onClick={onStartDesign}
					className="w-full py-4 bg-[#fe6241] text-black font-bold text-base rounded-xl hover:bg-[#e5573a] transition-colors"
				>
					Comienza a diseñar
				</button>
				<p className="text-center text-xs text-gray-400">
					Diseña en línea · Producción y entrega por {provider}
				</p>
			</div>

			{/* DESCRIPTION */}
			{product.description && (
				<div className="border-t border-gray-100 pt-6">
					<h2 className="text-base font-bold text-[#1a1a17] mb-2 flex items-center gap-2">
						<Package size={18} />
						Descripción
					</h2>
					<p className="text-sm text-gray-600 leading-relaxed">
						{product.description}
					</p>
				</div>
			)}
		</div>
	);
}
