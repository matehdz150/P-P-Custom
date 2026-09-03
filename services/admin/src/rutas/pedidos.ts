import {
	createHash,
	randomBytes,
	randomInt,
	randomUUID,
	timingSafeEqual,
} from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { enviar } from "../lib/correo.js";
import {
	dynamo,
	type EstadoPedido,
	esConflicto,
	existenciasDe,
	llaves,
	sinLlaves,
	TABLA,
	variante,
} from "../lib/dynamo.js";
import { avisarAlTaller } from "../lib/eventos.js";
import {
	conflicto,
	malaPeticion,
	noAutorizado,
	noEncontrado,
} from "../lib/http.js";
import { pedidoParaTaller, pedidoRecibido } from "../lib/plantillas.js";
import * as envios from "./envios.js";

/**
 * Los pedidos.
 *
 * Esta es la ÚNICA ruta pública que escribe. Quien pide no tiene sesión —la
 * cuenta es opcional a propósito— así que todo lo que llega es sospechoso y
 * nada de lo que decide el precio o el destinatario sale del cuerpo: el
 * producto se lee de la tabla y de ahí salen el taller y el importe.
 */

const s3 = new S3Client({});
const BUCKET_PUBLICO =
	process.env.KUSTTO_BUCKET_PUBLICO ?? "kustto-publico-prod";

/** Lo que se firma para el arte. Sólo PNG: es lo que exporta el editor. */
const VIGENCIA_SUBIDA = 900;
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Código postal mexicano: cinco dígitos, ni uno más. */
const CP = /^\d{5}$/;
/** Sólo los dígitos: la gente escribe espacios, guiones y prefijos. */
const DIGITOS = (v: string) => v.replace(/\D/g, "");

type Cuerpo = Record<string, any>;

