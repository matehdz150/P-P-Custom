import { randomUUID } from "node:crypto";
import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import {
	consultarTodo,
	dynamo,
	llaves,
	sinLlaves,
	TABLA,
} from "../lib/dynamo.js";
import { malaPeticion, noEncontrado } from "../lib/http.js";
import { copiar } from "../lib/medios.js";
import { correoDe, type Identidad } from "./pedidos.js";

/**
 * Los diseños guardados del comprador.
 *
 * QUÉ RESUELVE. Hoy "mis diseños" se deriva de los pedidos: para una empresa
 * que pide su logo cada mes, encontrarlo significa acordarse de en qué pedido
 * iba. Ponerle nombre lo convierte de subproducto en algo que se busca.
 *
 * NO HAY UN "GUARDAR" EN EL EDITOR, y es deliberado. Un diseño guardado nace
 * de una línea de pedido que ya existe: se le pone nombre y se asciende. Así
 * quien compra una vez no ve un concepto nuevo, y quien repite lo tiene arriba.
 */

const MAX_NOMBRE = 60;
/** Un tope alto pero real: sin él, un bucle deja la partición inservible. */
const MAX_DISENOS = 200;

type Cuerpo = Record<string, any>;

export async function listar(quien: Identidad) {
	const { pk, prefijo } = llaves.disenosDe(quien.sub);

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
 * Asciende una línea de pedido a diseño guardado.
 *
 * EL ARTE SE COPIA, NO SE REFERENCIA. Un diseño guardado sobrevive a su
 * pedido: apuntar a `medios/pedidos/<pedido>/…` lo dejaría colgando el día que
 * ese pedido se limpie, y además ata la vida del activo a la del documento que
 * sólo lo produjo una vez. La copia es del lado del servidor —ningún byte pasa
 * por el navegador— y sigue el mismo camino que `copiarDelCarrito` al comprar.
 */
export async function guardar(quien: Identidad, cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;

	const nombre = String(c.nombre ?? "").trim();
	if (!nombre) throw malaPeticion("Ponle un nombre para poder encontrarlo");
	if (nombre.length > MAX_NOMBRE) {
		throw malaPeticion(`El nombre no puede pasar de ${MAX_NOMBRE} caracteres`);
	}

	const pedidoId = String(c.pedidoId ?? "").trim();
	const lineaId = String(c.lineaId ?? "").trim();
	if (!pedidoId || !lineaId) {
		throw malaPeticion("Falta de qué pedido y de qué línea sale el diseño");
	}

	const { linea } = await lineaSuyaOFalla(quien, pedidoId, lineaId);

	const yaTiene = await listar(quien);
	if (yaTiene.length >= MAX_DISENOS) {
		throw malaPeticion(
			`Ya tienes ${MAX_DISENOS} diseños guardados. Borra alguno para guardar otro.`,
		);
	}

	/* El id empieza por la fecha para que ordenen solos por `sk`, pero SIN los
	   dos puntos ni los puntos del ISO: acaba en una llave de S3 y en una URL,
	   y ahí `:` obliga a codificar y `.` complica cualquier comprobación de
	   ruta. `20260903T175425-df08e579` ordena igual y no necesita escaparse. */
	const cuando = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
	const id = `${cuando}-${randomUUID().slice(0, 8)}`;
	const base = `medios/disenos/${quien.sub}/${id}`;

	// El primer lado es el que representa al diseño en la rejilla. La
	// COLOCACIÓN y no el arte: el arte va recortado y transparente, y en
	// pequeño no se reconoce.
	const primerLado = (linea.arte ?? [])[0];

	const diseno = await copiar(
		`medios/pedidos/${pedidoId}/${lineaId}-diseno.json`,
		`${base}.json`,
	);

	if (!diseno) {
		// Sin el diseño editable no hay nada que volver a abrir: guardarlo sería
		// prometer un botón que no va a funcionar.
		throw malaPeticion(
			"Ese pedido ya no conserva el diseño editable, así que no se puede guardar.",
		);
	}

	const miniatura = primerLado
		? await copiar(
				`medios/pedidos/${pedidoId}/${lineaId}-${primerLado.lado}-colocacion.png`,
				`${base}.png`,
			)
		: null;

	const ahora = new Date().toISOString();

	const item = {
		...llaves.diseno(quien.sub, id),
		id,
		nombre,
		/* Lo que hace falta para volver a pedirlo. Se copia del pedido: el
		   producto puede cambiar, pero el diseño se hizo PARA estas medidas. */
		productoId: String(linea.productoId ?? ""),
		producto: String(linea.producto ?? ""),
		colorPrenda: linea.colorPrenda ?? null,
		lados: (linea.lados ?? []) as string[],
		diseno: `/${base}.json`,
		miniatura: miniatura ? `/${base}.png` : null,
		/** De dónde salió. Sirve para no guardar dos veces la misma línea. */
		origen: { pedidoId, lineaId },
		vecesPedido: 1,
		ultimoPedido: String(linea.creadoEn ?? ahora),
		creadoEn: ahora,
	};

	await dynamo.send(new PutCommand({ TableName: TABLA, Item: item }));
	return sinLlaves(item);
}

export async function renombrar(quien: Identidad, id: string, cuerpo: unknown) {
	const nombre = String((cuerpo as Cuerpo)?.nombre ?? "").trim();
	if (!nombre) throw malaPeticion("Ponle un nombre para poder encontrarlo");
	if (nombre.length > MAX_NOMBRE) {
		throw malaPeticion(`El nombre no puede pasar de ${MAX_NOMBRE} caracteres`);
	}

	try {
		const { Attributes } = await dynamo.send(
			new UpdateCommand({
				TableName: TABLA,
				Key: llaves.diseno(quien.sub, id),
				UpdateExpression: "SET #nombre = :nombre",
				ExpressionAttributeNames: { "#nombre": "nombre" },
				ExpressionAttributeValues: { ":nombre": nombre },
				// La llave ya lleva el `sub`, así que no se puede renombrar el de
				// otro; esto sólo evita crear uno vacío con un id inventado.
				ConditionExpression: "attribute_exists(pk)",
				ReturnValues: "ALL_NEW",
			}),
		);

		return sinLlaves(Attributes ?? {});
	} catch (error) {
		if (
			(error as { name?: string })?.name === "ConditionalCheckFailedException"
		) {
			throw noEncontrado("Ese diseño no existe");
		}
		throw error;
	}
}

/**
 * Quita el diseño de la lista.
 *
 * NO se borran los archivos de S3. Cuestan centavos, y borrarlos abriría la
 * puerta a dejar sin arte a un pedido si algún día alguien hace que apunten al
 * mismo sitio. Lo que desaparece es el nombre y el atajo.
 */
export async function borrar(quien: Identidad, id: string) {
	await dynamo.send(
		new DeleteCommand({
			TableName: TABLA,
			Key: llaves.diseno(quien.sub, id),
		}),
	);

	return { borrado: true };
}

/* ─── Lo que sostiene todo lo de arriba ─────────────────────────────────── */

/**
 * La línea, sólo si el pedido es de quien lo pide.
 *
 * Mismo criterio que el resto de la cuenta: por CORREO VERIFICADO. Sin eso,
 * registrarse con el correo de otro bastaría para guardarse sus diseños.
 */
async function lineaSuyaOFalla(
	quien: Identidad,
	pedidoId: string,
	lineaId: string,
) {
	const correo = correoDe(quien);

	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.pedido(pedidoId) }),
	);

	if (!Item || String(Item.comprador?.email ?? "").toLowerCase() !== correo) {
		throw noEncontrado("No encontramos ese pedido");
	}

	const linea = ((Item.lineas ?? []) as Cuerpo[]).find(
		(l) => String(l.id) === lineaId,
	);

	if (!linea) throw noEncontrado("Ese pedido no tiene esa línea");

	// El tipo se declara: al esparcir un `Record<string, any>` TypeScript se
	// queda sólo con lo que ve escrito y pierde el resto de campos.
	const conFecha: Cuerpo = { ...linea, creadoEn: Item.createdAt };
	return { pedido: Item, linea: conFecha };
}
