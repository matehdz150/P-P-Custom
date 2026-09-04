import { sinAcentos } from "@/lib/texto";

/** Un número que el usuario todavía puede estar escribiendo (o haber borrado). */
export type Cifra = number | "";

export type Lado = {
	sideKey: string;
	widthCm: Cifra;
	heightCm: Cifra;
	dpi: Cifra;
	/**
	 * Cuánto tiene que desbordar el arte por cada lado, en centímetros.
	 *
	 * Vacío o cero = sin sangrado, y es lo correcto para un estampado que no
	 * llega al borde. Hace falta cuando SÍ llega —una taza, un termo, un tote
	 * impreso a sangre—: el papel se mueve al prensar y sin desbordamiento
	 * queda una línea blanca en el filo.
	 */
	sangradoCm: Cifra;
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

export type Punto = { x: number; y: number };

import type { BandaDeCilindro } from "@/lib/api/catalogo";

export type { BandaDeCilindro };

/**
 * La foto de la prenda de verdad con el cuadro donde cae lo impreso.
 *
 * UNA POR LADO **Y POR COLOR**. El mockup se tiñe —es una prenda clara sobre
 * blanco que se recorta y se multiplica—, pero una foto con modelo o de una
 * prenda ya oscura no admite ese tratamiento: teñiría también la cara. Así que
 * la llave es el par, y un color sin foto simplemente no tiene vista realista.
 *
 * Las esquinas van en FRACCIONES de 0 a 1, en el orden arriba-izquierda,
 * arriba-derecha, abajo-derecha, abajo-izquierda. En píxeles quedarían atadas
 * al tamaño con el que se marcaron y bastaría recomprimir la foto para
 * descuadrar el estampado.
 */
export type FotoDePrenda = {
	lado: string;
	color: string;
	url: string;
	/** Plano: las cuatro esquinas del cuadro. */
	esquinas?: Punto[];
	/** Cilindro: la banda visible. Otra geometría, no una variante. */
	banda?: BandaDeCilindro;
};

/** El arranque de la banda: el cuerpo centrado, sin bombeo y con la costura detrás. */
export const BANDA_POR_DEFECTO: BandaDeCilindro = {
	izquierda: 0.2,
	derecha: 0.8,
	arriba: 0.32,
	abajo: 0.72,
	bombeo: 0.04,
	centro: 0.5,
};

/** El cuadro de arranque: centrado en el pecho, que es donde cae casi siempre. */
export const ESQUINAS_POR_DEFECTO: Punto[] = [
	{ x: 0.34, y: 0.3 },
	{ x: 0.66, y: 0.3 },
	{ x: 0.66, y: 0.66 },
	{ x: 0.34, y: 0.66 },
];

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
	/** Ver `FotoDePrenda`. Vacío es válido: el editor se cae al mockup. */
	fotosReales: FotoDePrenda[];
	pricing: {
		basePrice: Cifra;
		perSidePrice: Cifra;
		perDesignPrice: Cifra;
		perColorPrice: Cifra;
		embroideryExtra: Cifra;
	};
	diasProduccion: Cifra;
	/**
	 * Las existencias. Todo producto las lleva — el interruptor se quitó.
	 *
	 * `porVariante` va con la llave `color|talla`, la misma que arma la Lambda.
	 * Sin colores capturados la llave es sólo la talla.
	 */
	stock: {
		porVariante: Record<string, Cifra>;
		/** Vacío = sin aviso de existencias bajas. Es lo único opcional aquí. */
		minimoAlerta: Cifra;
		/** Cuántos días más tarda si hay que comprar el blanco. */
		diasExtraSinStock: Cifra;
	};

	/**
	 * Lo que la paquetería necesita para cotizar.
	 *
	 * `pesoPorTalla` va indexado por TALLA y no por variante: el color no
	 * cambia lo que pesa una prenda. En gramos enteros, que es como la gente
	 * piensa el peso de una playera; los kilos que quiere Skydropx los
	 * calculamos nosotros.
	 *
	 * `caja` es la de UNA pieza, para poder cotizar antes de que el paquete
	 * exista. Las medidas reales las confirma el taller al terminar.
	 */
	envio: {
		pesoPorTalla: Record<string, Cifra>;
		caja: { largo: Cifra; ancho: Cifra; alto: Cifra };
	};
};

/** La llave de una variante. Espejo de `variante()` en las Lambdas. */
export function claveVariante(color: string | null, talla: string) {
	const limpia = (s: string) => s.trim().replace(/\|/g, "-");
	return color ? `${limpia(color)}|${limpia(talla)}` : limpia(talla);
}

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
	fotosReales: [],
	pricing: {
		basePrice: "",
		perSidePrice: "",
		perDesignPrice: "",
		perColorPrice: "",
		embroideryExtra: "",
	},
	diasProduccion: "",
	stock: {
		porVariante: {},
		minimoAlerta: "",
		diasExtraSinStock: "",
	},
	envio: {
		pesoPorTalla: {},
		caja: { largo: "", ancho: "", alto: "" },
	},
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
	printSides?: {
		sideKey: string;
		widthCm: number;
		heightCm: number;
		dpi?: number;
		sangradoCm?: number;
	}[];
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
	existencias?: Record<string, number>;
	minimoAlerta?: number;
	diasExtraSinStock?: number;
	pesoPorTalla?: Record<string, number>;
	caja?: { largo: number; ancho: number; alto: number } | null;
	fotosReales?: FotoDePrenda[];
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
			// Vacío y no cero: el campo tiene que poder quedarse en blanco, que es
			// lo normal, sin que aparezca un 0 que invita a borrarlo.
			sangradoCm: s.sangradoCm ?? "",
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
		fotosReales: p.fotosReales ?? [],
		pricing: {
			basePrice: precios.basePrice ?? "",
			perSidePrice: precios.perSidePrice ?? "",
			perDesignPrice: precios.perDesignPrice ?? "",
			perColorPrice: precios.perColorPrice ?? "",
			embroideryExtra: precios.embroideryExtra ?? "",
		},
		diasProduccion: p.production?.meta?.diasProduccion ?? "",
		stock: {
			porVariante: p.existencias ?? {},
			minimoAlerta: p.minimoAlerta ?? "",
			diasExtraSinStock: p.diasExtraSinStock ?? "",
		},
		envio: {
			pesoPorTalla: p.pesoPorTalla ?? {},
			caja: {
				largo: p.caja?.largo ?? "",
				ancho: p.caja?.ancho ?? "",
				alto: p.caja?.alto ?? "",
			},
		},
	};
}

