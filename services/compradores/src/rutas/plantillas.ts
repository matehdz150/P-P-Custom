import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
	consultarTodo,
	dynamo,
	llaves,
	sinLlaves,
	TABLA,
} from "../lib/dynamo.js";
import { malaPeticion, noEncontrado } from "../lib/http.js";
import { copiar } from "../lib/medios.js";

const s3 = new S3Client({});
const BUCKET_PUBLICO =
	process.env.KUSTTO_BUCKET_PUBLICO ?? "kustto-publico-prod";

import {
	aArticuloDeCarrito,
	correoDe,
	type Identidad,
	precioDeHoy,
} from "./pedidos.js";

/**
 * Las plantillas del comprador: la receta de un pedido que se repite.
 *
 * QUÉ RESUELVE. Una empresa pide el mismo kit de bienvenida cada vez que entra
 * alguien —playera, tote y termo, con su logo, en cantidades parecidas— y hoy
 * no hay dónde guardar ESA COMBINACIÓN. `Repetir` clona un pedido pasado tal
 * cual, que no es lo mismo: la receta se repite con otras tallas y otras
 * cantidades. Los diseños guardan el arte de UN producto. Los favoritos, ids
 * sueltos. La composición no la guardaba nada.
 *
 * NO GUARDA ARTE, APUNTA A LA LÍNEA DE PEDIDO DE DONDE SALIÓ. Es la decisión
 * de fondo, y costó dos intentos:
 *
 *   El arte del carrito vive en `carritos/` y CADUCA A LOS 30 DÍAS
 *   (infra/buckets.sh), así que referenciarlo dejaría la plantilla muda al mes.
 *
 *   Apuntar a un DISEÑO GUARDADO tampoco sirve para pedir, aunque lo parezca:
 *   `disenos.guardar` copia el JSON editable y una miniatura de colocación,
 *   **no el arte de producción**. Por eso un diseño guardado abre el editor en
 *   vez de ir al carrito — hay que re-exportarlo.
 *
 * Lo que sí es duradero Y pedible es `medios/pedidos/<pedido>/<linea>-<lado>.png`,
 * que es justo de donde copia `pedidos.alCarrito` al repetir un pedido. Una
 * plantilla guarda ese origen y al cargarla reutiliza ese camino, ya probado.
 *
 * Un ítem SIN origen es válido y normal: "esta playera, estas tallas", sin arte
 * todavía. Es lo que permite armar una plantilla desde el catálogo antes de
 * haber pedido nunca; al cargarla, ese ítem pasa por el editor.
 *
 * NO SE VALIDA CONTRA EL CATÁLOGO, igual que el carrito y los favoritos. Una
 * plantilla vive años y los productos van y vienen; rechazar el guardado
 * dejaría a alguien sin poder ni editar la suya para quitar lo que ya no
 * existe. Lo que de verdad decide —que el producto siga publicado y a qué
 * precio— se comprueba al cargarla y al crear el pedido.
 */

const MAX_NOMBRE = 60;
/** Una plantilla es una receta, no un catálogo. */
const MAX_ITEMS = 20;
/** Tope alto pero real: sin él, un bucle deja la partición inservible. */
const MAX_PLANTILLAS = 50;

/** Ids nuestros y de producto. Nada de esto sale a una ruta ni a una llave. */
const ID = /^[a-zA-Z0-9_-]{1,64}$/;

type Cuerpo = Record<string, any>;

export async function listar(quien: Identidad) {
	const { pk, prefijo } = llaves.plantillasDe(quien.sub);

	const items = await consultarTodo({
		TableName: TABLA,
		KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
		ExpressionAttributeValues: { ":pk": pk, ":sk": prefijo },
		// Del más reciente al más viejo por id, que empieza por la fecha.
		ScanIndexForward: false,
	});

	return items.map(sinLlaves);
}

/**
 * Lee lo que el cliente manda como contenido de una plantilla.
 *
 * Se limpia campo por campo en vez de guardar el cuerpo tal cual: esto acaba
 * en un ítem de DynamoDB que después se relee para armar un carrito, y un
 * cuerpo sin filtrar es la forma de que aparezca ahí un `precio` que nadie
 * puso. El precio y el taller NUNCA salen de aquí: se leen del producto al
 * cargar la plantilla, como en el checkout.
 */
