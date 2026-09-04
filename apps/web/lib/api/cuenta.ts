import { tokenVigente } from "@/lib/auth/comprador";
import type { ArticuloDeCarrito } from "@/lib/carrito/almacen";
import type { PedidoEnSeguimiento } from "./pedir";

/**
 * La API de la cuenta del comprador.
 *
 * Va DIRECTO a API Gateway, sin pasar por un route handler de Next: el permiso
 * lo lleva el token de la propia persona, no un secreto nuestro. Es el mismo
 * trato que `proveedores.ts`, y lo contrario de `admin.ts`, que sí necesita el
 * puente porque la llave del admin no puede entrar al bundle.
 */

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

export class ErrorCuenta extends Error {
	constructor(
		readonly status: number,
		mensaje: string,
	) {
		super(mensaje);
		this.name = "ErrorCuenta";
	}

	/** La sesión caducó o el correo no está verificado: hay que volver a entrar. */
	get hayQueEntrar() {
		return this.status === 401 || this.status === 403;
	}
}

async function pedir<T>(
	ruta: string,
	opciones: { metodo?: string; cuerpo?: unknown } = {},
): Promise<T> {
	const token = await tokenVigente();

	// Sin token no se hace la llamada: mandarla igual devolvería un 401 desde
	// AWS y se pagaría el viaje para enterarnos de algo que ya sabíamos.
	if (!token) throw new ErrorCuenta(401, "No has iniciado sesión");

	let res: Response;
	try {
		res = await fetch(`${API}${ruta}`, {
			method: opciones.metodo ?? "GET",
			headers: {
				authorization: `Bearer ${token}`,
				...(opciones.cuerpo ? { "content-type": "application/json" } : {}),
			},
			body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
		});
	} catch {
		throw new ErrorCuenta(0, "No pudimos conectar con el servidor");
	}

	if (!res.ok) {
		const dato = await res.json().catch(() => ({}));
		throw new ErrorCuenta(res.status, dato.message ?? `Error ${res.status}`);
	}

	return res.status === 204 ? (null as T) : await res.json();
}

/* ─── Pedidos ───────────────────────────────────────────────────────────── */

/**
 * Un pedido es el MISMO objeto se llegue por donde se llegue.
 *
 * Lo devuelven dos rutas —ésta con la sesión, y la pública con el token del
 * enlace— y las dos leen el mismo ítem de DynamoDB. Un segundo tipo aquí sólo
 * serviría para que las dos formas se separaran con el tiempo sin que nadie se
 * entere.
 */
export type { PedidoEnSeguimiento as PedidoDelComprador } from "./pedir";

export const ESTADOS_PEDIDO = {
	nuevo: { texto: "Recibido", tono: "lima" },
	produccion: { texto: "En producción", tono: "lavanda" },
	listo: { texto: "Listo", tono: "lima" },
	enviado: { texto: "En camino", tono: "lavanda" },
	entregado: { texto: "Entregado", tono: "gris" },
	cancelado: { texto: "Cancelado", tono: "rojo" },
} as const;

export const getMisPedidos = () =>
	pedir<PedidoEnSeguimiento[]>("/cuenta/pedidos");

/**
 * Un pedido propio, SIN el token del enlace.
 *
 * Es lo que hace que "Ver detalle" funcione desde el panel: la sesión ya dice
 * quién eres, y la Lambda comprueba que el pedido sea tuyo comparando el
 * correo. El token del correo sigue existiendo para quien pidió sin cuenta.
 */
export const getMiPedido = (id: string) =>
	pedir<PedidoEnSeguimiento>(`/cuenta/pedidos/${encodeURIComponent(id)}`);

/* ─── Perfil ────────────────────────────────────────────────────────────── */

export type Direccion = {
	calle: string;
	numero: string;
	interior: string | null;
	colonia: string;
	ciudad: string;
	estado: string;
	cp: string;
	referencias: string | null;
};

export type PerfilDelComprador = {
	id: string;
	nombre: string | null;
	whatsapp: string | null;
	direccion: Direccion | null;
	creadoEn: string | null;
};

/* ─── Plantillas: la receta de un pedido que se repite ──────────────────── */

