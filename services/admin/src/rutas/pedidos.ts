import {
	createHash,
	randomBytes,
	randomInt,
	randomUUID,
	timingSafeEqual,
} from "node:crypto";
import {
	CopyObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { extraPorLados } from "@kustto/precios";
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
/**
 * De dónde sale el DST del bordado. Es OTRO bucket, y es privado.
 *
 * Su prefijo `embroidery/` CADUCA A LOS 90 DÍAS por regla de ciclo de vida
 * —está pensado como caché de artefactos, indexado por `designHash`, no como
 * archivo—. Por eso el DST se copia al pedido en vez de enlazarse: un taller
 * que abra un pedido de hace cuatro meses encontraría el objeto borrado.
 */
const BUCKET_BORDADO = process.env.KUSTTO_EMBROIDERY_BUCKET ?? "";

/** Lo que se firma para el arte. Sólo PNG: es lo que exporta el editor. */
const VIGENCIA_SUBIDA = 900;
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Código postal mexicano: cinco dígitos, ni uno más. */
const CP = /^\d{5}$/;
/** Sólo los dígitos: la gente escribe espacios, guiones y prefijos. */
const DIGITOS = (v: string) => v.replace(/\D/g, "");

/**
 * El id del carrito viene del cuerpo y acaba dentro de una ruta de S3, así que
 * se limpia igual que cualquier otra cosa que llegue de fuera: sin esto, un
 * `../` bien puesto leería objetos de otro sitio del bucket.
 */
/**
 * Redondea a centavos.
 *
 * Los precios del envío llegan con decimales y sumarlos en coma flotante deja
 * cosas como `809.9300000000001`, que es lo que se guarda en el pedido y lo
 * que acabaría en un correo o en una factura. Se redondea al sumar, no al
 * pintar: si sólo se arreglara en la pantalla, el número guardado seguiría
 * siendo el feo y dos sumas distintas darían totales distintos.
 */
const aPesos = (n: number) => Math.round(n * 100) / 100;

const LIMPIO_ID = (v: unknown) =>
	String(v ?? "")
		.replace(/[^a-zA-Z0-9-]/g, "")
		.slice(0, 40);

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

	/* La entrega se elige POR PARTE: uno está en tu ciudad y pasas por él, el
	 * otro te lo manda. `c.partes` trae la de cada taller; si no viene —el
	 * checkout de un solo producto, que sigue existiendo— vale la global para
	 * todas. */
	const porTaller = new Map<string, { entrega: unknown; envio?: unknown }>();

	for (const parte of Array.isArray(c.partes) ? c.partes : []) {
		const id = String((parte as Cuerpo)?.proveedorId ?? "");
		if (id) {
			porTaller.set(id, {
				entrega: (parte as Cuerpo).entrega,
				envio: (parte as Cuerpo).envio,
			});
		}
	}

	const entregaGlobal = porTaller.size === 0 ? leerEntrega(c.entrega) : null;

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

	/* Cada taller trae SU entrega y SU envío. El precio del envío no viene del
	 * cuerpo: se lee de la cotización que guarda Skydropx, igual que el precio
	 * del producto se lee de la tabla. */
	const entregas = new Map<string, { entrega: any; envio: any }>();

	for (const proveedorId of grupos.keys()) {
		const suya = porTaller.get(proveedorId);

		const entrega = entregaGlobal ?? leerEntrega(suya?.entrega);

		entregas.set(proveedorId, {
			entrega,
			envio:
				entrega.metodo === "envio"
					? await envios.envioDelPedido(
							porTaller.size === 0 ? c.envio : suya?.envio,
						)
					: null,
		});
	}

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
		const { entrega, envio } = entregas.get(proveedorId)!;

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
				total: aPesos(productosTotal + (envio?.precio ?? 0)),
				piezas: suyas.reduce((n, l) => n + l.piezas, 0),
				estado: "nuevo" as EstadoPedido,
				bitacora: [{ estado: "nuevo", en: ahora, por: "cliente", nota: null }],
				tokenHuella,
				createdAt: ahora,
				updatedAt: ahora,
			},
		};
	});

	const productosTotal = aPesos(
		partes.reduce((suma, p) => suma + Number(p.pedido.productosTotal), 0),
	);
	/* Cada parte lleva su envío, así que el total de la compra los suma todos.
	   Con un solo envío global esto sería el de antes. */
	const enviosTotal = [...entregas.values()].reduce(
		(suma, e) => suma + (e.envio?.precio ?? 0),
		0,
	);
	const total = aPesos(productosTotal + enviosTotal);
	const piezas = partes.reduce((n, p) => n + Number(p.pedido.piezas), 0);

	const compra = {
		...llaves.compra(compraId),
		...llaves.compraDeComprador(comprador.email, compraId, ahora),
		id: compraId,
		comprador,
		compradorId: null,
		/* Sólo si TODAS las partes entregan igual. Con métodos distintos no hay
		   una entrega de la compra, y guardar la de una parte como si fuera la
		   de todas es la clase de dato que después se lee mal. */
		entrega: [...entregas.values()].every(
			(e) => e.entrega.metodo === [...entregas.values()][0].entrega.metodo,
		)
			? [...entregas.values()][0].entrega
			: null,
		productosTotal,
		total,
		piezas,
		tokenHuella,
		createdAt: ahora,
		updatedAt: ahora,
	};

	/* Lo que venga del carrito ya está subido: se saca de `carritos/` —que
	 * caduca— y se deja donde vive lo comprado. Va ANTES de escribir: si el
	 * arte no aparece, mejor no llegar a crear la compra. */
	for (const parte of partes) {
		for (const { indice, linea } of parte.detalladas) {
			const carritoId = LIMPIO_ID(lineas[indice]?.carritoId);
			if (!carritoId) continue;

			await copiarDelCarrito(
				carritoId,
				parte.pedidoId,
				linea.id,
				linea.lados as string[],
			);

			/* El DST va DESPUÉS del arte y no bloquea: si el arte falta hay que
			   parar antes de crear la compra, pero un bordado que no se pudo copiar
			   sólo significa que el taller lo digitaliza como siempre. */
			if (linea.bordados?.length) {
				await copiarBordados(linea.bordados, parte.pedidoId, linea.id);
			}
		}
	}

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
				metodo: String(parte.pedido.entrega?.metodo ?? "envio"),
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
		/* Sólo lo que aún no existe. Lo que vino del carrito ya está copiado, y
		   devolverle una URL de subida al navegador le haría subirlo otra vez. */
		subidas: await firmarArte(
			todasConIndice(partes).filter(
				(d) => !LIMPIO_ID(lineas[d.indice]?.carritoId),
			),
		),
	};
}