function leerContenido(c: Cuerpo) {
	const nombre = String(c.nombre ?? "").trim();
	if (!nombre) throw malaPeticion("Ponle un nombre para poder encontrarla");
	if (nombre.length > MAX_NOMBRE) {
		throw malaPeticion(`El nombre no puede pasar de ${MAX_NOMBRE} caracteres`);
	}

	const crudos = Array.isArray(c.items) ? c.items : [];
	if (crudos.length === 0) {
		throw malaPeticion("Una plantilla vacía no sirve para nada: ponle algo");
	}
	if (crudos.length > MAX_ITEMS) {
		throw malaPeticion(`Una plantilla no admite más de ${MAX_ITEMS} productos`);
	}

	const items = crudos.map((crudo: Cuerpo, i: number) => {
		const productoId = String(crudo?.productoId ?? "").trim();
		if (!ID.test(productoId)) {
			throw malaPeticion(`Al producto ${i + 1} le falta su identificador`);
		}

		/* De qué línea de qué pedido sale el arte. Los dos o ninguno: media
		   referencia no lleva a ningún archivo. */
		const pedidoId = String(crudo?.origen?.pedidoId ?? "").trim();
		const lineaId = String(crudo?.origen?.lineaId ?? "").trim();

		if ((pedidoId || lineaId) && !(ID.test(pedidoId) && ID.test(lineaId))) {
			throw malaPeticion(`El origen del producto ${i + 1} no es válido`);
		}

		const tallas = (Array.isArray(crudo?.tallas) ? crudo.tallas : [])
			.map((t: Cuerpo) => ({
				size: String(t?.size ?? "").trim(),
				piezas: Math.floor(Number(t?.piezas ?? 0)),
			}))
			.filter((t: { size: string; piezas: number }) => t.size && t.piezas > 0);

		if (tallas.length === 0) {
			throw malaPeticion(`Al producto ${i + 1} le faltan las cantidades`);
		}

		/* El arte propio de la plantilla, subido al diseñarla desde aquí. Vive
		   en `medios/plantillas/<sub>/<itemId>/` y no caduca. Se guardan las
		   rutas y los PÍXELES de cada lado: el tamaño impreso sale de cuántos
		   píxeles tiene el archivo, no de los centímetros del área, que pueden
		   cambiar en el producto. */
		const lados = (Array.isArray(crudo?.lados) ? crudo.lados : [])
			.map((l: Cuerpo) => ({
				lado: String(l?.lado ?? "").trim(),
				anchoPx: Math.trunc(Number(l?.anchoPx ?? 0)),
				altoPx: Math.trunc(Number(l?.altoPx ?? 0)),
				dpi: Math.trunc(Number(l?.dpi ?? 0)) || 300,
			}))
			.filter((l: { lado: string }) => l.lado);

		const itemId = String(crudo?.itemId ?? "").trim();
		if (itemId && !ID.test(itemId)) {
			throw malaPeticion(`El arte del producto ${i + 1} no es válido`);
		}

		return {
			productoId,
			/* De dónde sale el arte, en este orden: el propio de la plantilla, o
			   la línea de un pedido. Nulo los dos = ese ítem pasa por el editor
			   al cargarla. */
			itemId: itemId && lados.length > 0 ? itemId : null,
			lados: itemId && lados.length > 0 ? lados : [],
			miniatura: String(crudo?.miniatura ?? "").trim() || null,
			origen: pedidoId ? { pedidoId, lineaId } : null,
			colorPrenda: String(crudo?.colorPrenda ?? "").trim() || null,
			tallas,
			/* Sólo para reconocerla en la lista sin ir a buscar el producto. Es
			   descriptivo: si el taller le cambia el nombre, aquí queda el viejo
			   y no pasa nada — lo que se cobra sale del producto, no de aquí. */
			nombre:
				String(crudo?.nombre ?? "")
					.trim()
					.slice(0, 120) || null,
		};
	});

	return { nombre, items };
}