export type ItemDePlantilla = {
	productoId: string;
	/** De qué línea de qué pedido sale el arte. Nulo = se diseña al cargarla. */
	origen: { pedidoId: string; lineaId: string } | null;
	/**
	 * El arte PROPIO de la plantilla, en `medios/plantillas/`. Lo pone el
	 * editor al diseñar desde aquí, y manda sobre el del pedido: es el que se
	 * hizo para esta combinación.
	 */
	itemId?: string | null;
	lados?: {
		lado: string;
		anchoPx: number;
		altoPx: number;
		dpi: number;
		/** Cuánto del archivo es sangrado. La ficha del taller lo resta. */
		sangradoCm?: number;
	}[];
	miniatura?: string | null;
	colorPrenda: string | null;
	tallas: { size: string; piezas: number }[];
	/** Copia del nombre del producto, sólo para reconocerla en la lista. */
	nombre: string | null;
};

export type Plantilla = {
	id: string;
	nombre: string;
	items: ItemDePlantilla[];
	vecesPedida: number;
	ultimaVez: string | null;
	creadaEn: string;
	actualizadaEn: string;
};

/** Lo que devuelve cargarla: tres montones, no uno. */
export type CargaDePlantilla = {
	articulos: ArticuloDeCarrito[];
	porDisenar: {
		productoId: string;
		nombre: string | null;
		tallas: { size: string; piezas: number }[];
		porque: "todavia_sin_diseno" | "sin_archivos";
	}[];
	perdidos: { productoId: string; nombre: string | null }[];
};

export const getMisPlantillas = () => pedir<Plantilla[]>("/cuenta/plantillas");

export const crearPlantilla = (datos: {
	nombre: string;
	items: ItemDePlantilla[];
}) => pedir<Plantilla>("/cuenta/plantillas", { metodo: "POST", cuerpo: datos });

export const guardarPlantilla = (
	id: string,
	datos: { nombre: string; items: ItemDePlantilla[] },
) =>
	pedir<Plantilla>(`/cuenta/plantillas/${encodeURIComponent(id)}`, {
		metodo: "PATCH",
		cuerpo: datos,
	});

export const borrarPlantilla = (id: string) =>
	pedir<{ ok: true }>(`/cuenta/plantillas/${encodeURIComponent(id)}`, {
		metodo: "DELETE",
	});

/** POST y no GET: copia archivos en S3 y anota el uso de la plantilla. */
export const cargarPlantillaAlCarrito = (id: string) =>
	pedir<CargaDePlantilla>(
		`/cuenta/plantillas/${encodeURIComponent(id)}/carrito`,
		{ metodo: "POST" },
	);

/**
 * Sube el arte de un ítem de plantilla.
 *
 * NO ES `subirAlCarrito`, aunque haga lo mismo. Aquella firma contra
 * `carritos/`, que caduca a los 30 días; ésta contra `medios/plantillas/`, que
 * no caduca — que es la razón de que una plantilla pueda existir sin haber
 * pedido nada. Y va detrás de sesión, porque escribe en algo permanente.
 *
 * Se firma ANTES de subir y con el tamaño exacto: S3 rechaza la subida si el
 * `content-length` no coincide, así que el tope no es una promesa.
 */
export async function subirArteDePlantilla(
	archivos: {
		tipo: "arte" | "colocacion" | "prenda" | "diseno";
		lado?: string;
		cuerpo: Blob;
	}[],
) {
	const { itemId, subidas } = await pedir<{
		itemId: string;
		subidas: {
			tipo: string;
			lado: string | null;
			ruta: string;
			uploadUrl: string;
		}[];
	}>("/cuenta/plantillas/subidas", {
		metodo: "POST",
		cuerpo: {
			archivos: archivos.map((a) => ({
				tipo: a.tipo,
				lado: a.lado,
				bytes: a.cuerpo.size,
			})),
		},
	});

	await Promise.all(
		archivos.map(async (a, i) => {
			const destino = subidas[i];
			if (!destino) throw new Error("Falta a dónde subir un archivo");

			const res = await fetch(destino.uploadUrl, {
				method: "PUT",
				// Exactamente el tipo que se firmó, o S3 rechaza la firma.
				headers: {
					"Content-Type":
						a.tipo === "diseno" ? "application/json" : "image/png",
				},
				body: a.cuerpo,
			});

			if (!res.ok) throw new Error(`No se pudo subir el arte (${res.status})`);
		}),
	);

	return { itemId };
}

/* ─── Los favoritos de quien tiene sesión ───────────────────────────────
   Igual que el carrito: sin sesión viven sólo en el navegador; con ella se
   guardan además aquí, y al entrar se funden los dos. Sólo viajan ids — el
   nombre y la foto salen del catálogo al pintarlos. */

