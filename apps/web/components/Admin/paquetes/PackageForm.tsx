/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import type { Product } from "@/lib/api/products";
import { uploadImage } from "@/lib/api/uploads";

import { PackageProductsPicker } from "./PackageProductsPicker";
import { PackageItemsEditor } from "./PackageItemEditor";
import { PackageCategoriesSection } from "./PackageCategoriesSection";

/* =========================
   TYPES
========================= */

type PackageFormValue = {
	name: string;
	description?: string | null;
	image?: string | null;
	categories?: string[];
	pricing?: {
		basePrice: number;
	};
	items?: {
		product: Product;
		quantity: number;
	}[];
};

type Item = {
	product: Product;
	quantity: number;
};

type Props = {
	initialValue?: PackageFormValue;
	onSubmit: (data: {
		name: string;
		description?: string;

		categories: string[];
		image?: string;
		items: {
			productId: string;
			quantity: number;
		}[];
		pricing: {
			basePrice: number;
		};
	}) => void;
};

/* =========================
   COMPONENT
========================= */

export function PackageForm({ initialValue, onSubmit }: Props) {
	/* =========================
     CORE
  ========================= */

	const [name, setName] = useState(initialValue?.name ?? "");
	const [description, setDescription] = useState(
		initialValue?.description ?? "",
	);

	const [basePrice, setBasePrice] = useState<number | "">(
		initialValue?.pricing?.basePrice ?? "",
	);

	/* =========================
     IMAGE
  ========================= */

	const [image, setImage] = useState<string | null>(
		initialValue?.image ?? null,
	);
	const [uploadingImage, setUploadingImage] = useState(false);

	async function handleImageUpload(file: File) {
		try {
			setUploadingImage(true);
			const res = await uploadImage(file);
			setImage(res.url);
		} catch {
			alert("Error subiendo imagen");
		} finally {
			setUploadingImage(false);
		}
	}

	/* =========================
     CATEGORIES
  ========================= */

	const [categories, setCategories] = useState<string[]>(
		initialValue?.categories ?? [],
	);

	/* =========================
     ITEMS
  ========================= */

	const [items, setItems] = useState<Item[]>(
		initialValue?.items?.map((i) => ({
			product: i.product,
			quantity: i.quantity,
		})) ?? [],
	);

	/* =========================
     SUBMIT
  ========================= */

	function submit(e: React.FormEvent) {
		e.preventDefault();

		if (!name.trim()) {
			alert("El paquete debe tener nombre");
			return;
		}

		if (!items.length) {
			alert("El paquete debe tener al menos un producto");
			return;
		}

		if (basePrice === "" || Number(basePrice) <= 0) {
			alert("El paquete debe tener un precio válido");
			return;
		}

		onSubmit({
			name: name.trim(),
			description: description?.trim() || undefined,
			categories,
			image: image ?? undefined,
			items: items.map((i) => ({
				productId: i.product.id,
				quantity: i.quantity,
			})),
			pricing: {
				basePrice: Number(basePrice),
			},
		});
	}

	/* =========================
     UI
  ========================= */

	return (
		<form onSubmit={submit} className="space-y-6 max-w-3xl">
			{/* ================= INFO ================= */}
			<div className="space-y-3">
				<Input
					placeholder="Nombre del paquete"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
				/>

				<Textarea
					placeholder="Descripción"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>

				<Input
					type="number"
					min="0"
					step="0.01"
					placeholder="Precio del paquete"
					value={basePrice}
					onChange={(e) =>
						setBasePrice(e.target.value === "" ? "" : Number(e.target.value))
					}
					required
				/>
			</div>

			{/* ================= IMAGE ================= */}
			<div className="space-y-2">
				<label className="text-sm font-medium">Imagen del paquete</label>

				{image ? (
					<div className="relative w-48">
						<img
							src={image}
							alt="Imagen del paquete"
							className="rounded border"
						/>

						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="absolute top-1 right-1"
							onClick={() => setImage(null)}
						>
							Quitar
						</Button>
					</div>
				) : (
					<Input
						type="file"
						accept="image/*"
						disabled={uploadingImage}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) handleImageUpload(file);
						}}
					/>
				)}

				{uploadingImage && (
					<p className="text-sm text-muted-foreground">Subiendo imagen…</p>
				)}
			</div>

			{/* ================= CATEGORIES ================= */}
			<PackageCategoriesSection value={categories} onChange={setCategories} />

			{/* ================= ITEMS ================= */}
			<PackageItemsEditor items={items} onChange={setItems} />

			<PackageProductsPicker
				selectedIds={items.map((i) => i.product.id)}
				onAdd={(product) => setItems([...items, { product, quantity: 1 }])}
			/>

			{/* ================= ACTION ================= */}
			<Button type="submit">Guardar paquete</Button>
		</form>
	);
}