export async function crear(cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;

	const comprador = {
		nombre: String(c.comprador?.nombre ?? "").trim(),
		email: String(c.comprador?.email ?? "")
			.trim()
			.toLowerCase(),
		whatsapp: String(c.comprador?.whatsapp ?? "").trim() || null,
		notas: String(c.comprador?.notas ?? "").trim() || null,
	};

	if (!comprador.nombre) throw malaPeticion("Falta tu nombre");
	if (!CORREO.test(comprador.email)) {
		throw malaPeticion("Hace falta un correo válido: ahí llega el seguimiento");
	}

	/* El teléfono es OBLIGATORIO y se valida AQUÍ, no sólo en el formulario.
	 *
	 * La paquetería lo exige para entregar: sin él la guía no se puede comprar,
	 * y eso no se descubre al pedir sino días después, cuando el taller va a
	 * generar la etiqueta y ya no hay a quién pedírselo. Entró un pedido así
	 * mientras el campo era opcional.
	 *
	 * Se cuentan dígitos en vez de exigir un formato: la gente escribe
	 * espacios, guiones y prefijos, y rechazar un teléfono bueno por cómo está
	 * escrito es peor que aceptarlo tal cual. */
	if (DIGITOS(comprador.whatsapp ?? "").length < 10) {
		throw malaPeticion(
			"Hace falta un teléfono de 10 dígitos: la paquetería lo exige para entregar",
		);
	}

	const entrega = leerEntrega(c.entrega);

	const lineas = Array.isArray(c.lineas) ? c.lineas : [];
	if (lineas.length === 0) throw malaPeticion("El pedido va vacío");

	// El producto manda sobre el precio y sobre a quién le toca producirlo. Si
	// esto saliera del cuerpo, cualquiera podría pedir a un peso.
	const productos = await Promise.all(
		lineas.map((l: Cuerpo) =>
			leerProductoPublicado(String(l.productoId ?? "")),
		),
	);

	/* ─── El reparto por taller ───────────────────────────────────────────
	 *
	 * Una COMPRA, y por dentro un pedido por taller. No es un pedido con
	 * líneas de varios: el taller produce, cobra y envía lo suyo, y su estado
	 * es suyo. Con un pedido compartido, "en producción" dejaría de significar
	 * algo y la separación entre talleres —que hoy impone la llave— habría que
	 * imponerla en cada lectura.
	 */
	const grupos = new Map<string, number[]>();

	productos.forEach((producto, i) => {
		const taller = String(producto.proveedorId);
		grupos.set(taller, [...(grupos.get(taller) ?? []), i]);
	});

	/* Con envío a domicilio todavía no se puede repartir: cada taller manda
	 * desde SU dirección, así que son varias cotizaciones y varios costos, y
	 * eso es el paso siguiente. Mejor decirlo que cobrar un envío que sólo
	 * cubre a uno de ellos. */
	if (grupos.size > 1 && entrega.metodo === "envio") {
		throw malaPeticion(
			"Todavía no podemos enviar productos de varios talleres en la misma compra. " +
				"Sepáralos, o elige recoger con cada taller.",
		);
	}

	const envio =
		entrega.metodo === "envio" ? await envios.envioDelPedido(c.envio) : null;

	const compraId = randomUUID();
	const ahora = new Date().toISOString();

	/* El token de seguimiento NO se guarda: se guarda su huella. Si alguien
	   llega a leer la tabla, no se lleva los enlaces de seguimiento de nadie.
	   Es la misma razón por la que la llave del admin se compara con hash.

	   Es UNO para toda la compra, y cada pedido guarda la misma huella: así el
	   enlace del correo abre la compra entera y también sirve para mirar una
	   parte suelta. */
	const token = randomBytes(24).toString("base64url");
	const tokenHuella = huella(token);

	const partes = [...grupos.entries()].map(([proveedorId, indices]) => {
		const pedidoId = randomUUID();

		// El índice ORIGINAL de la línea viaja con ella: es lo que empareja las
		// subidas del arte con lo que mandó el navegador, y al repartir por
		// taller el orden deja de coincidir.
		const detalladas = indices.map((i) => ({
			indice: i,
			linea: aLinea(lineas[i], productos[i], pedidoId),
		}));

		const suyas = detalladas.map((d) => d.linea);
		const productosTotal = suyas.reduce((suma, l) => suma + l.importe, 0);

		return {
			proveedorId,
			pedidoId,
			detalladas,
			descuentos: descuentosDeStock(
				suyas,
				indices.map((i) => productos[i]),
			),
			pedido: {
				...llaves.pedido(pedidoId),
				...llaves.pedidoDeProveedor(proveedorId, pedidoId, ahora),
				...llaves.pedidoPorEstado("nuevo", ahora),
				...llaves.pedidoDeComprador(comprador.email, pedidoId, ahora),
				id: pedidoId,
				/** De qué compra es esta parte. Al revés, la compra lista sus pedidos. */
				compraId,
				comprador,
				/**
				 * A dónde va. Se guarda tal como se capturó y no se vuelve a tocar: es
				 * lo que el taller lee para mandar el paquete, y "corregirle" el
				 * formato a una dirección mexicana es como se pierden los envíos.
				 */
				entrega,
				/**
				 * La paquetería elegida y lo que se cobró por ella. Se CONGELA aquí,
				 * como el precio y las medidas: la cotización de Skydropx caduca y el
				 * precio de mañana no es el que pagó esta persona.
				 *
				 * `guia` se llena en el paso siguiente, cuando el taller confirma el
				 * peso real y se compra la etiqueta.
				 */
				envio,
				/** Se llena el día que haya cuentas; hoy el pedido vive por su correo. */
				compradorId: null,
				proveedorId,
				lineas: suyas,
				productosTotal,
				total: productosTotal + (envio?.precio ?? 0),
				piezas: suyas.reduce((n, l) => n + l.piezas, 0),
				estado: "nuevo" as EstadoPedido,
				bitacora: [{ estado: "nuevo", en: ahora, por: "cliente", nota: null }],
				tokenHuella,
				createdAt: ahora,
				updatedAt: ahora,
			},
		};
	});

	const productosTotal = partes.reduce(
		(suma, p) => suma + Number(p.pedido.productosTotal),
		0,
	);
	const total = productosTotal + (envio?.precio ?? 0);
	const piezas = partes.reduce((n, p) => n + Number(p.pedido.piezas), 0);

	const compra = {
		...llaves.compra(compraId),
		...llaves.compraDeComprador(comprador.email, compraId, ahora),
		id: compraId,
		comprador,
		compradorId: null,
		entrega,
		productosTotal,
		total,
		piezas,
		tokenHuella,
		createdAt: ahora,
		updatedAt: ahora,
	};

	const { folio, folios } = await escribirCompra(compra, partes);

	/* Todo lo que sigue va DESPUÉS de escribir y no puede tumbar nada: la
	 * compra ya existe. `avisarAlTaller` y `enviar` se tragan sus errores.
	 *
	 * Un aviso en vivo por taller: cada uno recibe el suyo por su propio canal,
	 * que ya reparte por `proveedorId`. */
	for (const parte of partes) {
		await avisarAlTaller(parte.proveedorId, {
			tipo: "pedido-nuevo",
			pedidoId: parte.pedidoId,
			folio: folios[parte.pedidoId],
		});
	}

	/* UN correo al comprador por toda la compra, no uno por taller: él hizo una
	 * compra, y tres correos por lo mismo enseñan a ignorarlos.
	 *
	 * Es el que importa: lleva su enlace de seguimiento, y de ese token sólo
	 * guardamos la huella. Si no le llega y cierra la pestaña, no hay forma de
	 * devolvérselo ni por soporte. */
	const todas = partes.flatMap((parte) => parte.detalladas.map((d) => d.linea));
	const primera = todas[0];

	await enviar(
		pedidoRecibido({
			para: comprador.email,
			nombre: comprador.nombre,
			folio,
			enlace: `/pedido?id=${encodeURIComponent(compraId)}&token=${encodeURIComponent(token)}`,
			total,
			piezas,
			producto: primera?.producto ?? "Tu pedido",
			dias: primera?.diasPrometidos ?? null,
		}),
	);

	/* Y uno por taller, con SU parte: su folio, sus piezas y su importe. El
	 * correo del taller vive en su ítem, y se lee aquí y no antes: si la compra
	 * no llega a escribirse, estas lecturas sobran. */
	for (const parte of partes) {
		const taller = await leerTaller(parte.proveedorId);
		if (!taller?.email) continue;

		const suyas = parte.detalladas.map((d) => d.linea);

		await enviar(
			pedidoParaTaller({
				para: String(taller.email),
				taller: String(taller.displayName ?? taller.name ?? "Hola"),
				folio: folios[parte.pedidoId],
				piezas: Number(parte.pedido.piezas),
				producto: suyas[0]?.producto ?? "Un producto",
				total: Number(parte.pedido.productosTotal),
				metodo: entrega.metodo,
			}),
		);
	}

	return {
		/** El id de la COMPRA: es lo que abre el enlace de seguimiento. */
		id: compraId,
		folio,
		token,
		total,
		/** Qué se creó por dentro, por si quien llama quiere enseñarlo. */
		pedidos: partes.map((parte) => ({
			id: parte.pedidoId,
			folio: folios[parte.pedidoId],
			proveedorId: parte.proveedorId,
		})),
		// El arte va directo del navegador a S3, como los mockups: firmar aquí
		// ata el permiso a una compra que ya existe en vez de dejar un firmador
		// abierto. El `indice` es el de la línea tal como la mandó el navegador.
		subidas: await firmarArte(todasConIndice(partes)),
	};
}

