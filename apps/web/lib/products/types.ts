// lib/products/types.ts

export type EditableRectShape = {
	id: string;
	type: "rect";
	left: number;
	top: number;
	width: number;
	height: number;
};

// si luego agregamos circle/path los metemos aquí
export type EditableShape = EditableRectShape;

export type ProductSide = "front" | "back";

export interface ProductTemplate {
	id: string;
	name: string;
	sides: ProductSide[];

	mockups: Record<ProductSide, string>;

	editableAreas: Record<ProductSide, EditableShape[]>;
}