export async function crear(quien: Identidad, cuerpo: unknown) {
	const { nombre, items } = leerContenido((cuerpo ?? {}) as Cuerpo);

	const yaTiene = await listar(quien);
	if (yaTiene.length >= MAX_PLANTILLAS) {
		throw malaPeticion(
			`Ya tienes ${MAX_PLANTILLAS} plantillas. Borra alguna para crear otra.`,
		);
	}

	/* El id empieza por la fecha para que ordenen solas por `sk`, pero SIN los
	   dos puntos ni los puntos del ISO — misma razón que en los diseños: acaba
	   en una URL y ahí `:` obliga a codificar. */
	const cuando = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
	const id = `${cuando}-${randomUUID().slice(0, 8)}`;
	const ahora = new Date().toISOString();

	const item = {
		...llaves.plantilla(quien.sub, id),
		id,
		nombre,
		items,
		/** Cuántas veces se pidió. Lo sube quien la carga, no esto. */
		vecesPedida: 0,
		ultimaVez: null,
		creadaEn: ahora,
		actualizadaEn: ahora,
	};

	await dynamo.send(new PutCommand({ TableName: TABLA, Item: item }));
	return sinLlaves(item);
}

async function suyaOFalla(quien: Identidad, id: string) {
	if (!ID.test(id)) throw noEncontrado("Esa plantilla no existe");

	const { Item } = await dynamo.send(
		new GetCommand({
			TableName: TABLA,
			Key: llaves.plantilla(quien.sub, id),
		}),
	);

	// La llave lleva el `sub` del token, así que esto sólo puede fallar si no
	// existe: nunca devuelve la de otra persona.
	if (!Item) throw noEncontrado("Esa plantilla no existe");

	return Item;
}

/**
 * Guarda la plantilla entera, no un campo.
 *
 * Se edita como se lee: la pantalla tiene delante los productos y sus
 * cantidades, y manda el resultado. Un `PATCH` por campo obligaría a una
 * llamada por cada `+1`, y a resolver a mano qué pasa cuando dos llegan
 * desordenadas.
 */
export async function actualizar(
	quien: Identidad,
	id: string,
	cuerpo: unknown,
) {
	const previa = await suyaOFalla(quien, id);
	const { nombre, items } = leerContenido((cuerpo ?? {}) as Cuerpo);

	const item = {
		...previa,
		nombre,
		items,
		actualizadaEn: new Date().toISOString(),
	};

	await dynamo.send(new PutCommand({ TableName: TABLA, Item: item }));
	return sinLlaves(item);
}

export async function borrar(quien: Identidad, id: string) {
	await suyaOFalla(quien, id);

	await dynamo.send(
		new DeleteCommand({
			TableName: TABLA,
			Key: llaves.plantilla(quien.sub, id),
		}),
	);

	return { ok: true };
}

/**
 * Convierte una plantilla en artículos de carrito.
 *
 * DEVUELVE TRES MONTONES, no uno. Un ítem puede acabar de tres maneras y
 * mezclarlas sería mentir sobre lo que hace falta hacer:
 *
 *   `articulos`   listo para el carrito: tenía origen y su arte se copió.
 *   `porDisenar`  no tiene arte todavía —o la del pedido ya no está— así que
 *                 pasa por el editor. NO es un error: una plantilla armada
 *                 desde el catálogo nace entera así.
 *   `perdidos`    el producto ya no se publica. Aquí no hay nada que hacer.
 *
 * SE VUELVE A COMPARAR CONTRA EL CATÁLOGO aquí, aunque la pantalla ya lo haya
 * hecho al pintarla: entre que se miró y se pulsó pudo archivarse un producto,
 * y meter en el carrito algo que ya no se produce sólo mueve el fallo al final
 * del checkout, que es el peor sitio.
 */