export const getFavoritosDeLaCuenta = () =>
	pedir<{ ids: string[] }>("/cuenta/favoritos");

export const guardarFavoritosEnLaCuenta = (ids: string[]) =>
	pedir<{ ids: string[] }>("/cuenta/favoritos", {
		// PATCH y no PUT, por lo mismo que el carrito.
		metodo: "PATCH",
		cuerpo: { ids },
	});

/* ─── El carrito de quien tiene sesión ──────────────────────────────────
   Sin sesión el carrito vive sólo en el navegador; con ella se guarda además
   aquí para encontrarlo desde otro aparato. Al entrar se funden los dos. */

export const getCarritoDeLaCuenta = () =>
	pedir<{ articulos: ArticuloDeCarrito[] }>("/cuenta/carrito");

export const guardarCarritoEnLaCuenta = (articulos: ArticuloDeCarrito[]) =>
	pedir<{ articulos: ArticuloDeCarrito[] }>("/cuenta/carrito", {
		// PATCH y no PUT: la API Gateway declara una ruta por método y PUT no
		// está entre los suyos. Se guarda entero igual.
		metodo: "PATCH",
		cuerpo: { articulos },
	});

export const vaciarCarritoDeLaCuenta = () =>
	pedir<null>("/cuenta/carrito", { metodo: "DELETE" });

export const getMiPerfil = () => pedir<PerfilDelComprador>("/cuenta/perfil");

export const guardarMiPerfil = (perfil: {
	nombre: string;
	whatsapp?: string | null;
	direccion?: Partial<Direccion> | null;
}) =>
	pedir<PerfilDelComprador>("/cuenta/perfil", {
		metodo: "PATCH",
		cuerpo: perfil,
	});

/* ─── Diseños guardados ─────────────────────────────────────────────────── */

/**
 * Un diseño al que su dueño le puso nombre.
 *
 * Nace ascendiendo una línea de pedido, no desde el editor: así quien compra
 * una vez no ve un concepto nuevo, y quien repite lo tiene arriba.
 */
export type DisenoGuardado = {
	id: string;
	nombre: string;
	productoId: string;
	producto: string;
	colorPrenda: string | null;
	lados: string[];
	/** Ruta del JSON en S3. Es lo que abre el editor con `?diseno=`. */
	diseno: string;
	miniatura: string | null;
	origen: { pedidoId: string; lineaId: string };
	vecesPedido: number;
	ultimoPedido: string;
	creadoEn: string;
};

export const getMisDisenos = () => pedir<DisenoGuardado[]>("/cuenta/disenos");

export const guardarDiseno = (datos: {
	nombre: string;
	pedidoId: string;
	lineaId: string;
}) =>
	pedir<DisenoGuardado>("/cuenta/disenos", { metodo: "POST", cuerpo: datos });

export const renombrarDiseno = (id: string, nombre: string) =>
	pedir<DisenoGuardado>(`/cuenta/disenos/${encodeURIComponent(id)}`, {
		metodo: "PATCH",
		cuerpo: { nombre },
	});

export const borrarDiseno = (id: string) =>
	pedir<{ borrado: true }>(`/cuenta/disenos/${encodeURIComponent(id)}`, {
		metodo: "DELETE",
	});

/** El enlace que abre un diseño en el editor, listo para volver a pedirlo. */
export function enlaceParaRediseñar(d: { productoId: string; diseno: string }) {
	return `/design/${encodeURIComponent(d.productoId)}?diseno=${encodeURIComponent(d.diseno)}`;
}

/* ─── Repetir un pedido ─────────────────────────────────────────────────── */

/**
 * Qué cambió desde que se hizo el pedido.
 *
 * Cuatro casos y cada uno se resuelve distinto: `igual` sigue, `precio` y
 * `plazo` avisan, y `no_disponible` OBLIGA a decidir. Es el único que no puede
 * pasar callando.
 */
export type LineaRepetida = {
	lineaId: string;
	productoId: string;
	producto: string;
	colorPrenda: string | null;
	lados: string[];
	tallas: { size: string; piezas: number }[];
	piezas: number;
	diseno: string | null;
	miniatura: string | null;
	estado: "igual" | "precio" | "plazo" | "no_disponible";
	porque: string | null;
	proveedorId: string | null;
	importe: number;
	importeAntes: number;
	unitario?: number;
	unitarioAntes?: number;
	dias: number | null;
	diasAntes: number | null;
};

