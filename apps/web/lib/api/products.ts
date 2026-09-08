import type { Tecnica } from "@/lib/impresion/tecnicas";
import { apiFetch } from "./api";
import type { FotoRealDePrenda } from "./catalogo";

/* =========================
   TYPES
========================= */

export type ProductImage = {
	url: string;
	order: number;
};

export type ProductPrintSide = {
	/**
	 * Qué lado del producto es.
	 *
	 * `wrap` NO ES UN LADO MÁS: es la envoltura entera de un cilindro —una taza,
	 * un termo— y un producto que la tiene no tiene ningún otro. La diferencia
	 * que importa es que un lado plano se ve completo de frente y una envoltura
	 * sólo enseña la mitad, comprimida hacia los bordes; por eso el preview de
	 * un cilindro no lo puede hacer la homografía de `lib/prenda/componer`, que
	 * proyecta planos, sino `lib/prenda/cilindro`.
	 */
	/* ABIERTO A PROPÓSITO, no es que falte cerrarlo. Era la unión
	   `"front" | "back" | "left" | "right" | "wrap"` y ya no describía la
	   realidad: el alta del taller es un campo de texto donde se escribe la
	   clave, `ProductSide` es `string` en el editor, y una prenda con mangas
	   necesita claves que esa lista no tenía. Cerrarla otra vez rompería
	   cualquier producto cuyo lado no esté en la lista, y el que decide qué
	   lados hay es el taller. */
	sideKey: string;
	widthCm: number;
	heightCm: number;
	dpi?: number;
	/**
	 * Lo que suma ESTE lado sobre el precio base, si el taller se lo puso.
	 *
	 * Sin él se usa el `perSidePrice` del producto, que es lo correcto cuando
	 * todos los lados valen igual. Existe porque una manga no cuesta lo que una
	 * espalda: con un precio único, estampar las dos mangas costaba lo mismo
	 * que estampar dos espaldas.
	 */
	recargo?: number | null;
	/**
	 * Cuánto tiene que desbordar el arte por cada lado, en centímetros.
	 *
	 * NO ES DECORACIÓN NI UN MARGEN DE SEGURIDAD: es lo contrario. El papel de
	 * sublimación se mueve al prensar y el corte de un textil no cae al
	 * milímetro, así que el arte tiene que seguir habiendo un poco MÁS ALLÁ del
	 * área imprimible. Sin sangrado, ese desplazamiento deja una línea blanca en
	 * el filo — y en una taza, donde el estampado llega al borde de la banda, se
	 * ve siempre.
	 *
	 * Lo que cambia es el ARCHIVO, no lo que se cobra ni lo que se imprime: el
	 * área sigue midiendo `widthCm × heightCm` y el PNG sale
	 * `(width + 2·sangrado) × (height + 2·sangrado)`. Por eso la ficha del
	 * taller lo resta antes de comparar; si no, avisaría de una desviación que
	 * es a propósito.
	 *
	 * Cero o ausente = sin sangrado, que es lo correcto para un estampado que no
	 * llega al borde.
	 */
	sangradoCm?: number;
	/**
	 * Con qué se estampa este lado.
	 *
	 * DECIDE EL FORMATO DEL ARCHIVO, que es la razón de que viva aquí y no en el
	 * producto: junto a `dpi` y `sangradoCm` están las tres cosas que describen
	 * cómo sale el arte de este lado. Una serigrafía manda un PNG a los DPI
	 * declarados; un láser no imprime, quema, y pide trazos.
	 *
	 * Las claves y su clasificación viven en `lib/impresion/tecnicas.ts`. Sin
	 * declarar, ráster: es lo que han hecho todos los productos hasta hoy.
	 */
	tecnica?: Tecnica;
	enabled?: boolean;
};

/* ✅ NUEVO */
export type ProductSize = {
	size: string; // S | M | L | XL | etc
	widthIn: number; // ancho (inches)
	lengthIn: number; // largo (inches)
};

export type ProductColor = {
	name: string;
	hex: string;
};

export type ProductPricing = {
	basePrice: number;
	perSidePrice?: number;
	perDesignPrice?: number;
	perColorPrice?: number;
	embroideryExtra?: number;
};

export type ProductProduction = {
	provider: string;
	providerSku?: string;
	meta?: Record<string, any>;
};

export type ProductTemplateData = {
	/**
	 * Qué forma tiene el objeto. Ausente = plano.
	 *
	 * Un cilindro tiene UN lado —la envoltura de 360°— y su preview no lo puede
	 * hacer la homografía de `lib/prenda/componer`, que proyecta planos. Lo
	 * declara la PLANTILLA, no el producto: es del objeto, no de la ficha de un
	 * taller. Ver `services/admin/src/rutas/plantillas.ts`.
	 */
	forma?: "plano" | "cilindro" | "cono";
	sides: string[];
	sideLabels: Record<string, string>;
	mockups: Record<string, string>;
	editableAreas: Record<string, any[]>;
};

