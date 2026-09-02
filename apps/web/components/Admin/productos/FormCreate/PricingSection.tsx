// PricingSection.tsx
"use client";

import { Input } from "@/components/ui/input";

export type ProductPricing = {
	basePrice: number;
	perSidePrice?: number;
	perDesignPrice?: number;
	perColorPrice?: number;
	embroideryExtra?: number;
};

type Props = {
	value: ProductPricing;
	onChange: (next: ProductPricing) => void;
};

export function PricingSection({ value, onChange }: Props) {
	return (
		<section className="border p-4 rounded space-y-2">
			<h3 className="font-semibold mb-3">Precio</h3>

			<Input
				type="number"
				min={0}
				step="0.01"
				placeholder="Precio base"
				value={value.basePrice}
				onChange={(e) =>
					onChange({
						...value,
						basePrice: Number(e.target.value),
					})
				}
			/>

			<Input
				type="number"
				min={0}
				step="0.01"
				placeholder="Extra por lado"
				value={value.perSidePrice ?? ""}
				onChange={(e) =>
					onChange({
						...value,
						perSidePrice:
							e.target.value === "" ? undefined : Number(e.target.value),
					})
				}
			/>

			<Input
				type="number"
				min={0}
				step="0.01"
				placeholder="Extra por diseño"
				value={value.perDesignPrice ?? ""}
				onChange={(e) =>
					onChange({
						...value,
						perDesignPrice:
							e.target.value === "" ? undefined : Number(e.target.value),
					})
				}
			/>

			<Input
				type="number"
				min={0}
				step="0.01"
				placeholder="Extra por color"
				value={value.perColorPrice ?? ""}
				onChange={(e) =>
					onChange({
						...value,
						perColorPrice:
							e.target.value === "" ? undefined : Number(e.target.value),
					})
				}
			/>

			<Input
				type="number"
				min={0}
				step="0.01"
				placeholder="Extra bordado"
				value={value.embroideryExtra ?? ""}
				onChange={(e) =>
					onChange({
						...value,
						embroideryExtra:
							e.target.value === "" ? undefined : Number(e.target.value),
					})
				}
			/>
		</section>
	);
}