/**
 * Saca el arte del carrito y lo deja donde vive lo comprado.
 *
 * `carritos/` CADUCA A LOS 30 DÍAS (regla `carritos-caducan`, en
 * `infra/buckets.sh`), porque la mayor parte de lo que se sube ahí es de gente
 * que nunca compró. Si el pedido se quedara apuntando a ese prefijo, la
 * limpieza se llevaría el arte de un pedido pagado — y nadie se enteraría
 * hasta que el taller fuera a producirlo, semanas después.
 *
 * Se copia ANTES de escribir la compra: si algo falla, lo que queda son unos
 * objetos que nadie referencia, no un pedido sin arte.
 *
 * El arte es obligatorio; la colocación y el diseño editable no. Sin arte no
 * se puede producir, así que su ausencia se dice en voz alta —normalmente
 * significa que el carrito caducó— mientras que sin los otros dos se pierde
 * una referencia y una comodidad.
 */
async function copiarDelCarrito(
	carritoId: string,
	pedidoId: string,
	lineaId: string,
	lados: string[],
) {
	const copiar = async (de: string, a: string, obligatorio: boolean) => {
		try {
			await s3.send(
				new CopyObjectCommand({
					Bucket: BUCKET_PUBLICO,
					CopySource: `${BUCKET_PUBLICO}/${de}`,
					Key: a,
				}),
			);
		} catch (error) {
			const nombre = (error as { name?: string })?.name;
			const falta = nombre === "NoSuchKey" || nombre === "AccessDenied";

			if (obligatorio && falta) {
				throw malaPeticion(
					"El diseño de uno de los productos ya no está disponible. " +
						"Vuelve a agregarlo al carrito.",
				);
			}

			if (!falta) throw error;
		}
	};

	for (const lado of lados) {
		await copiar(
			`carritos/${carritoId}/${lado}-arte.png`,
			`medios/pedidos/${pedidoId}/${lineaId}-${lado}.png`,
			true,
		);
		await copiar(
			`carritos/${carritoId}/${lado}-colocacion.png`,
			`medios/pedidos/${pedidoId}/${lineaId}-${lado}-colocacion.png`,
			false,
		);
		/* La prenda real, si el taller subió la foto de ese lado y color. NO es
		   obligatoria —hoy casi ningún producto tiene fotos— así que va con
		   `false`: que falte no puede tumbar un pedido ya cobrado. */
		await copiar(
			`carritos/${carritoId}/${lado}-prenda.png`,
			`medios/pedidos/${pedidoId}/${lineaId}-${lado}-prenda.png`,
			false,
		);
	}

	await copiar(
		`carritos/${carritoId}/diseno.json`,
		`medios/pedidos/${pedidoId}/${lineaId}-diseno.json`,
		false,
	);
}