/** Las líneas de todas las partes, con el índice que traían al llegar. */
function todasConIndice(
	partes: { detalladas: { indice: number; linea: Linea }[] }[],
) {
	return partes.flatMap((parte) => parte.detalladas);
}

/**
 * El pedido, para quien trae el enlace de seguimiento.
 *
 * El token se compara en tiempo constante: una comparación normal filtra por
 * cuánto tarda en fallar, y aquí eso permitiría adivinarlo carácter a
 * carácter.
 */
export async function seguimiento(id: string, token: string | undefined) {
	/* El mismo enlace sirve para las dos cosas. El correo lleva el id de la
	   COMPRA, pero los enlaces que ya circulan —y los que el taller consulta—
	   traen el de un pedido. Se busca primero el pedido porque es el caso
	   viejo y el más común. */
	const pedido = await leerSiExiste(llaves.pedido(id));
	const item = pedido ?? (await leerSiExiste(llaves.compra(id)));

	if (!item) throw noEncontrado("No encontramos ese pedido");

	exigirToken(item, token);

	if (pedido) return paraComprador(pedido);

	return await comoCompra(item);
}

async function leerSiExiste(Key: Record<string, string>) {
	const { Item } = await dynamo.send(new GetCommand({ TableName: TABLA, Key }));
	return Item ?? null;
}

/**
 * El token se compara en tiempo constante: una comparación normal filtra por
 * cuánto tarda en fallar, y aquí eso permitiría adivinarlo carácter a
 * carácter.
 */
function exigirToken(item: Record<string, unknown>, token: string | undefined) {
	if (!token) throw noAutorizado("Falta el enlace de seguimiento");

	const esperada = Buffer.from(String(item.tokenHuella ?? ""));
	const recibida = Buffer.from(huella(token));

	if (
		esperada.length !== recibida.length ||
		!timingSafeEqual(esperada, recibida)
	) {
		throw noAutorizado("Ese enlace de seguimiento no es válido");
	}
}

/**
 * La compra con sus partes dentro.
 *
 * Con UNA sola parte se devuelve la parte tal cual, con el folio de la compra
 * al lado: es lo que ve casi todo el mundo hoy, y así la pantalla de
 * seguimiento no tiene que saber que existen las compras hasta que de verdad
 * haya varias.
 */