/**
 * "Playera cuello redondo 180g" → "playera-cuello-redondo-180g"
 *
 * Los acentos los quita `sinAcentos`, que arma el rango en tiempo de ejecución.
 * Aquí estaban escritos como caracteres literales dentro de la expresión, que
 * es justo lo que el repo lleva avisando desde los slugs: la línea deja de ser
 * ASCII y el resultado pasa a depender de con qué codificación se guarde el
 * archivo.
 */
export function aSlug(nombre: string) {
	return sinAcentos(nombre)
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
			/* Aquí SÍ vale el cero, al revés que el ancho y el alto: "sin
			   sangrado" es una respuesta legítima y la más común. Poner un valor
			   por defecto haría desbordar arte a productos donde el estampado no
			   llega al borde, y eso se recorta contra la prenda.
			
			   CON TOPE porque este número dimensiona el ARCHIVO: el PNG sale
			   `(ancho + 2·sangrado)` a los DPI del taller, así que un 100 mal
			   tecleado no da un aviso, da un archivo de cientos de megas que
			   revienta el tope de subida después de que el cliente ya pagó. Dos
			   centímetros por lado es más de lo que pide cualquier sublimación. */
			sangradoCm: Math.min(2, Math.max(0, Number(s.sangradoCm) || 0)),
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
		/* Sólo las completas. Una foto a la que le falta el cuadro no se puede
		   proyectar, y la Lambda la rechazaría entera con un error que aquí no
		   tendría a qué campo apuntar. */
		fotosReales: alta.fotosReales.filter(
			(f) =>
				f.url &&
				f.lado &&
				f.color &&
				// Una u otra, según la forma de la plantilla. Sin ninguna, la foto
				// no se puede proyectar y no se manda.
				(f.esquinas?.length === 4 || !!f.banda),
		),
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
		/**
		 * Sólo se mandan variantes que EXISTEN hoy.
		 *
		 * Si el taller quita un color, sus cantidades dejan de tener a qué
		 * referirse: arrastrarlas dejaría números fantasma que nadie ve y que
		 * reaparecerían al volver a añadir ese color, con el conteo de hace
		 * meses.
		 */
		existencias: Object.fromEntries(
			variantesDe(alta).map((v) => [
				v.clave,
				Number(alta.stock.porVariante[v.clave] ?? 0) || 0,
			]),
		),
		minimoAlerta: cifra(alta.stock.minimoAlerta),
		diasExtraSinStock: cifra(alta.stock.diasExtraSinStock),

		/**
		 * Igual que las existencias: sólo las tallas que existen hoy. Y sólo
		 * las que traen peso — la Lambda rechaza un cero, así que mandar las
		 * vacías tumbaría el guardado entero por una talla sin pesar.
		 */
		pesoPorTalla: Object.fromEntries(
			tallasDe(alta)
				.map((t) => [t, Number(alta.envio.pesoPorTalla[t] ?? 0) || 0])
				.filter(([, g]) => (g as number) > 0),
		),
		// La caja va entera o no va: una caja a medias no sirve para cotizar y
		// la Lambda la rechaza campo por campo.
		caja:
			alta.envio.caja.largo && alta.envio.caja.ancho && alta.envio.caja.alto
				? {
						largo: Number(alta.envio.caja.largo),
						ancho: Number(alta.envio.caja.ancho),
						alto: Number(alta.envio.caja.alto),
					}
				: undefined,
	};
}

/** Las tallas capturadas, sin repetir ni vacías. */
export function tallasDe(alta: Alta) {
	return [...new Set(alta.sizes.map((t) => t.size.trim()).filter(Boolean))];
}

/**
 * Las variantes que hay que contar: colores × tallas.
 *
 * Sin colores capturados —hoy es el caso de casi todos los productos— la
 * variante es sólo la talla. Es el mismo criterio que usa la Lambda al
 * descontar; si los dos se separan, el pedido resta de una llave que el
 * inventario no tiene.
 */
export function variantesDe(alta: Alta) {
	const tallas = alta.sizes.map((t) => t.size.trim()).filter(Boolean);
	const colores = alta.colors.map((c) => c.name.trim()).filter(Boolean);

	if (colores.length === 0) {
		return tallas.map((talla) => ({
			clave: claveVariante(null, talla),
			color: null,
			talla,
		}));
	}

	return colores.flatMap((color) =>
		tallas.map((talla) => ({
			clave: claveVariante(color, talla),
			color,
			talla,
		})),
	);
}
