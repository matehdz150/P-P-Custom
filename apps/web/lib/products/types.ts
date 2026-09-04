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

/**
 * Cuánto desborda el área, en píxeles del lienzo.
 *
 * VIENE YA CONVERTIDO desde `loadProductTemplate`, que es el único sitio donde
 * se conocen a la vez los centímetros que declaró el taller y lo que mide el
 * área en la plantilla. Hacer la cuenta en cada consumidor sería repetir la
 * misma regla de tres en el recorte, en el clip y en la exportación.
 */
export type ConSangrado = { sangradoPx?: number };

export type EditableShape =
	| (EditableRectShape & ConSangrado)
	| (EditableEllipseShape & ConSangrado)
	| (EditableTriangleShape & ConSangrado)
	| (EditableCircleShape & ConSangrado);

// 👇 cualquier string es un lado válido
export type ProductSide = string;

// Plantilla de producto genérica
export interface ProductTemplate<S extends ProductSide = ProductSide> {
	id: string;
	name: string;

	/**
	 * Qué forma tiene el objeto. Ausente = plano, que es lo que eran todos los
	 * productos antes de que existieran las tazas.
	 *
	 * Lo que decide HOY: si el modo "Probar" puede proyectar sobre una foto
	 * plana. Una envoltura no se puede proyectar con la homografía —cuatro
	 * esquinas son un plano y una taza es un cilindro— y enseñarlo igual sería
	 * un preview mentiroso justo en la pantalla que existe para no mentir.
	 */
	forma?: "plano" | "cilindro" | "cono";

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

	/** Los colores en que se puede pedir la prenda. Tiñen el mockup. */
	colors?: { name: string; hex: string }[];

	pricing?: {
		basePrice: number;
		perSidePrice?: number;
		perDesignPrice?: number;
		perColorPrice?: number;
		embroideryExtra?: number;
	};
}