async function comoCompra(compra: Record<string, unknown>) {
	const lista = (compra.pedidos ?? []) as { id: string }[];

	const leidos = await Promise.all(
		lista.map((p) => leerSiExiste(llaves.pedido(p.id))),
	);

	const partes = leidos
		.filter((p): p is Record<string, unknown> => p !== null)
		.map((p) => paraComprador(p));

	if (partes.length === 1) {
		return { ...partes[0], compra: { id: compra.id, folio: compra.folio } };
	}

	return {
		id: compra.id,
		folio: compra.folio,
		esCompra: true,
		comprador: compra.comprador,
		entrega: compra.entrega,
		total: compra.total,
		piezas: compra.piezas,
		createdAt: compra.createdAt,
		partes,
	};
}

/* ─── Lo que sostiene todo lo de arriba ─────────────────────────────────── */

/**
 * A dónde y cómo se entrega.
 *
 * Hay dos formas y cambian qué es obligatorio: si el taller se lo entrega en
 * mano no hay nada que capturar, y exigir una dirección para recogerla sería
 * pedir datos que nadie va a usar. Por eso la dirección se valida sólo cuando
 * de verdad hay que enviar algo.
 *
 * Los campos van en lista blanca: el cuerpo es público y sin sesión, así que
 * lo que no esté aquí no entra a la tabla.
 */
function leerEntrega(e: unknown) {
	const d = (e ?? {}) as Cuerpo;
	const metodo = d.metodo === "recoger" ? "recoger" : "envio";

	if (metodo === "recoger") {
		return { metodo, direccion: null };
	}

	const dir = (d.direccion ?? {}) as Cuerpo;
	const texto = (v: unknown) => String(v ?? "").trim();

	const direccion = {
		calle: texto(dir.calle),
		numero: texto(dir.numero),
		interior: texto(dir.interior) || null,
		colonia: texto(dir.colonia),
		ciudad: texto(dir.ciudad),
		estado: texto(dir.estado),
		cp: texto(dir.cp),
		referencias: texto(dir.referencias) || null,
	};

	// Uno por uno y con el nombre del campo: "faltan datos" obliga a quien
	// captura a adivinar cuál, y esta pantalla ya es larga de por sí.
	const obligatorios: [keyof typeof direccion, string][] = [
		["calle", "la calle"],
		["numero", "el número"],
		["colonia", "la colonia"],
		["ciudad", "la ciudad o municipio"],
		["estado", "el estado"],
	];

	for (const [campo, comoSeLlama] of obligatorios) {
		if (!direccion[campo]) {
			throw malaPeticion(`Falta ${comoSeLlama} de la dirección de entrega`);
		}
	}

	if (!CP.test(direccion.cp)) {
		throw malaPeticion("El código postal va a cinco dígitos");
	}

	return { metodo, direccion };
}

/** El taller, para escribirle. Nunca lanza: sin correo no se avisa y ya. */
async function leerTaller(proveedorId: string) {
	try {
		const { Item } = await dynamo.send(
			new GetCommand({ TableName: TABLA, Key: llaves.proveedor(proveedorId) }),
		);
		return Item ?? null;
	} catch (error) {
		console.error("No pudimos leer el taller para avisarle:", error);
		return null;
	}
}

async function leerProductoPublicado(productoId: string) {
	if (!productoId)
		throw malaPeticion("Una línea del pedido no dice qué producto es");

	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.producto(productoId) }),
	);

	// Sólo se puede pedir lo que está publicado: un borrador o algo que volvió
	// a revisión no existe para el público, y menos para cobrarlo.
	if (!Item || Item.estado !== "activo") {
		throw malaPeticion("Uno de los productos ya no está disponible");
	}

	return Item;
}