/**
 * El DST de cada lado bordado, del bucket de artefactos al del pedido.
 *
 * POR QUÉ SE COPIA Y NO SE ENLAZA. El original vive bajo `embroidery/`, que
 * caduca a los 90 días: sirve de caché por `designHash` para no volver a
 * digitalizar el mismo diseño, no de archivo. Un pedido dura más que eso.
 *
 * NINGÚN FALLO AQUÍ PUEDE TUMBAR LA COMPRA. El DST es material de apoyo: el
 * taller decide si lo usa o si digitaliza por su cuenta, y mientras el perfil
 * no esté validado físicamente no hay nada que prometa que ese archivo cose
 * bien. Perderlo cuesta una comodidad; tirar un pedido ya cobrado por no
 * encontrarlo sería mucho peor. Por eso se traga el error y sigue, al
 * contrario que el arte, que sin él no se puede producir nada.
 */
async function copiarBordados(
	bordados: { lado: string; jobId: string; designHash: string }[],
	pedidoId: string,
	lineaId: string,
) {
	if (!BUCKET_BORDADO) return;

	for (const b of bordados) {
		if (!b.jobId || !b.designHash) continue;

		try {
			await s3.send(
				new CopyObjectCommand({
					Bucket: BUCKET_PUBLICO,
					CopySource: `${BUCKET_BORDADO}/embroidery/${b.designHash}/${b.jobId}/design.dst`,
					Key: `medios/pedidos/${pedidoId}/${lineaId}-${b.lado}-bordado.dst`,
					/* El origen se guarda con su propio `Metadata` (el sha256 que
					   escribió el worker) y sin tipo útil. Se reescribe para que el
					   navegador lo baje como archivo en vez de intentar mostrarlo. */
					MetadataDirective: "REPLACE",
					ContentType: "application/octet-stream",
				}),
			);
		} catch {
			/* A propósito en silencio: ver arriba. La ficha del proveedor comprueba
			   si el archivo está antes de ofrecer la descarga. */
		}
	}
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

	/* El recargo de los lados extra, con la MISMA función que usa el navegador
	   para enseñarlo. Los números salen de `producto`, que viene de la tabla:
	   del cuerpo de la petición no se acepta nada que decida cuánto se cobra.

	   Antes la cuenta estaba escrita aquí y otras cuatro veces en el front.
	   Daba igual mientras todos los lados costaran lo mismo; con un recargo por
	   lado, una copia sin actualizar significa cobrar algo distinto de lo que
	   se enseñó. */
	const extra = extraPorLados(
		lados,
		(producto.printSides ?? []) as { sideKey: string; recargo?: number }[],
		precios,
	);

	/**
	 * Cómo quedó el bordado de cada lado que se borda.
	 *
	 * SE COPIA TAL CUAL Y NO SE RECALCULA: es descriptivo —no toca el precio ni
	 * el destinatario— y quien lo produjo fue el motor de bordado, no el
	 * navegador. Lo que sí decide, que un diseño rechazado no se pueda comprar,
	 * ya está resuelto antes: un `REJECTED` no llega a agregarse al carrito, y
	 * aquí sólo se aceptan los dos estados que permiten fabricar.
	 *
	 * `REVIEW` es la marca que el taller necesita ver: el sistema preparó el
	 * bordado pero alguien tiene que mirarlo antes de coserlo. Mientras el
	 * perfil no esté validado físicamente, es lo único que separa un bordado
	 * revisado de uno que nadie miró.
	 */
	const bordados = (Array.isArray(l.bordados) ? l.bordados : [])
		.map((b: Cuerpo) => ({
			lado: String(b.lado ?? "").trim(),
			jobId: String(b.jobId ?? "").slice(0, 64),
			designHash: String(b.designHash ?? "").slice(0, 64),
			status: b.status === "REVIEW" ? "REVIEW" : "READY",
			incidencias: (Array.isArray(b.incidencias) ? b.incidencias : [])
				.slice(0, 10)
				.map((c: unknown) => String(c).slice(0, 48)),
		}))
		.filter((b: { lado: string }) => b.lado && lados.includes(b.lado));

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
		importe: (base + extra) * piezas,
		...(bordados.length ? { bordados } : {}),
		/* Un atajo para el taller y el backoffice: si CUALQUIER lado quedó en
		   revisión, la línea entera lleva la marca. Sin esto habría que abrir el
		   arreglo de bordados para saberlo, y en una lista de pedidos eso no se
		   hace. */
		...(bordados.some((b: { status: string }) => b.status === "REVIEW")
			? { requiereRevisionBordado: true }
			: {}),
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
			const bordado = bordados.find((b: { lado: string }) => b.lado === lado);

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
				/**
				 * La prenda REAL con el diseño encima: lo que vio quien compró.
				 *
				 * Va además de `colocacion` y no en su lugar. Aquélla es el mockup
				 * —un dibujo de línea— y sirve para cuadrar dónde cae el estampado
				 * con geometría limpia; ésta tiene pliegues y caída y sirve para
				 * saber qué esperaba el cliente. Son dos preguntas distintas.
				 *
				 * La ruta se escribe siempre; el archivo puede no existir, y por eso
				 * quien la enseñe tiene que aguantar un 404 sin romperse. Comprobar
				 * aquí si está costaría una llamada a S3 por lado y por pedido.
				 */
				prenda: `/medios/pedidos/${pedidoId}/${lineaId}-${lado}-prenda.png`,
				/**
				 * El MISMO arte en trazos, para lo que se graba en vez de imprimirse.
				 *
				 * Igual que `prenda`: la ruta se escribe siempre y el archivo puede no
				 * existir —sólo lo sube el editor en productos de grabado—, así que
				 * quien la enseñe tiene que aguantar un 404. Comprobarlo aquí costaría
				 * una llamada a S3 por lado y por pedido.
				 */
				vector: `/medios/pedidos/${pedidoId}/${lineaId}-${lado}-vector.svg`,
				/**
				 * El DST, SÓLO en los lados que de verdad se bordan.
				 *
				 * Al contrario que `prenda` y `vector`, aquí la ruta NO se escribe
				 * siempre: si este lado no lleva bordado, el campo no existe y el
				 * taller no ve una descarga que nunca va a funcionar. Se sabe sin
				 * preguntarle a S3 porque `bordados` ya dice qué lados son.
				 *
				 * El estado viaja al lado del archivo a propósito. Un DST en
				 * `REVIEW` no es lo mismo que uno en `READY`, y quien está a punto
				 * de mandarlo a la máquina tiene que verlo en el mismo sitio donde
				 * pulsa, no en otra columna.
				 */
				...(bordado
					? {
							bordado: `/medios/pedidos/${pedidoId}/${lineaId}-${lado}-bordado.dst`,
							bordadoEstado: bordado.status,
							bordadoIncidencias: bordado.incidencias,
						}
					: {}),
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

	/* EL SANGRADO SE RESTA. El archivo mide a propósito más que el área: el
	   papel se mueve al prensar y el arte tiene que desbordar. Sin restarlo,
	   "lo que va a medir impreso" incluiría el desbordamiento y la comparación
	   con lo declarado avisaría de una desviación buscada — en cada pedido, que
	   es como se enseña a ignorar un aviso. */
	const sangradoCm = Number(suyo?.sangradoCm ?? 0) || 0;

	return {
		anchoPx,
		altoPx,
		/** Lo que va a medir impreso. Es lo que el taller tiene que comprobar. */
		anchoRealCm: Math.round((aCm(anchoPx) - sangradoCm * 2) * 10) / 10,
		altoRealCm: Math.round((aCm(altoPx) - sangradoCm * 2) * 10) / 10,
		/** Se enseña aparte: el taller tiene que saber que el archivo desborda. */
		sangradoCm: sangradoCm || undefined,
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
			/* La prenda real. Se firma SIEMPRE aunque casi nunca haya foto: el
			   navegador decide si la usa, y firmar de más cuesta una cadena
			   mientras que no firmarla obligaría a otra vuelta al servidor
			   justo después de cobrar. */
			{
				indice,
				lineaId: l.id,
				lado: a.lado,
				tipo: "prenda" as const,
				ruta: a.prenda,
				contentType: "image/png",
			},
			/* El vector. Se firma SIEMPRE, por el mismo motivo que la prenda: es el
			   navegador el que sabe si el lado se graba o se imprime, y no firmarlo
			   obligaría a otra vuelta al servidor justo después de cobrar. */
			{
				indice,
				lineaId: l.id,
				lado: a.lado,
				tipo: "vector" as const,
				ruta: a.vector,
				contentType: "image/svg+xml",
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
