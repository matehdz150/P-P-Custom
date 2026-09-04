"use client";

/**
 * La plantilla que se está armando, mientras se arma.
 *
 * POR QUÉ EXISTE. Diseñar un producto saca de la pantalla: el editor es una
 * página entera, no un cuadro. Sin un sitio donde dejar lo que ya se eligió,
 * volver del editor significaría empezar de cero.
 *
 * VA EN `localStorage` Y NO EN LA CUENTA, a propósito. Es un borrador de unos
 * minutos, no un dato: guardarlo en el servidor obligaría a crear plantillas a
 * medias que después hay que limpiar, y a decidir qué pasa con las que nadie
 * termina. El arte SÍ está ya en S3 —eso es lo que cuesta— y esto son cuatro
 * campos que lo señalan.
 *
 * SE BORRA AL GUARDAR la plantilla de verdad. Si alguien lo abandona, lo peor
 * que queda son unas rutas en su navegador y arte en `medios/plantillas/` que
 * nadie referencia; es el mismo trato que el carrito hace con `carritos/`.
 */

const CLAVE = "kustto.plantilla-borrador";

export type ItemDeBorrador = {
	/**
	 * Identifica la fila DENTRO de este borrador, y nada más: no viaja al
	 * servidor. Existe porque diseñar saca de la pantalla y hay que saber a
	 * cuál de las filas pertenece el arte que vuelve. Sin esto el editor sólo
	 * podía añadir, y ponerle diseño a un producto que ya estaba en la lista
	 * lo dejaba duplicado: el hueco vacío y la copia con arte.
	 */
	clave: string;
	productoId: string;
	nombre: string | null;
	colorPrenda: string | null;
	tallas: { size: string; piezas: number }[];
	origen: { pedidoId: string; lineaId: string } | null;
	/** Dónde quedó su arte, si ya se diseñó. Nulo = falta diseñarlo. */
	itemId: string | null;
	lados: {
		lado: string;
		anchoPx: number;
		altoPx: number;
		dpi: number;
		/** Cuánto del archivo es sangrado. La ficha del taller lo resta. */
		sangradoCm?: number;
	}[];
	miniatura: string | null;
};

export type BorradorDePlantilla = {
	/**
	 * Qué plantilla se está armando: nula, una nueva; con id, se está editando
	 * una que ya existe.
	 *
	 * Sin esto los dos borradores serían el mismo: entrar a editar el kit de
	 * bienvenida después de dejar una plantilla nueva a medias habría mezclado
	 * los productos de las dos, y el editor no sabría a cuál devolver el arte.
	 */
	plantillaId: string | null;
	nombre: string;
	items: ItemDeBorrador[];
};

const VACIO: BorradorDePlantilla = { plantillaId: null, nombre: "", items: [] };

export function leerBorradorDePlantilla(): BorradorDePlantilla {
	if (typeof window === "undefined") return VACIO;

	try {
		const crudo = localStorage.getItem(CLAVE);
		const b = crudo ? JSON.parse(crudo) : null;

		return {
			plantillaId: typeof b?.plantillaId === "string" ? b.plantillaId : null,
			nombre: typeof b?.nombre === "string" ? b.nombre : "",
			// La clave se repone al leer: un borrador guardado antes de que
			// existiera no la tiene, y sin ella el editor no sabría a qué fila
			// vuelve.
			items: Array.isArray(b?.items)
				? b.items.map((i: ItemDeBorrador) => ({
						...i,
						clave: i.clave || nuevaClave(),
					}))
				: [],
		};
	} catch {
		// Un borrador ilegible no debe tumbar la pantalla: se empieza de cero.
		return VACIO;
	}
}

export function escribirBorradorDePlantilla(b: BorradorDePlantilla) {
	if (typeof window === "undefined") return;

	try {
		localStorage.setItem(CLAVE, JSON.stringify(b));
	} catch {
		console.warn("No cupo el borrador de la plantilla en el navegador.");
	}
}

export function borrarBorradorDePlantilla() {
	if (typeof window === "undefined") return;
	localStorage.removeItem(CLAVE);
}

export function nuevaClave() {
	return crypto.randomUUID();
}

/**
 * A dónde vuelve el editor cuando termina de diseñar para una plantilla.
 *
 * Lo decide el borrador y no el editor, que no tiene por qué saber de esto:
 * armando una nueva se vuelve al constructor vacío y editando una guardada, a
 * la suya. Con la ruta equivocada el arte se sube bien y aterriza en una
 * pantalla que no lo enseña, que se lee como si se hubiera perdido.
 */
export function rutaDelBorrador() {
	const { plantillaId } = leerBorradorDePlantilla();

	return plantillaId
		? `/cuenta?s=plantillas&editar=${encodeURIComponent(plantillaId)}`
		: "/cuenta?s=plantillas&nueva=1";
}

/**
 * Deja el arte recién subido en la fila que le toca. Lo llama el editor.
 *
 * Con `clave` se está EDITANDO una fila que ya estaba en la lista: se le pega
 * el diseño encima y se le respetan las tallas, que es lo que la persona ya
 * ajustó viendo el conjunto. Sin `clave` se viene de diseñar suelto y la fila
 * se añade al final.
 */
export function guardarEnBorrador(
	clave: string | null,
	datos: Omit<ItemDeBorrador, "clave">,
) {
	const b = leerBorradorDePlantilla();
	const anterior = clave ? b.items.find((i) => i.clave === clave) : null;

	if (!anterior) {
		escribirBorradorDePlantilla({
			...b,
			items: [...b.items, { ...datos, clave: nuevaClave() }],
		});
		return;
	}

	escribirBorradorDePlantilla({
		...b,
		items: b.items.map((i) =>
			i.clave === clave ? { ...datos, clave, tallas: i.tallas } : i,
		),
	});
}
