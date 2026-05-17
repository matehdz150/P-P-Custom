// lib/products/types.ts

export type EditableRectShape = {
	id: string;
	type: "rect";
	left: number;
	top: number;
	width: number;
	height: number;
};

export type EditableCircleShape = {
	id: string;
	type: "circle";
	cx: number;
	cy: number;
	radius: number;
};

export type EditableEllipseShape = {
	id: string;
	type: "ellipse";
	left: number;
	top: number;
	width: number;
	height: number;
};

export type EditableTriangleShape = {
	id: string;
	type: "triangle";
	left: number;
	top: number;
	width: number;
	height: number;
};

export type EditableShape =
	| EditableRectShape
	| EditableEllipseShape
	| EditableTriangleShape
	| EditableCircleShape;

// 👇 cualquier string es un lado válido
export type ProductSide = string;

// Plantilla de producto genérica
export interface ProductTemplate<S extends ProductSide = ProductSide> {
	id: string;
	name: string;

	// aquí van tus labels: "delantera", "trasera", "manga derecha"
	sides: S[];
	sideLabels?: Record<S, string>;

	mockups: Record<S, string>;

	editableAreas: Record<S, EditableShape[]>;

	customizationRules?: {
		maxDesigns?: number;
		allowText?: boolean;
		allowImages?: boolean;
		maxColorsPerDesign?: number;
	};

	pricing?: {
		basePrice: number;
		perSidePrice?: number;
		perDesignPrice?: number;
		perColorPrice?: number;
		embroideryExtra?: number;
	};
}