export type PedidoRepetido = {
	pedidoId: string;
	folio: string | null;
	hechoEn: string | null;
	totalAntes: number;
	totalAhora: number;
	/** Cuántos talleres, para decir cuántos pedidos van a salir. */
	talleres: number;
	lineas: LineaRepetida[];
};

/**
 * NO crea nada: es una lectura y una diferencia. El pedido se sigue creando
 * por el camino de siempre, para que no existan dos sitios donde se decide un
 * precio.
 */
export const repetirPedido = (id: string) =>
	pedir<PedidoRepetido>(`/cuenta/pedidos/${encodeURIComponent(id)}/repetir`);

/**
 * Deja las líneas elegidas en el carrito.
 *
 * El arte NO pasa por aquí: la Lambda lo copia dentro de S3 y devuelve
 * artículos ya apuntando a su carpeta nueva. Por eso esto es rápido aunque la
 * repetición lleve cinco líneas de varios MB cada una.
 *
 * `descartadas` es lo que se cayó ENTRE que se miró la pantalla y se pulsó el
 * botón. Casi siempre viene vacío, pero cuando no, hay que decirlo: si no, se
 * agregan tres de cuatro líneas y nadie se entera hasta pagar.
 */
export const armarRepeticion = (id: string, lineas: string[]) =>
	pedir<{
		articulos: ArticuloRepetido[];
		descartadas: { producto: string; porque: string | null }[];
	}>(`/cuenta/pedidos/${encodeURIComponent(id)}/repetir`, {
		metodo: "POST",
		cuerpo: { lineas },
	});

/** Lo que devuelve la Lambda: un artículo sin `id` ni `agregadoEn`, que los
 *  pone el almacén del navegador al guardarlo. */
export type ArticuloRepetido = Omit<
	ArticuloDeCarrito,
	"id" | "agregadoEn" | "proveedorNombre"
> & { proveedorNombre?: string | null };

/* ─── La biblioteca de imágenes ─────────────────────────────────────────── */

export type ImagenGuardada = {
	id: string;
	/** Ruta relativa (`/medios/imagenes/…`). Ver por qué en el servidor. */
	url: string;
	nombre: string;
	ancho: number | null;
	alto: number | null;
	creadaEn: string;
};

export const getMisImagenes = () => pedir<ImagenGuardada[]>("/cuenta/imagenes");

export const borrarImagen = (id: string) =>
	pedir<{ ok: true }>(`/cuenta/imagenes/${encodeURIComponent(id)}`, {
		metodo: "DELETE",
	});

/**
 * Sube una imagen a la biblioteca y devuelve su ficha.
 *
 * SON TRES PASOS y no uno: el servidor firma, el navegador sube DIRECTO a S3 y
 * después se anota. El archivo no pasa por la Lambda —una foto de 10 MB en
 * base64 no cabe en una petición de API Gateway— y el registro se escribe al
 * final para que un fallo a mitad de la subida no deje la biblioteca
 * enseñando una imagen rota.
 *
 * EL TAMAÑO VIAJA EN LA FIRMA, así que S3 rechaza la subida si no coincide con
 * lo que se declaró. No es una comprobación de cortesía.
 */
export async function guardarImagen(archivo: File): Promise<ImagenGuardada> {
	const destino = await pedir<{ id: string; uploadUrl: string; url: string }>(
		"/cuenta/imagenes/subidas",
		{
			metodo: "POST",
			cuerpo: { tipo: archivo.type, bytes: archivo.size },
		},
	);

	const subida = await fetch(destino.uploadUrl, {
		method: "PUT",
		headers: { "content-type": archivo.type },
		body: archivo,
	});

	if (!subida.ok) {
		throw new ErrorCuenta(subida.status, "No pudimos subir esa imagen.");
	}

	const medida = await medirImagen(archivo);

	return pedir<ImagenGuardada>("/cuenta/imagenes", {
		metodo: "POST",
		cuerpo: {
			id: destino.id,
			url: destino.url,
			nombre: archivo.name,
			...medida,
		},
	});
}

/**
 * El ancho y el alto, para poder pintar la rejilla sin saltos.
 *
 * Si falla se devuelven ceros: es un dato de presentación y no vale la pena
 * tumbar una subida que ya terminó porque el navegador no supo decodificar la
 * imagen fuera del lienzo.
 */
async function medirImagen(archivo: File) {
	try {
		const mapa = await createImageBitmap(archivo);
		const medida = { ancho: mapa.width, alto: mapa.height };
		mapa.close();
		return medida;
	} catch {
		return { ancho: 0, alto: 0 };
	}
}
