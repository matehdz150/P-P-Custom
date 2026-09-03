import { createHmac, timingSafeEqual } from "node:crypto";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo, type EstadoPedido, llaves, TABLA } from "../lib/dynamo.js";
import { noAutorizado } from "../lib/http.js";

/**
 * El rastreo que manda Skydropx.
 *
 * Es la ÚNICA ruta que mueve un pedido sin que nadie de la casa haya entrado.
 * Todo lo demás sale de aquí:
 *
 * NADIE ENTRA SIN FIRMA. Skydropx firma el cuerpo con HMAC-SHA512 y lo manda
 * en `authorization: HMAC <firma>`. Se compara en tiempo constante, igual que
 * la llave del admin y el token de seguimiento: una comparación normal filtra
 * por cuánto tarda en fallar.
 *
 * SIN SECRETO CONFIGURADO SE RECHAZA TODO. Es lo contrario de lo cómodo, y es
 * a propósito: una ruta pública que mueve pedidos a "entregado" y que acepta
 * cualquier cosa mientras falte una variable de entorno es una puerta abierta
 * que nadie va a notar hasta que alguien la use.
 *
 * NO SE RETROCEDE. Los avisos llegan repetidos y desordenados —un `delivered`
 * puede adelantar a un `in_transit`— así que un estado sólo avanza. Sin esto
 * la bitácora contaría una historia falsa, que es justo lo que la máquina de
 * estados existe para evitar.
 */

/** Lo que Skydropx llama el estado del paquete, y a dónde lo llevamos. */
const MAPA: Record<string, EstadoPedido> = {
	// Ya está con la paquetería: salió del taller.
	picked_up: "enviado",
	in_transit: "enviado",
	last_mile: "enviado",
	delivery_attempt: "enviado",
	/* En sucursal esperando a que el cliente pase. Para la paquetería su
	   trabajo terminó; para quien compró, todavía no lo tiene. Se queda en
	   `enviado` hasta que llegue `delivered`. */
	delivered_to_branch: "enviado",
	delivered: "entregado",
};

/**
 * Estados en los que el envío se torció.
 *
 * No los movemos a ningún sitio todavía —no existe un estado para eso— pero se
 * anotan en la bitácora para que el taller los vea. Dejarlos pasar en silencio
 * significaría un paquete devuelto que nadie mira durante semanas.
 */
const PROBLEMAS = new Set([
	"exception",
	"in_return",
	"canceled",
	"destroyed",
	"retained",
]);

/** Cuánto ha avanzado un pedido. Sólo se sube, nunca se baja. */
const ORDEN: EstadoPedido[] = [
	"nuevo",
	"produccion",
	"listo",
	"enviado",
	"entregado",
];

type Cuerpo = Record<string, any>;

