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

export async function loadProductDefinition(productId: string) {
	const res = await fetch(`/productsMockup/${productId}.json`);
	if (!res.ok) throw new Error("No se pudo cargar el producto");
	return (await res.json()) as ProductDefinition;
}
