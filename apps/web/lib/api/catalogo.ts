/**
 * El catálogo público.
 *
 * Va directo a API Gateway, sin llave y sin token: es lo que ve cualquiera
 * que abra la tienda. Por eso NO pasa por `/api/admin/*` —ese puente pone la
 * llave del admin— ni por el cliente de proveedores, que exige sesión.
 *
 * Sirve tanto en el navegador como en el servidor de Next: la URL es
 * absoluta, así que un componente de servidor puede llamarlo igual.
 */

import { sinAcentos } from "@/lib/texto";
import type { Category } from "./categories";
import type { CatalogProduct, Product, ProductTemplateData } from "./products";

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

/**
 * Deliberadamente compatible con el `ProductFromCategory` que ya consumen
 * las pantallas del catálogo: la migración cambia de dónde salen los datos,
 * no cómo se pintan. Los campos que pueden faltar son opcionales porque la
 * API los omite en vez de mandarlos en `null`.
 */
export type ProductoDeCatalogo = {
	id: string;
	slug: string;
	name: string;
	description?: string | null;
	images: { url: string; order?: number }[];
	basePrice?: number;
	categoryIds: string[];
	/** El nombre del taller. Se resuelve al leer, no vive dentro del producto. */
	provider?: string | null;
	/** Todavía no se captura en el alta; el filtro se esconde si no hay ninguna. */
	technique?: string | null;
	productionDays?: number | null;
	colors?: { name: string; hex?: string | null }[];
	sizes?: { size: string; widthIn: number; lengthIn: number }[];
	printSides?: { sideKey: string; widthCm: number; heightCm: number }[];
	templateId: string;
};

/**
 * Una foto de la prenda de verdad, con el cuadro donde cae lo impreso.
 *
 * ES POR LADO Y POR COLOR. Al mockup se le cambia el color tiñéndolo —es una
 * prenda clara sobre blanco que se recorta y se multiplica—, pero una foto con
 * modelo o de una prenda oscura no admite ese tratamiento. Un color sin foto no
 * tiene vista realista y se queda con el mockup.
 *
 * Las esquinas van en FRACCIONES de 0 a 1 del ancho y alto de la foto, en el
 * orden arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda. En
 * píxeles el cuadro quedaría atado a la resolución con la que se marcó.
 */
/**
 * La banda visible de un cilindro, en fracciones de 0 a 1 de la foto.
 *
 * ES OTRA GEOMETRÍA que las cuatro esquinas, no una variante. Cuatro esquinas
 * definen un PLANO y sirven para una playera; una taza es un cilindro y sólo
 * enseña 180° de su envoltura, comprimidos hacia los bordes. Ver
 * `lib/prenda/cilindro`.
 */
export type BandaDeCilindro = {
	izquierda: number;
	derecha: number;
	arriba: number;
	abajo: number;
	/** Cuánto se comba el filo, en fracción del alto de la banda. */
	bombeo: number;
	/** Qué punto de la envoltura mira a la cámara, de 0 a 1. */
	centro: number;
};

/**
 * La foto real del producto con dónde cae lo impreso.
 *
 * LLEVA UNA COSA U OTRA según la forma de la plantilla: `esquinas` si es
 * plano, `banda` si es un cilindro. No las dos, y nunca ninguna — una foto sin
 * geometría no se puede proyectar y sería una foto suelta.
 */
export type FotoRealDePrenda = {
	lado: string;
	color: string;
	url: string;
	esquinas?: { x: number; y: number }[];
	banda?: BandaDeCilindro;
};

/** La ficha trae además lo que el editor necesita para montar el lienzo. */
export type FichaDeProducto = ProductoDeCatalogo & {
	fotosReales?: FotoRealDePrenda[];
	customizationRules: {
		allowText?: boolean;
		allowImages?: boolean;
		maxDesigns?: number;
		maxColorsPerDesign?: number;
	};
	templateSides: string[];
	pricing: Record<string, number | undefined>;
	production?: { meta?: Record<string, unknown> };
	/** La plantilla ya resuelta: sin ella el editor no tiene lienzo. */
	plantilla: {
		id: string;
		name: string;
		data: ProductTemplateData;
	} | null;
	taller: {
		id: string;
		name: string | null;
		displayName: string | null;
		slug: string | null;
		avatarUrl: string | null;
	} | null;
};