export async function recibir(
	cuerpo: unknown,
	crudo: string | undefined,
	headers: Record<string, string | undefined>,
) {
	verificarFirma(crudo, headers.authorization);

	const c = (cuerpo ?? {}) as Cuerpo;

	/* La forma REAL del aviso, comprobada con uno de Skydropx:
	 *
	 *   data.type                          = "packages"
	 *   data.attributes.status             = "in_transit"   <- NO tracking_status
	 *   data.relationships.shipment.data.id                 <- NO attributes.shipment_id
	 *
	 * Los dos campos que yo esperaba se llamaban de otra forma, así que el
	 * primer aviso real entró y se ignoró en silencio. Se leen los nombres
	 * buenos primero y se dejan los otros como respaldo: esta API ya cambió de
	 * nombres antes y el costo de aceptar ambos es una línea. */
	const datos = c.data ?? c;
	const atributos = datos?.attributes ?? {};

	const envioId = String(
		datos?.relationships?.shipment?.data?.id ??
			atributos.shipment_id ??
			datos?.shipment_id ??
			c.shipment_id ??
			"",
	);

	/* En minúsculas siempre. El panel de Skydropx lista los eventos como
	   `In_transit` y `Picked_up`, y si el aviso llegara con esa forma la tabla
	   de abajo no lo reconocería: el pedido no avanzaría y no habría error a la
	   vista. Normalizar cuesta nada y quita una clase entera de fallo mudo. */
	const estadoSkydropx = String(
		atributos.status ?? atributos.tracking_status ?? "",
	)
		.trim()
		.toLowerCase();

	/* La devolución viaja como bandera aparte, no como estado: un paquete
	   puede ir `in_transit` y estar volviéndose. Sin mirar esto, una
	   devolución en curso se vería como un envío normal. */
	const devuelto = atributos.returned === true;

	if (!envioId || !estadoSkydropx) {
		// Un aviso que no entendemos no es un error de Skydropx ni nuestro: se
		// contesta 200 para que no lo reintente eternamente, y al log entero.
		console.warn(
			"Aviso de rastreo sin envío o sin estado:",
			crudo?.slice(0, 400),
		);
		return { ok: true, ignorado: true };
	}

	const pedidoId = await pedidoDelEnvio(envioId);
	if (!pedidoId) {
		console.warn(`Aviso de un envío que no es nuestro: ${envioId}`);
		return { ok: true, ignorado: true };
	}

	const destino = devuelto ? undefined : MAPA[estadoSkydropx];
	const problema = devuelto || PROBLEMAS.has(estadoSkydropx);

	if (!destino && !problema) {
		// `created` y cualquier estado nuevo que inventen: se anota y ya.
		return { ok: true, ignorado: true };
	}

	await anotar(pedidoId, estadoSkydropx, destino, problema, {
		rastreo: atributos.tracking_number || null,
		rastreoUrl: atributos.tracking_url_provider || null,
	});
	return { ok: true };
}

/**
 * La firma, o nada.
 *
 * `timingSafeEqual` exige buffers del mismo largo, así que se compara el largo
 * antes: es público —lo dice el algoritmo— y no filtra nada.
 */
function verificarFirma(
	crudo: string | undefined,
	cabecera: string | undefined,
) {
	const secreto = process.env.SKYDROPX_WEBHOOK_SECRETO;

	if (!secreto) {
		console.error("Webhook de rastreo sin SKYDROPX_WEBHOOK_SECRETO: rechazado");
		throw noAutorizado();
	}

	if (!crudo || !cabecera) throw noAutorizado();

	// Llega como "HMAC <firma>"; se acepta también la firma pelada por si
	// cambian el formato, que ya nos ha pasado con esta API.
	const recibida = cabecera.replace(/^HMAC\s+/i, "").trim();

	const esperada = createHmac("sha512", secreto).update(crudo).digest("hex");

	const a = Buffer.from(recibida);
	const b = Buffer.from(esperada);

	if (a.length !== b.length || !timingSafeEqual(a, b)) throw noAutorizado();
}

async function pedidoDelEnvio(envioId: string): Promise<string | null> {
	const { Item } = await dynamo.send(
		new GetCommand({
			TableName: TABLA,
			Key: llaves.envioDeSkydropx(envioId),
		}),
	);

	return Item?.pedidoId ? String(Item.pedidoId) : null;
}

/**
 * Escribe el avance.
 *
 * La condición sobre el estado actual es lo que impide retroceder: si el
 * pedido ya está más adelante que el destino, el `UpdateItem` no entra. Un
 * aviso duplicado tampoco hace nada, que es lo que se espera de un webhook.
 */