export type DesignerCustomizationRules = {
	maxDesigns?: number;
	allowText?: boolean;
	allowImages?: boolean;
	maxColorsPerDesign?: number;
};

export type DesignerProductTemplate = {
	id: string;
	name?: string;
	/**
	 * Qué forma tiene el objeto. Ausente = plano.
	 *
	 * Un cilindro tiene UN lado —la envoltura de 360°— y su preview no lo puede
	 * hacer la homografía de `lib/prenda/componer`, que proyecta planos. Lo
	 * declara la PLANTILLA, no el producto: es del objeto, no de la ficha de un
	 * taller. Ver `services/admin/src/rutas/plantillas.ts`.
	 */
	forma?: "plano" | "cilindro" | "cono";
	sides: string[];
	sideLabels: Record<string, string>;
	mockups: Record<string, string>;
	editableAreas: Record<string, any[]>;
	customizationRules?: DesignerCustomizationRules;
	pricing?: ProductPricing;
	/** Los colores en que se puede pedir la prenda. Tiñen el mockup. */
	colors?: ProductColor[];
	/**
	 * Las fotos de la prenda de verdad, con el cuadro donde cae lo impreso.
	 *
	 * Es lo que alimenta el botón "Probar" del editor. Van por lado Y por color
	 * —una foto no se puede teñir como el mockup—, así que puede haber colores
	 * sin foto: ésos no tienen vista realista y no es un error.
	 */
	fotosReales?: FotoRealDePrenda[];
	/** Las tallas que el taller maneja: son las que se piden desde el editor. */
	sizes?: ProductSize[];
	/**
	 * El área imprimible de cada lado, en centímetros.
	 *
	 * No es decoración: de aquí sale a qué resolución se exporta el archivo que
	 * el taller manda a máquina. Sin esto habría que adivinar los DPI.
	 */
	printSides?: ProductPrintSide[];
	/**
	 * De qué taller es.
	 *
	 * Hace falta en el editor desde que hay carrito: agrupa los artículos y, al
	 * pedir, es lo que parte la compra en un pedido por taller.
	 */
	proveedorId?: string;
	proveedorNombre?: string | null;
};

export type Product = {
	id: string;
	slug: string;
	sku: string;
	internalName: string;
	name: string;
	description?: string | null;

	brand?: string | null;
	category?: string | null;

	status: "draft" | "active" | "archived";
	templateId: string;
	isCustomizable: boolean;

	// ✅ AQUI ESTABA EL PROBLEMA
	productTemplateData: ProductTemplateData;

	images: ProductImage[];
	printSides?: ProductPrintSide[];
	sizes?: ProductSize[];
	colors?: ProductColor[];
	pricing?: ProductPricing;
	customizationRules?: Record<string, any>;
	production?: ProductProduction;

	provider?: {
		id: string;
		slug: string | null;
		displayName: string | null;
		name: string | null;
		avatarUrl: string | null;
	} | null;

	createdAt: string;
};

export type CatalogProduct = {
	id: string;
	name: string;
	brand?: string | null;
	category?: string | null;
	description?: string | null;
	images: {
		url: string;
		order: number;
	}[];
	pricing: {
		basePrice: number;
	};
};

/* =========================
   INPUTS
========================= */

export type CreateProductInput = {
	name: string;
	sku: string;
	internalName: string;
	templateId: string;

	/* Aceptan `null` porque los formularios mandan el campo vacío como `null`,
     que es lo que guarda la base. Declararlos sólo como `string` obligaba a
     limpiarlos en cada sitio que construye un payload. */
	description?: string | null;
	brand?: string | null;
	category?: string | null;

	status: string;

	images: ProductImage[]; // 👈 OBLIGATORIO (mín 2)

	printSides?: ProductPrintSide[];

	/* ✅ ACTUALIZADO */
	sizes?: ProductSize[];

	colors?: ProductColor[];
	pricing?: ProductPricing;
	customizationRules?: Record<string, any>;
	production?: ProductProduction;
};

export type UpdateProductInput = Partial<CreateProductInput> & {
	status?: "draft" | "active" | "archived";
};

/* =========================
   API CALLS
========================= */

export function getProducts() {
	return apiFetch<Product[]>("/products");
}

export function getProduct(id: string) {
	return apiFetch<Product>(`/products/${id}`);
}

export function createProduct(data: CreateProductInput) {
	if (!data.images || data.images.length < 2) {
		throw new Error("El producto debe tener al menos 2 imágenes");
	}

	return apiFetch<{ id: string }>("/products", {
		method: "POST",
		body: JSON.stringify({
			...data,
			slug: data.name.toLowerCase().trim().replace(/\s+/g, "-"),
			status: data.status ?? "draft",
			isCustomizable: true,
		}),
	});
}

export function updateProduct(id: string, data: UpdateProductInput) {
	return apiFetch(`/products/${id}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export function deleteProduct(id: string) {
	return apiFetch(`/products/${id}`, {
		method: "DELETE",
	});
}

export function getCatalogProducts() {
	return apiFetch<CatalogProduct[]>("/products/catalog");
}