/** Las mismas categorías que administra el admin, leídas sin llave. */
export type CategoriaPublica = Category;

async function publico<T>(ruta: string): Promise<T> {
	const res = await fetch(`${API}${ruta}`, {
		// El catálogo cambia cuando el admin aprueba algo; media hora de
		// margen evita pedirlo en cada navegación sin que un producto nuevo
		// tarde en aparecer más de lo razonable.
		next: { revalidate: 1800 },
	});

	if (!res.ok) {
		const cuerpo = await res.json().catch(() => null);
		throw new Error(cuerpo?.message ?? `El catálogo respondió ${res.status}`);
	}

	return res.json();
}

/**
 * Todos los productos publicados, en una sola petición.
 *
 * Antes el listado pedía los productos categoría por categoría y los juntaba
 * en el navegador —tantas peticiones como categorías hubiera— porque la API
 * vieja sólo sabía servirlos así. Los filtros del catálogo (técnica, color,
 * días) siempre se aplicaron en cliente, así que traerlos de una vez es a la
 * vez más simple y menos peticiones.
 */
export async function getCatalogo() {
	const productos = await publico<ProductoDeCatalogo[]>("/publico/catalogo");
	recuerdo.catalogo = productos;
	return productos;
}

/**
 * Lo último que se trajo, para pintar sin rueda.
 *
 * Tres pantallas lo piden casi a la vez —el catálogo del panel, el cajón que
 * elige productos para una plantilla y la lista de plantillas, que necesita
 * las miniaturas— y el cajón además se abre una vez por producto que se
 * agrega. Sin esto, armar un kit de cinco eran cinco ruedas girando para
 * enseñar siempre lo mismo.
 *
 * NO ES UNA CACHÉ CON CADUCIDAD: se pinta lo recordado y se vuelve a pedir por
 * detrás, así que lo que se publicó hace un minuto aparece igual — sólo que un
 * instante después. Vive en memoria, así que recargar lo tira.
 */
const recuerdo: {
	catalogo: ProductoDeCatalogo[] | null;
	categorias: CategoriaPublica[] | null;
} = { catalogo: null, categorias: null };

export const catalogoRecordado = () => recuerdo.catalogo;
export const categoriasRecordadas = () => recuerdo.categorias;

/** Los productos por id, para resolver tallas, precio o foto de un guardado. */
export function porIdDeProducto(productos: ProductoDeCatalogo[] | null) {
	return new Map((productos ?? []).map((p) => [p.id, p]));
}

/**
 * Las fichas ya traídas, por id.
 *
 * El `next: { revalidate }` de `publico` NO existe en el navegador: es cosa
 * del servidor de Next, y desde el cliente cada llamada sale a la red. La
 * ficha se abre y se cierra —se compara un producto con otro y se vuelve al
 * primero—, así que sin esto una tarde de escaparate son diez peticiones para
 * enseñar tres productos.
 *
 * Vive en memoria y no caduca, como `recuerdo`: recargar lo tira.
 */
const fichas = new Map<string, FichaDeProducto>();

export const fichaRecordada = (id: string) => fichas.get(id) ?? null;

export async function getFichaDeProducto(id: string) {
	const ficha = await publico<FichaDeProducto>(`/publico/catalogo/${id}`);
	fichas.set(id, ficha);
	return ficha;
}

export async function getCategoriasPublicas() {
	const categorias = await publico<CategoriaPublica[]>("/publico/categorias");
	recuerdo.categorias = categorias;
	return categorias;
}

export type ResultadoDeBusqueda = {
	type: "product" | "package";
	id: string;
	name: string;
	image: string | null;
	price?: number | null;
};

