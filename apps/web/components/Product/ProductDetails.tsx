"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/lib/api/products";
import { FulfillmentOptionCard } from "./FulfillmentOptionCard";
import { ProductGallery } from "./ProductGallery";
import { ProductInfo } from "./ProductInfo";
import { ProductRecommendations } from "./ProductRecommendations";

type Props = {
	product: Product;
};

export function ProductDetails({ product }: Props) {
	const router = useRouter();

	const printSideLabels = product.productTemplateData
		? Object.values(product.productTemplateData.sideLabels)
		: [];

	return (
		<div className="font-sora flex flex-col gap-16">
			{/* MAIN: gallery + purchase panel */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
				<ProductGallery images={product.images.map((img) => img.url)} />

				<div className="lg:py-2">
					<ProductInfo
						product={product}
						onStartDesign={() => router.push(`/design/${product.id}`)}
					/>
				</div>
			</div>

			{/* FULFILLMENT */}
			<FulfillmentOptionCard
				product={{
					id: product.id,
					pricing: product.pricing,
					colors: product.colors,
					sizes: product.sizes,
					printSides: printSideLabels,
					production: product.production,
				}}
			/>

			{/* RECOMMENDATIONS */}
			<ProductRecommendations />
		</div>
	);
}
