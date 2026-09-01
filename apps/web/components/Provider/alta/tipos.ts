/** Un número que el usuario todavía puede estar escribiendo (o haber borrado). */
export type Cifra = number | "";

export type Lado = {
	sideKey: string;
	widthCm: Cifra;
	heightCm: Cifra;
	dpi: Cifra;
};

export type Talla = {
	size: string;
	widthIn: Cifra;
	lengthIn: Cifra;
};

export type Color = {
	name: string;
	hex: string;
};

/**
 * El estado del alta, en el vocabulario del proveedor.
 *
 * Lo que NO está aquí es tan importante como lo que sí: `slug` e
 * `internalName` se derivan del nombre al enviar, y `status` sale de qué
 * botón se aprieta al final. Nunca se le preguntan al taller.
 */
export type Alta = {
	templateId: string;
	name: string;
	description: string;
	sku: string;
	categoryIds: string[];
	images: { url: string; order: number }[];
	printSides: Lado[];
	reglas: {
		allowText: boolean;
		allowImages: boolean;
		/** Sin límite mientras esté apagado: el taller lo enciende si lo necesita. */
		limitarDisenos: boolean;
		maxDisenos: Cifra;
		limitarTintas: boolean;
		maxTintas: Cifra;
	};
	sizes: Talla[];
	colors: Color[];
	pricing: {
		basePrice: Cifra;
		perSidePrice: Cifra;
		perDesignPrice: Cifra;
		perColorPrice: Cifra;
		embroideryExtra: Cifra;
	};
	diasProduccion: Cifra;
};

export const ALTA_VACIA: Alta = {
	templateId: "",
	name: "",
	description: "",
	sku: "",
	categoryIds: [],
	images: [],
	printSides: [],
	reglas: {
		allowText: true,
		allowImages: true,
		limitarDisenos: false,
		maxDisenos: "",
		limitarTintas: false,
		maxTintas: "",
	},
	sizes: [
		{ size: "S", widthIn: "", lengthIn: "" },
		{ size: "M", widthIn: "", lengthIn: "" },
		{ size: "L", widthIn: "", lengthIn: "" },
	],
	colors: [],
	pricing: {
		basePrice: "",
		perSidePrice: "",
		perDesignPrice: "",
		perColorPrice: "",
		embroideryExtra: "",
	},
	diasProduccion: "",
};

/** "Playera cuello redondo 180g" → "playera-cuello-redondo-180g" */
export function aSlug(nombre: string) {
	return nombre
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

const cifra = (v: Cifra) => (v === "" ? undefined : v);

/**
 * Traduce el alta al cuerpo que espera `POST /providers/products`, que sigue
 * hablando en el vocabulario del admin.
 */
export function aPayload(alta: Alta, publicar: boolean) {
	const slug = aSlug(alta.name);

	return {
		name: alta.name.trim(),
		slug,
		internalName: alta.name.trim(),
		sku: alta.sku.trim() || slug.toUpperCase().slice(0, 24),
		description: alta.description.trim() || undefined,
		categoryIds: alta.categoryIds,
		status: publicar ? "active" : "draft",
		templateId: alta.templateId,
		isCustomizable: true,
		images: alta.images,
		printSides: alta.printSides.map((s) => ({
			sideKey: s.sideKey,
			// NOT NULL en la base: si el campo quedó vacío, vuelve al default.
			widthCm: Number(s.widthCm) || 28,
			heightCm: Number(s.heightCm) || 35,
			dpi: Number(s.dpi) || 300,
			enabled: true,
		})),
		templateSides: alta.printSides.map((s) => s.sideKey),
		customizationRules: {
			allowText: alta.reglas.allowText,
			allowImages: alta.reglas.allowImages,
			// Apagado significa sin límite: se manda undefined, no un cero.
			maxDesigns: alta.reglas.limitarDisenos
				? cifra(alta.reglas.maxDisenos)
				: undefined,
			maxColorsPerDesign: alta.reglas.limitarTintas
				? cifra(alta.reglas.maxTintas)
				: undefined,
		},
		// Una talla sin medidas rompe el alta: en la base width_in y length_in
		// son NOT NULL. Se van sólo las completas.
		sizes: alta.sizes
			.filter(
				(t) => t.size.trim() !== "" && t.widthIn !== "" && t.lengthIn !== "",
			)
			.map((t) => ({
				size: t.size.trim(),
				widthIn: Number(t.widthIn),
				lengthIn: Number(t.lengthIn),
			})),
		colors: alta.colors.filter((c) => c.name.trim() && c.hex.trim()),
		pricing: {
			basePrice: cifra(alta.pricing.basePrice) ?? 0,
			perSidePrice: cifra(alta.pricing.perSidePrice),
			perDesignPrice: cifra(alta.pricing.perDesignPrice),
			perColorPrice: cifra(alta.pricing.perColorPrice),
			embroideryExtra: cifra(alta.pricing.embroideryExtra),
		},
		production: {
			meta: { diasProduccion: cifra(alta.diasProduccion) },
		},
	};
}