/**
 * Busca en el catálogo, del lado del navegador.
 *
 * Antes existía un `/search` en Nest. Con decenas de productos que ya se
 * traen enteros para el listado, un endpoint de búsqueda es una pieza más
 * que mantener a cambio de nada: filtrar aquí es instantáneo y no gasta una
 * llamada. Si algún día el catálogo crece lo suficiente para que esto pese,
 * hará falta un buscador de verdad, no volver a un LIKE en la base.
 *
 * Compara sin acentos ni mayúsculas: quien escribe "camiseta grafica" espera
 * encontrar la "Camiseta Gráfica".
 */
export async function buscarEnCatalogo(
	q: string,
	limite = 12,
): Promise<ResultadoDeBusqueda[]> {
	const termino = sinAcentos(q);
	if (!termino) return [];

	const catalogo = await getCatalogo().catch(() => []);

	return catalogo
		.filter((p) => sinAcentos(p.name).includes(termino))
		.slice(0, limite)
		.map((p) => ({
			type: "product" as const,
			id: p.id,
			name: p.name,
			image: p.images?.[0]?.url ?? null,
			price: p.basePrice ?? null,
		}));
}

/* ─── Puente con la ficha vieja ──────────────────────────────────────────
   La página de producto y su docena de componentes hablan el tipo `Product`
   de la API de Nest. Traducir aquí, en un sitio, sale mucho más barato que
   tocar todo ese árbol, y el día que se refactorice se borra esta función
   sin que la Lambda se entere: ella ya habla el vocabulario nuevo. */

const PLANTILLA_VACIA: ProductTemplateData = {
	sides: [],
	sideLabels: {},
	mockups: {},
	editableAreas: {},
};

export function aProductoViejo(f: FichaDeProducto): Product {
	return {
		id: f.id,
		slug: f.slug,
		// El SKU es interno del taller y no se publica; los componentes lo
		// esperan, así que va vacío en vez de inventado.
		sku: "",
		internalName: f.name,
		name: f.name,
		description: f.description ?? null,
		brand: null,
		category: null,
		// Sólo se sirven productos aprobados: si llegó hasta aquí, está activo.
		status: "active",
		templateId: f.templateId,
		isCustomizable: true,
		productTemplateData: f.plantilla?.data ?? PLANTILLA_VACIA,
		images: (f.images ?? []).map((i, orden) => ({
			url: i.url,
			order: i.order ?? orden,
		})),
		printSides: (f.printSides ?? []).map((s) => ({
			sideKey: s.sideKey as "front" | "back" | "left" | "right" | "wrap",
			widthCm: s.widthCm,
			heightCm: s.heightCm,
		})),
		sizes: f.sizes ?? [],
		colors: (f.colors ?? []).map((c) => ({ name: c.name, hex: c.hex ?? "" })),
		pricing: {
			basePrice: f.pricing?.basePrice ?? 0,
			perSidePrice: f.pricing?.perSidePrice,
			perDesignPrice: f.pricing?.perDesignPrice,
			perColorPrice: f.pricing?.perColorPrice,
			embroideryExtra: f.pricing?.embroideryExtra,
		},
		customizationRules: f.customizationRules ?? {},
		production: {
			provider: f.taller?.displayName ?? f.taller?.name ?? "",
			meta: f.production?.meta ?? {},
		},
		provider: f.taller
			? {
					id: f.taller.id,
					slug: f.taller.slug,
					displayName: f.taller.displayName,
					name: f.taller.name,
					avatarUrl: f.taller.avatarUrl,
				}
			: null,
		createdAt: "",
	};
}

/** Las tarjetas de "También se personalizan". */
export function aTarjetasViejas(
	productos: ProductoDeCatalogo[],
): CatalogProduct[] {
	return productos.map((p) => ({
		id: p.id,
		name: p.name,
		description: p.description ?? null,
		images: (p.images ?? []).map((i, orden) => ({
			url: i.url,
			order: i.order ?? orden,
		})),
		pricing: { basePrice: p.basePrice ?? 0 },
	}));
}
