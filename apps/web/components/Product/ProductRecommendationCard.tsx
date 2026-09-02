// components/Product/ProductRecommendationCard.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

type Props = {
	product: {
		id: string;
		name: string;
		price: number;
		image: string;
	};
};

export function ProductRecommendationCard({ product }: Props) {
	const router = useRouter();

	return (
		<div
			onClick={() => router.push(`/product/${product.id}`)}
			className="group cursor-pointer rounded-[0.2rem] border bg-white overflow-hidden hover:shadow-md transition"
		>
			<div className="aspect-square bg-[#f5f5f1] relative">
				<Image
					src={product.image}
					alt={product.name}
					fill
					className="object-contain p-6 group-hover:scale-105 transition"
				/>
			</div>

			<div className="p-4 space-y-1">
				<p className="text-sm font-semibold line-clamp-2">{product.name}</p>
				<p className="text-sm text-muted-foreground">
					Desde MXN {product.price}
				</p>
			</div>
		</div>
	);
}
