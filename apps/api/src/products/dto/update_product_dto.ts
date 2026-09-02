import type { ProductStatus } from "./create_product_dto";

export type UpdateProductDto = Partial<{
	slug: string;
	sku: string;

	internalName: string;
	name: string;
	description: string | null;

	brand: string | null;
	categoryIds?: string[];

	status: ProductStatus;
	templateId: string;
	templateSides: string[];

	isCustomizable: boolean;

	images: {
		url: string;
		order?: number;
	}[];

	printSides: {
		sideKey: string;
		widthCm: number;
		heightCm: number;
		dpi?: number;
		enabled?: boolean;
	}[];

	/* ✅ SIZES CON MÉTRICA */
	sizes: {
		size: string;
		widthIn: number;
		lengthIn: number;
	}[];

	colors: {
		name: string;
		hex?: string;
	}[];

	pricing: {
		basePrice: number;
		perSidePrice?: number;
		perDesignPrice?: number;
		perColorPrice?: number;
		embroideryExtra?: number;
	};

	customizationRules: Record<string, unknown>;

	production: {
		provider?: string;
		providerSku?: string;
		meta?: Record<string, unknown>;
	};
}>;