function aLinea(l: Cuerpo, producto: Cuerpo, pedidoId: string) {
	const tallas = (Array.isArray(l.tallas) ? l.tallas : [])
		.map((t: Cuerpo) => ({
			size: String(t.size ?? "").trim(),
			piezas: Math.trunc(Number(t.piezas ?? 0)),
		}))
		.filter((t: { size: string; piezas: number }) => t.size && t.piezas > 0);

	if (tallas.length === 0) {
		throw malaPeticion(`Dinos cuántas piezas quieres de ${producto.name}`);
	}

	const piezas = tallas.reduce(
		(n: number, t: { piezas: number }) => n + t.piezas,
		0,
	);

	const lados = (Array.isArray(l.lados) ? l.lados : [])
		.map((s: unknown) => String(s))
		.filter(Boolean);

	const precios = (producto.pricing ?? {}) as Record<
		string,
		number | undefined
	>;
	const base = Number(precios.basePrice ?? 0);

	// El primer lado va en el precio base; cada lado extra se cobra aparte si
	// el taller lo puso. Es la regla que ya describía su propio formulario.
	const extraPorLados =
		lados.length > 1
			? (lados.length - 1) * Number(precios.perSidePrice ?? 0)
			: 0;

	const lineaId = randomUUID();

	/**
	 * El color de la prenda, con su referencia.
	 *
	 * El nombre solo no basta para comprar el blanco ni para decidir la subbase:
	 * "Negro" no le dice a nadie qué tono. Se copia el hex del producto.
	 */
	const nombreColor = String(l.colorPrenda ?? "").trim() || null;
	const colores = (producto.colors ?? []) as { name?: string; hex?: string }[];
	const colorHex = colores.find((c) => c.name === nombreColor)?.hex ?? null;

	return {
		id: lineaId,
		productoId: String(producto.id),
		producto: String(producto.name),
		imagen:
			(producto.images as { url: string }[] | undefined)?.[0]?.url ?? null,
		templateId: String(producto.templateId ?? ""),
		/** Para comprar el blanco hace falta el código del taller, no el nombre. */
		sku: String(producto.sku ?? "") || null,
		colorPrenda: nombreColor,
		colorPrendaHex: colorHex,
		lados,
		tallas,
		piezas,
		importe: (base + extraPorLados) * piezas,
		/**
		 * Lo que se le prometió al comprador, CONGELADO como el precio.
		 *
		 * Si no había blancos, se le dijeron más días porque el taller tiene que
		 * comprarlos. Ese compromiso es del momento de la compra: si mañana llega
		 * mercancía, el pedido no se vuelve más rápido de cara a nadie, y si el
		 * taller cambia sus días, un pedido de la semana pasada no se mueve.
		 *
		 * `faltantes` es lo que el taller tiene que comprar para sacar ESTA
		 * línea. Va aquí y no se calcula al mirar la ficha, porque el inventario
		 * ya habrá cambiado para entonces.
		 */
		...compromiso(producto, nombreColor, tallas),
		/**
		 * El diseño editable vive en S3, NO en este ítem.
		 *
		 * Un ítem de DynamoDB no puede pasar de 400 KB, y el diseño lleva dentro
		 * las imágenes que subió el cliente como data URL: en cuanto alguien
		 * arrastra una foto de verdad, el pedido entero deja de caber y la
		 * escritura falla con `Item size has exceeded the maximum allowed size`.
		 * Ya pasó, y desde fuera se ve como un 500 al pedir.
		 *
		 * Aquí sólo queda la ruta. El navegador lo sube aparte, con su URL
		 * firmada, igual que el arte.
		 */
		diseno: `/medios/pedidos/${pedidoId}/${lineaId}-diseno.json`,
		/**
		 * Lo que hace falta para producir cada lado.
		 *
		 * LAS MEDIDAS SE CONGELAN AQUÍ, igual que el precio. Viven en el producto
		 * (`printSides`), y el taller puede editarlas mañana: si la ficha del
		 * pedido las leyera de allí, un pedido de hace un mes se imprimiría al
		 * tamaño de hoy y nadie se enteraría hasta ver la prenda. El pedido es un
		 * documento de lo que se acordó, no una vista del catálogo actual.
		 *
		 * Las rutas se apuntan antes de que los archivos existan: el navegador los
		 * sube enseguida con las URLs firmadas, y así el taller siempre sabe dónde
		 * mirar.
		 */
		arte: lados.map((lado: string) => {
			const medidas = medidasDeLado(producto, lado);
			const real = medidaRealDelArchivo(l, lado, medidas.dpi);

			return {
				lado,
				/** El archivo que va a máquina: recortado, transparente, a los DPI. */
				ruta: `/medios/pedidos/${pedidoId}/${lineaId}-${lado}.png`,
				/**
				 * La prenda con el diseño encima. No se imprime: es la referencia de
				 * COLOCACIÓN, para que el taller compruebe dónde va antes de planchar.
				 * El archivo de producción va recortado al área y no dice nada de en
				 * qué parte de la playera cae.
				 */
				colocacion: `/medios/pedidos/${pedidoId}/${lineaId}-${lado}-colocacion.png`,
				...medidas,
				...real,
			};
		}),
	};
}

/**
 * El área imprimible de un lado, en centímetros, tal como está hoy.
 *
 * Los valores llegan de DynamoDB como cadenas ("28"), así que se convierten;
 * si el taller no declaró el lado se usan los mismos valores por defecto que
 * el editor, para que el archivo y la ficha digan lo mismo.
 */