export async function alCarrito(quien: Identidad, id: string) {
	const plantilla = await suyaOFalla(quien, id);
	const items = (plantilla.items ?? []) as Cuerpo[];

	const articulos = [];
	const porDisenar = [];
	const perdidos = [];

	for (const item of items) {
		/* El arte PROPIO manda sobre el del pedido: es el que se hizo para esta
		   plantilla, y el del pedido puede ser de otra combinación de tallas. */
		if (item.itemId && (item.lados ?? []).length > 0) {
			const articulo = await deArtePropio(quien, item);

			if (articulo) {
				articulos.push(articulo);
			} else {
				porDisenar.push({
					productoId: item.productoId,
					nombre: item.nombre ?? null,
					tallas: item.tallas,
					porque: "sin_archivos",
				});
			}
			continue;
		}

		const origen = item.origen as Cuerpo | null;

		if (!origen?.pedidoId) {
			porDisenar.push({
				productoId: item.productoId,
				nombre: item.nombre ?? null,
				tallas: item.tallas,
				porque: "todavia_sin_diseno",
			});
			continue;
		}

		const { Item: pedido } = await dynamo.send(
			new GetCommand({
				TableName: TABLA,
				Key: llaves.pedido(String(origen.pedidoId)),
			}),
		);

		/* El pedido tiene que seguir siendo de quien pide, no sólo existir: sin
		   esto, una plantilla con un `pedidoId` inventado sacaría el arte de
		   otra persona. La llave de la plantilla ya va por `sub`, pero el
		   pedido va por CORREO y es otro espacio. */
		const suyo =
			pedido &&
			String(pedido.comprador?.email ?? "").toLowerCase() === correoDe(quien);

		const linea = suyo
			? ((pedido.lineas ?? []) as Cuerpo[]).find(
					(l) => String(l.id) === String(origen.lineaId),
				)
			: undefined;

		if (!linea) {
			porDisenar.push({
				productoId: item.productoId,
				nombre: item.nombre ?? null,
				tallas: item.tallas,
				porque: "sin_archivos",
			});
			continue;
		}

		const comparada = await compararParaPlantilla(linea, item);

		if (!comparada) {
			perdidos.push({
				productoId: item.productoId,
				nombre: item.nombre ?? null,
			});
			continue;
		}

		const articulo = await aArticuloDeCarrito(
			String(origen.pedidoId),
			comparada,
			linea,
		);

		if (!articulo) {
			porDisenar.push({
				productoId: item.productoId,
				nombre: item.nombre ?? null,
				tallas: item.tallas,
				porque: "sin_archivos",
			});
			continue;
		}

		articulos.push(articulo);
	}

	/* Se anota el uso aquí y no al crear el pedido: cargarla es el momento en
	   que alguien decidió repetirla, y esperar al pedido dejaría sin contar a
	   quien la carga y luego cambia de idea en el checkout. */
	await dynamo.send(
		new PutCommand({
			TableName: TABLA,
			Item: {
				...plantilla,
				vecesPedida: Number(plantilla.vecesPedida ?? 0) + 1,
				ultimaVez: new Date().toISOString(),
			},
		}),
	);

	return { articulos, porDisenar, perdidos };
}

/**
 * Lo que `aArticuloDeCarrito` necesita saber de la línea, con las cantidades
 * de la PLANTILLA y no las del pedido viejo.
 *
 * Es la diferencia entre repetir y cargar una plantilla: repetir clona el
 * pedido tal cual; una plantilla guarda su propia receta de tallas, que es
 * justo lo que se ajusta entre una vez y otra.
 *
 * Devuelve `null` si el producto ya no se publica.
 */
async function compararParaPlantilla(linea: Cuerpo, item: Cuerpo) {
	const { Item: producto } = await dynamo.send(
		new GetCommand({
			TableName: TABLA,
			Key: llaves.producto(String(item.productoId)),
		}),
	);

	if (!producto || producto.estado !== "activo") return null;

	return {
		lineaId: String(linea.id ?? ""),
		productoId: String(item.productoId),
		producto: String(linea.producto ?? item.nombre ?? ""),
		proveedorId: String(linea.proveedorId ?? producto.proveedorId ?? ""),
		colorPrenda: item.colorPrenda ?? linea.colorPrenda ?? null,
		/** Las de la plantilla: es la receta, no el pedido de entonces. */
		tallas: item.tallas,
		/* El precio de HOY, con el mismo cálculo del checkout. Los lados se
		   cuentan del pedido viejo, que es de donde sale el arte que se copia.
		   Antes leía `producto.basePrice` —que no existe, está en `pricing`— y
		   se caía al `unitario` del pedido de entonces: el comentario prometía
		   el precio de hoy y entregaba el de hace meses. */
		unitario: precioDeHoy(producto, (linea.lados ?? []) as string[]),
		miniatura: (linea.arte ?? [])[0]?.colocacion ?? linea.imagen ?? null,
	};
}