async function anotar(
	pedidoId: string,
	estadoSkydropx: string,
	destino: EstadoPedido | undefined,
	problema: boolean,
	/** Lo que el aviso trae del paquete. Puede llegar antes que nada más. */
	delPaquete: { rastreo: string | null; rastreoUrl: string | null },
) {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.pedido(pedidoId) }),
	);
	if (!Item) return;

	const actual = String(Item.estado) as EstadoPedido;
	const ahora = new Date().toISOString();

	/* El número de rastreo y su enlace llegan aquí, y son lo que el comprador
	   pregunta. Se rellenan si faltan —al comprar la guía suelen venir vacíos—
	   pero NO se pisan si ya están: lo guardado salió de la compra y manda. */
	await rellenarRastreo(pedidoId, Item, delPaquete, ahora);

	/* Un webhook reintenta por diseño, así que el mismo aviso llega varias
	   veces. Sin esto la bitácora se llena de líneas idénticas — y esa
	   bitácora la ve el comprador en su seguimiento. Si el último apunte de la
	   paquetería dice ya lo mismo, no se escribe nada. */
	const bitacora = (Item.bitacora ?? []) as Cuerpo[];
	const ultimo = bitacora.at(-1);

	if (
		ultimo?.por === "paqueteria" &&
		typeof ultimo.nota === "string" &&
		ultimo.nota.endsWith(estadoSkydropx)
	) {
		return;
	}

	const avanza = !!destino && ORDEN.indexOf(destino) > ORDEN.indexOf(actual);

	const entrada = {
		estado: avanza ? destino : actual,
		en: ahora,
		por: "paqueteria",
		nota: problema
			? `La paquetería reporta: ${estadoSkydropx}`
			: `Rastreo: ${estadoSkydropx}`,
	};

	if (!avanza) {
		// Sólo bitácora: el pedido no cambia de estado pero el taller tiene que
		// poder ver que el paquete se devolvió o se quedó retenido.
		await dynamo.send(
			new UpdateCommand({
				TableName: TABLA,
				Key: llaves.pedido(pedidoId),
				UpdateExpression:
					"SET bitacora = list_append(bitacora, :e), updatedAt = :ahora",
				ExpressionAttributeValues: { ":e": [entrada], ":ahora": ahora },
			}),
		);
		return;
	}

	const indice = llaves.pedidoPorEstado(destino as string, ahora);

	await dynamo.send(
		new UpdateCommand({
			TableName: TABLA,
			Key: llaves.pedido(pedidoId),
			UpdateExpression:
				"SET #estado = :destino, updatedAt = :ahora, gsi2pk = :gsi2pk, " +
				"gsi2sk = :gsi2sk, bitacora = list_append(bitacora, :e)",
			ExpressionAttributeNames: { "#estado": "estado" },
			ExpressionAttributeValues: {
				":destino": destino,
				":ahora": ahora,
				":gsi2pk": indice.gsi2pk,
				":gsi2sk": indice.gsi2sk,
				":e": [entrada],
				":actual": actual,
			},
			// Si alguien lo movió mientras tanto, este aviso ya no aplica.
			ConditionExpression: "attribute_exists(pk) AND #estado = :actual",
		}),
	);
}

/**
 * Completa el rastreo del pedido con lo que trajo el aviso.
 *
 * Va aparte y con su propio `catch`: es información útil, no crítica. Si falla,
 * el estado del pedido tiene que avanzar igual — que es lo que de verdad
 * importa de este webhook.
 */
async function rellenarRastreo(
	pedidoId: string,
	pedido: Cuerpo,
	delPaquete: { rastreo: string | null; rastreoUrl: string | null },
	ahora: string,
) {
	const guia = (pedido.guia ?? {}) as Cuerpo;
	if (!guia.envioId) return;

	const rastreo = guia.rastreo ?? delPaquete.rastreo;
	const rastreoUrl = guia.rastreoUrl ?? delPaquete.rastreoUrl;

	if (rastreo === guia.rastreo && rastreoUrl === guia.rastreoUrl) return;

	await dynamo
		.send(
			new UpdateCommand({
				TableName: TABLA,
				Key: llaves.pedido(pedidoId),
				UpdateExpression: "SET #guia = :guia, updatedAt = :ahora",
				ExpressionAttributeNames: { "#guia": "guia" },
				ExpressionAttributeValues: {
					":guia": { ...guia, rastreo, rastreoUrl },
					":ahora": ahora,
				},
			}),
		)
		.catch((e) => console.error("No pudimos guardar el rastreo:", e));
}