function medidasDeLado(producto: Cuerpo, lado: string) {
	const lados = (producto.printSides ?? []) as Cuerpo[];
	const suyo = lados.find((s) => String(s.sideKey) === lado);

	return {
		anchoCm: Number(suyo?.widthCm ?? 28),
		altoCm: Number(suyo?.heightCm ?? 35),
		dpi: Number(suyo?.dpi ?? 300),
	};
}

/**
 * Lo que mide de verdad el archivo que se va a subir.
 *
 * Lo reporta el navegador porque es el único que lo sabe: el tamaño sale del
 * área del lienzo, y esa proporción no tiene por qué coincidir con los
 * centímetros que declaró el taller —de hecho no coincidía, y la ficha decía
 * 35 cm mientras el archivo medía 36.3—. Es descriptivo, no decide precio ni
 * destinatario, así que puede venir del cliente; lo que sí se hace es no
 * creerse cualquier cosa: sin números buenos, no se guarda nada.
 */
function medidaRealDelArchivo(l: Cuerpo, lado: string, dpi: number) {
	const archivos = Array.isArray(l.archivos) ? (l.archivos as Cuerpo[]) : [];
	const suyo = archivos.find((a) => String(a.lado) === lado);

	const anchoPx = Math.trunc(Number(suyo?.anchoPx ?? 0));
	const altoPx = Math.trunc(Number(suyo?.altoPx ?? 0));

	if (!(anchoPx > 0 && altoPx > 0)) return {};

	const aCm = (px: number) => Math.round((px / dpi) * 2.54 * 10) / 10;

	return {
		anchoPx,
		altoPx,
		/** Lo que va a medir impreso. Es lo que el taller tiene que comprobar. */
		anchoRealCm: aCm(anchoPx),
		altoRealCm: aCm(altoPx),
	};
}

type Linea = ReturnType<typeof aLinea>;

/**
 * Firma todo lo que el navegador tiene que subir.
 *
 * Por cada lado, el arte de producción y la referencia de colocación; por cada
 * línea, el diseño editable. Cada entrada lleva su `tipo` y su `indice` —la
 * posición de la línea en lo que se pidió— para que el navegador empareje sin
 * adivinar: emparejar sólo por `lado` funcionaba de milagro mientras el pedido
 * llevara un único producto, y se rompía en silencio en cuanto llevara dos con
 * el mismo lado dibujado.
 */
/* ─── Existencias ───────────────────────────────────────────────────────── */

type Talla = { size: string; piezas: number };

/**
 * Qué se le promete al comprador y qué le falta al taller.
 *
 * Las existencias NO bloquean la venta: se decidió que se puede comprar sin
 * blancos avisando de más días, porque el taller los compra. Por eso aquí no
 * hay ninguna condición ni ningún rechazo — sólo se calcula el compromiso.
 *
 * Todo producto cuenta: no hay interruptor que apague esto. Quien compra el
 * blanco por trabajo tiene sus existencias en cero, y sus `faltantes` son la
 * lista de lo que va a comprar. Lo que ese taller deja en 0 es
 * `diasExtraSinStock`, porque sus días de producción ya incluyen la compra.
 */
function compromiso(
	producto: Cuerpo,
	color: string | null,
	tallas: Talla[],
): { diasPrometidos: number; faltantes: Talla[] } {
	const meta = (producto.production as Cuerpo | undefined)?.meta as
		| Cuerpo
		| undefined;
	const dias = Math.trunc(Number(meta?.diasProduccion ?? 0)) || 0;

	const faltantes: Talla[] = [];

	for (const t of tallas) {
		const hay = existenciasDe(producto, color, t.size);
		// Lo que falta es lo que se pide por encima de lo que hay. Si hay 3 y
		// piden 5, faltan 2 — no 5.
		const falta = t.piezas - Math.max(0, hay);
		if (falta > 0) faltantes.push({ size: t.size, piezas: falta });
	}

	const extra = Math.trunc(Number(producto.diasExtraSinStock ?? 0)) || 0;

	return {
		diasPrometidos: faltantes.length > 0 ? dias + extra : dias,
		faltantes,
	};
}

/**
 * Los descuentos de inventario que van DENTRO de la transacción del pedido.
 *
 * Uno por producto. Sin `ConditionExpression`: el stock puede quedar negativo
 * y eso es información, no un fallo — un -2 le dice al taller que compre 2
 * blancos. Meterle condición devolvería la trampa de que `escribirConFolio`
 * reintenta seis veces cualquier `TransactionCanceled`.
 *
 * `if_not_exists` en la hoja cubre la variante que nunca se capturó —un color
 * añadido después—, pero el mapa `existencias` sí tiene que existir: eso lo
 * garantiza el alta del producto.
 */