/* ─── El arte de una plantilla ──────────────────────────────────────────── */

/**
 * Firma las subidas del arte de un ítem de plantilla.
 *
 * POR QUÉ NO SE REUTILIZA LA DEL CARRITO. Aquella escribe en `carritos/`, que
 * caduca a los 30 días: una plantilla armada con eso se quedaría muda al mes.
 * Ésta escribe en `medios/plantillas/<sub>/…`, que no caduca — y por eso va
 * detrás de sesión, mientras la del carrito es pública.
 *
 * EL DESTINO LO DECIDE EL SERVIDOR. El `itemId` se genera aquí y lleva el
 * `sub` del token delante: del cuerpo no sale ni un trozo de la ruta, así que
 * no hay forma de escribir en la carpeta de otra persona.
 *
 * EL TAMAÑO SE FIRMA. Va dentro de la firma, así que S3 rechaza la subida si
 * el `content-length` no coincide: sin eso el tope sería una promesa que nadie
 * aplica.
 */
const TIPOS: Record<string, string> = {
	arte: "image/png",
	colocacion: "image/png",
	/** La prenda real con el diseño encima, si el taller subió la foto. */
	prenda: "image/png",
	/**
	 * El MISMO arte en trazos, para las técnicas que no imprimen.
	 *
	 * Es un tipo APARTE y no un `arte` con otra extensión: cambiarle el nombre
	 * al archivo de siempre movería la ruta de todos los pedidos que ya existen
	 * y de las dos copias que se hacen más abajo. Así entra sin tocar nada.
	 */
	vector: "image/svg+xml",
	diseno: "application/json",
};

/** Con qué extensión se guarda cada uno. Todo era `.png` hasta que entró el láser. */
const EXTENSION: Record<string, string> = { vector: "svg", diseno: "json" };

/** Un arte de producción son varios MB; el resto, mucho menos. */
const MAXIMO: Record<string, number> = {
	arte: 25 * 1024 * 1024,
	/* Un SVG es texto y pesa poco… salvo si alguien vectorizó una foto y trae
	   cuarenta mil trazos. Ahí el tope es la defensa. */
	vector: 12 * 1024 * 1024,
	colocacion: 8 * 1024 * 1024,
	prenda: 8 * 1024 * 1024,
	diseno: 4 * 1024 * 1024,
};

/* Tres archivos por lado más el diseño. Con seis lados son diecinueve; se
   deja en dieciséis, que cubre los cuatro lados que hoy declara cualquier
   producto y sigue sin permitir subir un álbum. */
const MAXIMO_ARCHIVOS = 16;
const LIMPIO = (v: unknown) =>
	String(v ?? "")
		.replace(/[^a-zA-Z0-9-_]/g, "")
		.slice(0, 30);

