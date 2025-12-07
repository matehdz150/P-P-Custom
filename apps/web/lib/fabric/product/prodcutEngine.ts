export type EditableAreaDef = {
	left: number;
	top: number;
	width: number;
	height: number;
};

export type ProductDefinition = {
	id: string;
	name: string;

	mockups: {
		front: string;
		back: string;
	};

	editableAreas: {
		front: EditableAreaDef[];
		back: EditableAreaDef[];
	};
};

/**
 * Carga un producto desde /public/products/{id}.json
 */
export async function loadProductDefinition(
	productId: string,
): Promise<ProductDefinition> {
	const res = await fetch(`/products/${productId}.json`);

	if (!res.ok) {
		throw new Error(`No se pudo cargar el producto "${productId}"`);
	}

	return res.json();
}