function descuentosDeStock(lineas: Linea[], productos: Cuerpo[]) {
	const porProducto = new Map<string, Map<string, number>>();

	lineas.forEach((l, i) => {
		const p = productos[i];
		if (!p) return;

		// El alta escribe `existencias` siempre, pero los productos anteriores a
		// esa regla pueden no tenerlo, y escribir dentro de un mapa inexistente
		// revienta con `ValidationException` — aquí dentro eso sería un pedido
		// caído, no un contador mal. Se salta y se grita: es dato que falta, no
		// una función apagada, y hay que rellenarlo.
		if (!p.existencias) {
			console.error(
				`El producto ${p.id} no tiene mapa de existencias: no se descuenta.`,
			);
			return;
		}

		const id = String(p.id);
		const acumulado = porProducto.get(id) ?? new Map<string, number>();

		for (const t of l.tallas) {
			// Dos líneas del mismo producto y la misma variante se suman: si no,
			// la segunda escritura pisaría a la primera dentro de la transacción,
			// que además DynamoDB rechaza por tocar el mismo ítem dos veces.
			const clave = variante(l.colorPrenda, t.size);
			acumulado.set(clave, (acumulado.get(clave) ?? 0) + t.piezas);
		}

		porProducto.set(id, acumulado);
	});

	return [...porProducto].map(([id, variantes]) => {
		const nombres: Record<string, string> = {};
		const valores: Record<string, number> = { ":cero": 0 };
		const sets: string[] = [];

		[...variantes].forEach(([clave, piezas], n) => {
			nombres[`#v${n}`] = clave;
			valores[`:n${n}`] = piezas;
			sets.push(
				`existencias.#v${n} = if_not_exists(existencias.#v${n}, :cero) - :n${n}`,
			);
		});

		return {
			Update: {
				TableName: TABLA,
				Key: llaves.producto(id),
				UpdateExpression: `SET ${sets.join(", ")}`,
				ExpressionAttributeNames: nombres,
				ExpressionAttributeValues: valores,
			},
		};
	});
}

async function firmarArte(conIndice: { indice: number; linea: Linea }[]) {
	// El índice NO es la posición en este array: es la que traía la línea en lo
	// que mandó el navegador. Al repartir por taller el orden cambia, y
	// emparejar por posición subiría el arte de una línea a la ruta de otra.
	const piezas = conIndice.flatMap(({ indice, linea: l }) => [
		...l.arte.flatMap((a) => [
			{
				indice,
				lineaId: l.id,
				lado: a.lado,
				tipo: "arte" as const,
				ruta: a.ruta,
				contentType: "image/png",
			},
			{
				indice,
				lineaId: l.id,
				lado: a.lado,
				tipo: "colocacion" as const,
				ruta: a.colocacion,
				contentType: "image/png",
			},
		]),
		{
			indice,
			lineaId: l.id,
			lado: "",
			tipo: "diseno" as const,
			ruta: l.diseno,
			contentType: "application/json",
		},
	]);

	return Promise.all(
		piezas.map(async (p) => ({
			...p,
			uploadUrl: await getSignedUrl(
				s3,
				new PutObjectCommand({
					Bucket: BUCKET_PUBLICO,
					Key: p.ruta.slice(1),
					ContentType: p.contentType,
				}),
				{ expiresIn: VIGENCIA_SUBIDA },
			),
		})),
	);
}

/**
 * Escribe el pedido con su folio corto, único, en una sola transacción.
 *
 * El folio es lo que la gente dice por teléfono ("mi pedido 481902"), así que
 * son dígitos y no un uuid. Al ser corto choca de vez en cuando: se reintenta
 * con otro en vez de fallar, y sólo se rinde tras varios intentos.
 *
 * SEIS DÍGITOS, Y EL NÚMERO IMPORTA. Empezó con cuatro —9 000 valores— y los
 * folios no se liberan nunca, así que ese espacio era un techo duro para la
 * vida del negocio, no un límite por segundo. La probabilidad de que un pedido
 * fallara del todo es (usados / espacio)^6:
 *
 *   con 9 000 valores  ->  a los 3 000 pedidos falla 1 de cada 730,
 *                          a los 6 000 falla 1 de cada 11,
 *                          a los 9 000 no entra ni uno más. Nunca.
 *   con 900 000        ->  a los 9 000 pedidos, 1 de cada 10^12.
 *
 * Los folios de cuatro dígitos que ya existen siguen valiendo: son cadenas y
 * conviven sin problema con los nuevos.
 *
 * `randomInt` y no `Math.random()`: no es un secreto, pero viene del mismo
 * módulo que ya se usa aquí y reparte parejo sin pensarlo.
 */