export async function firmarSubidas(quien: Identidad, cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;
	const archivos = Array.isArray(c.archivos) ? c.archivos : [];

	if (archivos.length === 0) throw malaPeticion("No dijiste qué vas a subir");
	if (archivos.length > MAXIMO_ARCHIVOS) {
		throw malaPeticion(
			`Demasiados archivos de una vez (${archivos.length}). El máximo es ${MAXIMO_ARCHIVOS}.`,
		);
	}

	const itemId = randomUUID();
	const base = `medios/plantillas/${quien.sub}/${itemId}`;

	const subidas = await Promise.all(
		archivos.map(async (a: Cuerpo) => {
			const tipo = String(a?.tipo ?? "");

			if (!(tipo in MAXIMO)) {
				throw malaPeticion(
					`Tipo de archivo desconocido: ${tipo || "(vacío)"}. Usa ${Object.keys(MAXIMO).join(", ")}.`,
				);
			}

			const bytes = Math.trunc(Number(a?.bytes ?? 0));
			if (!(bytes > 0)) throw malaPeticion("Falta cuánto pesa el archivo");

			if (bytes > MAXIMO[tipo]) {
				const mb = Math.round(MAXIMO[tipo] / 1024 / 1024);
				throw malaPeticion(`Ese archivo pasa de ${mb} MB, que es el máximo`);
			}

			const lado = LIMPIO(a?.lado);
			if (tipo !== "diseno" && !lado) {
				throw malaPeticion("Falta de qué lado es el archivo");
			}

			const nombre =
				tipo === "diseno"
					? "diseno.json"
					: `${lado}-${tipo}.${EXTENSION[tipo] ?? "png"}`;
			const key = `${base}/${nombre}`;

			const uploadUrl = await getSignedUrl(
				s3,
				new PutObjectCommand({
					Bucket: BUCKET_PUBLICO,
					Key: key,
					ContentType: TIPOS[tipo],
					ContentLength: bytes,
				}),
				{ expiresIn: 900 },
			);

			return { tipo, lado: lado || null, ruta: `/${key}`, uploadUrl };
		}),
	);

	return { itemId, subidas };
}

/**
 * Un artículo de carrito a partir del arte propio de la plantilla.
 *
 * Copia de `medios/plantillas/…` a `carritos/…` igual que `aArticuloDeCarrito`
 * hace desde `medios/pedidos/…`: el carrito siempre lee de su propia carpeta,
 * que es la que se limpia sola. La plantilla conserva su original.
 *
 * Devuelve `null` si el arte de producción ya no está — sin él no hay nada que
 * imprimir, y meterlo en el carrito sólo movería el fallo al checkout.
 */
async function deArtePropio(quien: Identidad, item: Cuerpo) {
	const { Item: producto } = await dynamo.send(
		new GetCommand({
			TableName: TABLA,
			Key: llaves.producto(String(item.productoId)),
		}),
	);

	if (!producto || producto.estado !== "activo") return null;

	const base = `medios/plantillas/${quien.sub}/${item.itemId}`;
	const carritoId = randomUUID();
	const lados = [];

	for (const l of (item.lados ?? []) as Cuerpo[]) {
		const lado = String(l.lado ?? "");
		if (!lado) continue;

		const hayArte = await copiar(
			`${base}/${lado}-arte.png`,
			`carritos/${carritoId}/${lado}-arte.png`,
		);

		if (!hayArte) continue;

		await copiar(
			`${base}/${lado}-colocacion.png`,
			`carritos/${carritoId}/${lado}-colocacion.png`,
		);

		await copiar(
			`${base}/${lado}-prenda.png`,
			`carritos/${carritoId}/${lado}-prenda.png`,
		);

		// Sólo existe en productos de láser; `copiar` devuelve falso y sigue.
		await copiar(
			`${base}/${lado}-vector.svg`,
			`carritos/${carritoId}/${lado}-vector.svg`,
		);

		lados.push({
			lado,
			anchoPx: Math.trunc(Number(l.anchoPx ?? 0)),
			altoPx: Math.trunc(Number(l.altoPx ?? 0)),
			dpi: Math.trunc(Number(l.dpi ?? 0)) || 300,
		});
	}

	if (lados.length === 0) return null;

	await copiar(`${base}/diseno.json`, `carritos/${carritoId}/diseno.json`);

	return {
		carritoId,
		productoId: String(item.productoId),
		nombre: String(item.nombre ?? producto.name ?? ""),
		proveedorId: String(producto.proveedorId ?? ""),
		colorPrenda: item.colorPrenda ?? null,
		lados,
		tallas: item.tallas,
		/* El precio de HOY, como en todos los caminos al carrito, y con los
		   lados que de verdad se copiaron: son los que se van a imprimir.
		   `lados` aquí son objetos con medidas, no claves: se mapean porque
		   ahora el precio depende de CUÁL es cada lado, no de cuántos hay. */
		precioUnitario: precioDeHoy(
			producto,
			lados.map((l) => l.lado),
		),
		miniatura: item.miniatura ?? null,
	};
}
