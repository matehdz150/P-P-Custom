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

/**
 * El camino de vuelta: lo guardado en DynamoDB al estado del asistente, para
 * poder editarlo con la misma pantalla con la que se creó.
 *
 * Los límites son el caso interesante. `maxDesigns` y `maxColorsPerDesign`
 * se guardan **ausentes** cuando no hay tope, así que aquí se reconstruye la
 * palanca: si el número está, el límite estaba encendido. Leerlo al revés
 * dejaría al taller con un tope de cero.
 */
export function deProductoAAlta(p: {
	name: string;
	description?: string | null;
	sku?: string;
	templateId: string;
	categoryIds?: string[];
	images?: { url: string; order: number }[];
	printSides?: { sideKey: string; widthCm: number; heightCm: number; dpi?: number }[];
	customizationRules?: {
		allowText?: boolean;
		allowImages?: boolean;
		maxDesigns?: number;
		maxColorsPerDesign?: number;
	};
	sizes?: { size: string; widthIn: number; lengthIn: number }[];
	colors?: { name: string; hex: string }[];
	pricing?: Record<string, number | undefined>;
	production?: { meta?: { diasProduccion?: number } };
}): Alta {
	const reglas = p.customizationRules ?? {};
	const precios = p.pricing ?? {};

	return {
		templateId: p.templateId,
		name: p.name,
		description: p.description ?? "",
		sku: p.sku ?? "",
		categoryIds: p.categoryIds ?? [],
		images: p.images ?? [],
		printSides: (p.printSides ?? []).map((s) => ({
			sideKey: s.sideKey,
			widthCm: s.widthCm,
			heightCm: s.heightCm,
			dpi: s.dpi ?? 300,
		})),
		reglas: {
			allowText: reglas.allowText ?? true,
			allowImages: reglas.allowImages ?? true,
			limitarDisenos: reglas.maxDesigns !== undefined,
			maxDisenos: reglas.maxDesigns ?? "",
			limitarTintas: reglas.maxColorsPerDesign !== undefined,
			maxTintas: reglas.maxColorsPerDesign ?? "",
		},
		// Sin tallas el asistente no deja avanzar; se cae a las de siempre
		// para que el paso no quede vacío si el producto viene incompleto.
		sizes: p.sizes?.length ? p.sizes : ALTA_VACIA.sizes,
		colors: p.colors ?? [],
		pricing: {
			basePrice: precios.basePrice ?? "",
			perSidePrice: precios.perSidePrice ?? "",
			perDesignPrice: precios.perDesignPrice ?? "",
			perColorPrice: precios.perColorPrice ?? "",
			embroideryExtra: precios.embroideryExtra ?? "",
		},
		diasProduccion: p.production?.meta?.diasProduccion ?? "",
	};
}

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
 * Traduce el alta al cuerpo que espera `POST /proveedores/productos`.
 *
 * `enviar` sustituyó al viejo `status`: el taller no publica, manda a
 * revisión. Quien pone un producto en el catálogo es el admin, así que
 * dejarle elegir "activo" aquí habría sido decorativo — la Lambda lo ignora.
 *
 * El slug tampoco se manda: lo calcula la Lambda, que es la única que puede
 * saber si ya está ocupado y añadirle un sufijo.
 */
export function aPayload(alta: Alta, enviar: boolean) {
	const slug = aSlug(alta.name);

	return {
		name: alta.name.trim(),
		internalName: alta.name.trim(),
		sku: alta.sku.trim() || slug.toUpperCase().slice(0, 24),
		description: alta.description.trim() || undefined,
		categoryIds: alta.categoryIds,
		enviar,
		templateId: alta.templateId,
		isCustomizable: true,
		images: alta.images,
		printSides: alta.printSides.map((s) => ({
			sideKey: s.sideKey,
			// El área imprimible es lo que limita al cliente en el editor: si el
			// taller la dejó vacía, vale más un tamaño sensato que un hueco.
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
		// Una talla a medias no se puede enseñar en la ficha ni usar para
		// validar el diseño. Se van sólo las completas.
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