async function escribirCompra(
	compra: Record<string, unknown>,
	partes: {
		proveedorId: string;
		pedidoId: string;
		pedido: Record<string, unknown>;
		descuentos: Record<string, unknown>[];
	}[],
): Promise<{ folio: string; folios: Record<string, string> }> {
	const descuentos = partes.flatMap((parte) => parte.descuentos);

	/* DynamoDB no acepta más de 100 ítems por transacción, y una compra son la
	 * compra, un pedido por taller, el candado del folio y un descuento por
	 * talla vendida. Se comprueba aquí para poder decirlo en castellano: si no,
	 * sale un `TransactionCanceledException` que no explica nada y llega al
	 * navegador como un 500 al pagar. */
	const total = 2 + partes.length + descuentos.length;

	if (total > 100) {
		throw malaPeticion(
			"La compra lleva demasiadas cosas para procesarla de una vez. " +
				"Sepárala en dos y vuelve a intentarlo.",
		);
	}

	for (let intento = 0; intento < 6; intento++) {
		const folio = String(randomInt(100_000, 1_000_000));

		// `#481902-1`, `#481902-2`… El cliente dice el folio de la compra y cada
		// taller reconoce el suyo dentro sin tener que explicarle nada.
		const folios: Record<string, string> = {};
		partes.forEach((parte, i) => {
			folios[parte.pedidoId] = `${folio}-${i + 1}`;
		});

		try {
			await dynamo.send(
				new TransactWriteCommand({
					TransactItems: [
						{
							Put: {
								TableName: TABLA,
								Item: {
									...compra,
									folio,
									/* La compra lleva dentro la lista de sus pedidos: es lo que
									   evita un cuarto índice. Leerla es un GetItem y un
									   BatchGet. */
									pedidos: partes.map((parte) => ({
										id: parte.pedidoId,
										folio: folios[parte.pedidoId],
										proveedorId: parte.proveedorId,
									})),
								},
								ConditionExpression: "attribute_not_exists(pk)",
							},
						},
						...partes.map((parte) => ({
							Put: {
								TableName: TABLA,
								Item: {
									...parte.pedido,
									folio: folios[parte.pedidoId],
									/** El folio que ve el cliente, para no recalcularlo al leer. */
									compraFolio: folio,
								},
								ConditionExpression: "attribute_not_exists(pk)",
							},
						})),
						{
							Put: {
								TableName: TABLA,
								Item: {
									...llaves.folioDePedido(folio),
									compraId: compra.id,
								},
								ConditionExpression: "attribute_not_exists(pk)",
							},
						},
						...descuentos,
					],
				}),
			);

			return { folio, folios };
		} catch (error) {
			if (!esConflicto(error)) throw error;
		}
	}

	throw conflicto(
		"No pudimos asignarle un folio a la compra. Inténtalo otra vez.",
	);
}

function huella(token: string) {
	return createHash("sha256").update(token).digest("hex");
}

/** La huella del token nunca sale de la Lambda. */
export function sinSecretos(item: Record<string, unknown>) {
	const { tokenHuella, ...resto } = sinLlaves(item);
	return resto;
}

/**
 * El pedido tal como puede verlo QUIEN LO COMPRÓ.
 *
 * `sinSecretos` sólo quita la huella del token, así que todo lo demás salía:
 * la etiqueta de la paquetería —un documento operativo del taller—, lo que el
 * envío costó DE VERDAD y la diferencia a cargo del taller. Con eso a la vista,
 * cualquiera compara lo que pagó contra lo que costó y ve el margen.
 *
 * Así que el envío y la guía se recortan a lo que el comprador necesita para
 * saber dónde está su paquete: quién lo lleva, con qué servicio, cuánto pagó y
 * el número para rastrearlo.
 *
 * OJO: esta función está DUPLICADA en `services/compradores` porque cada
 * servicio tiene su propio `lib`. Si cambias una, cambia la otra — es un filtro
 * de seguridad y divergirlo se nota tarde.
 */
export function paraComprador(item: Record<string, unknown>) {
	const pedido = sinSecretos(item) as Record<string, any>;

	if (pedido.envio) {
		const { paqueteria, servicio, precio, diasEstimados } = pedido.envio;
		pedido.envio = { paqueteria, servicio, precio, diasEstimados };
	}

	if (pedido.guia) {
		const { paqueteria, rastreo, rastreoUrl, compradaEn } = pedido.guia;
		pedido.guia = { paqueteria, rastreo, rastreoUrl, compradaEn };
	}

	return pedido;
}
