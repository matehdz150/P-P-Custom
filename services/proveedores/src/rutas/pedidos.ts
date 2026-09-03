import { GetCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { enviar } from "../lib/correo.js";
import {
	consultarTodo,
	dynamo,
	type EstadoPedido,
	esConflicto,
	llaves,
	sinLlaves,
	TABLA,
	variante,
} from "../lib/dynamo.js";
import { conflicto, malaPeticion, noEncontrado } from "../lib/http.js";
import {
	pedidoEntregado,
	pedidoEnviado,
	pedidoListo,
} from "../lib/plantillas.js";

/**
 * Los pedidos del taller.
 *
 * El pedido lo escribe el cliente por la ruta pública; aquí sólo se leen los
 * propios y se mueve su estado.
 */

/**
 * A dónde puede ir cada estado.
 *
 * Se declara en vez de aceptar cualquier salto para que la bitácora signifique
 * algo: sin esto, un pedido podría aparecer "entregado" sin haber pasado por
 * producción, y el historial dejaría de contar lo que de verdad ocurrió.
 * Volver atrás no está permitido a propósito — si un taller se equivoca, la
 * corrección la hace el admin, y queda anotada.
 */
const TRANSICIONES: Record<EstadoPedido, EstadoPedido[]> = {
	/* Cancelar SÓLO desde `nuevo`, o sea antes de que el taller lo empiece.
	   Antes se podía desde `produccion` y no debía: ahí la prenda ya se está
	   fabricando y las existencias ya se consumieron, así que anularlo no es
	   cancelar sino devolver, que es otro flujo con sus propias reglas. */
	nuevo: ["produccion", "cancelado"],
	produccion: ["listo"],
	/* De `listo` se sale por donde diga la entrega, y eso no cabe en esta
	   tabla: lo afina `permitidos()`. Con envío hay que pasar por `enviado`;
	   quien recoge en el taller va directo a `entregado`. */
	listo: ["enviado", "entregado"],
	enviado: ["entregado"],
	entregado: [],
	cancelado: [],
};

/**
 * Los destinos válidos para ESTE pedido.
 *
 * La tabla sola no basta porque el camino depende de cómo se entrega:
 *
 * - Con **envío**, saltar de `listo` a `entregado` se saltaría el hecho de que
 *   el paquete viajó, y `entregado` acabaría siendo la palabra del taller
 *   sobre algo que sabe la paquetería.
 * - Con **recoger**, `enviado` no significa nada: nadie lo envía.
 */
function permitidos(pedido: Record<string, unknown>, actual: EstadoPedido) {
	const destinos = TRANSICIONES[actual] ?? [];
	if (actual !== "listo") return destinos;

	const entrega = pedido.entrega as { metodo?: string } | undefined;

	return entrega?.metodo === "recoger"
		? destinos.filter((e) => e !== "enviado")
		: destinos.filter((e) => e !== "entregado");
}

/**
 * La huella del token de seguimiento no sale de la Lambda, ni al taller.
 *
 * Se exporta para que cualquier ruta que devuelva un pedido use ESTA y no
 * `sinLlaves` a secas: `guias.ts` lo hacía y la huella se le estaba
 * devolviendo al taller al comprar una guía.
 */
export function sinSecretos(item: Record<string, unknown>) {
	const { tokenHuella, ...resto } = sinLlaves(item);
	return resto;
}

export async function listar(proveedorId: string) {
	const items = await consultarTodo({
		TableName: TABLA,
		IndexName: "gsi1",
		KeyConditionExpression: "gsi1pk = :pk",
		ExpressionAttributeValues: {
			":pk": llaves.pedidoDeProveedor(proveedorId, "", "").gsi1pk,
		},
		ScanIndexForward: false,
	});

	return items.map(sinSecretos);
}

export async function obtener(proveedorId: string, id: string) {
	return sinSecretos(await suyoOFalla(proveedorId, id));
}

/**
 * Mueve el pedido y deja constancia.
 *
 * La condición sobre el estado anterior no es decorativa: dos personas del
 * mismo taller con el panel abierto pueden apretar a la vez, y sin ella la
 * segunda pisaría a la primera y la bitácora contaría una historia falsa.
 */
export async function cambiarEstado(
	proveedorId: string,
	id: string,
	cuerpo: unknown,
) {
	const c = (cuerpo ?? {}) as Record<string, unknown>;
	const destino = String(c.estado ?? "") as EstadoPedido;
	const nota = String(c.nota ?? "").trim() || null;

	const pedido = await suyoOFalla(proveedorId, id);
	const actual = String(pedido.estado) as EstadoPedido;

	const destinos = permitidos(pedido, actual);
	if (!destinos.includes(destino)) {
		throw malaPeticion(
			destinos.length === 0
				? `Un pedido ${actual} ya no se mueve`
				: `De ${actual} sólo puede pasar a ${destinos.join(" o ")}`,
		);
	}

	const ahora = new Date().toISOString();
	const indice = llaves.pedidoPorEstado(destino, ahora);

	try {
		const { Attributes } = await dynamo.send(
			new UpdateCommand({
				TableName: TABLA,
				Key: llaves.pedido(id),
				UpdateExpression:
					"SET #estado = :destino, updatedAt = :ahora, gsi2pk = :gsi2pk, " +
					"gsi2sk = :gsi2sk, bitacora = list_append(bitacora, :entrada)",
				ExpressionAttributeNames: { "#estado": "estado" },
				ExpressionAttributeValues: {
					":destino": destino,
					":ahora": ahora,
					":gsi2pk": indice.gsi2pk,
					":gsi2sk": indice.gsi2sk,
					":entrada": [{ estado: destino, en: ahora, por: "taller", nota }],
					":actual": actual,
				},
				ConditionExpression: "attribute_exists(pk) AND #estado = :actual",
				ReturnValues: "ALL_NEW",
			}),
		);

		// Después de mover, y sin poder tumbar el cambio de estado: el pedido ya
		// está cancelado de cara al taller y al comprador. Si esto fallara, lo
		// que queda mal es un contador, no el pedido.
		if (destino === "cancelado") await devolverExistencias(pedido);

		/* "Tu pedido va en camino", con el número de rastreo.
		 *
		 * Va dentro del `try` y DESPUÉS del `UpdateItem` con su condición: si
		 * dos personas del taller le dan a la vez, sólo una pasa de aquí y el
		 * cliente recibe un solo correo.
		 *
		 * El mismo aviso lo manda también el webhook de la paquetería cuando es
		 * ella quien mueve el pedido — ver `services/admin/src/rutas/rastreo.ts`.
		 * Los dos caminos existen porque hoy el taller puede marcarlo a mano. */
		/* Los avisos al comprador viven todos aquí dentro, después del
		 * `UpdateItem` con su condición: si dos personas del taller mueven el
		 * pedido a la vez, sólo una pasa de este punto y sale UN correo.
		 *
		 * De `produccion` no se avisa a propósito: entre que entra el pedido y
		 * que está hecho no hay nada que el comprador pueda hacer, y un correo
		 * que no pide nada enseña a ignorar los que sí importan. */
		const movido = (Attributes ?? pedido) as Record<string, any>;

		if (destino === "listo") await avisarQueEstaListo(proveedorId, movido);
		if (destino === "enviado") await avisarQueSalio(movido);
		/* Sólo llega aquí lo que se recogió en el taller: con envío, `entregado`
		 * lo pone la paquetería por webhook —`services/admin/src/rutas/rastreo.ts`,
		 * que manda el mismo correo— y `permitidos()` cierra este camino. */
		if (destino === "entregado") await avisarQueLlego(movido);

		return sinSecretos(Attributes ?? {});
	} catch (error) {
		if (esConflicto(error)) {
			throw conflicto(
				"Alguien movió este pedido mientras lo mirabas. Recárgalo.",
			);
		}
		throw error;
	}
}

/**
 * Devuelve al inventario lo que el pedido había descontado.
 *
 * Sólo al cancelar. Un pedido entregado no devuelve nada: esas prendas se
 * fueron de verdad.
 *
 * SE DEVUELVE CONTRA EL PRODUCTO ACTUAL, no contra el de la compra. Si el
 * taller ya apagó el control de stock, el `SET` sobre `existencias` reventaría
 * con `ValidationException` —el mapa ya no está—, así que se comprueba antes.
 * Es una operación de conveniencia: si no se puede, no pasa nada grave.
 *
 * NUNCA lanza. Corre después de que el pedido ya se movió.
 */
async function devolverExistencias(pedido: Record<string, unknown>) {
	const lineas = (pedido.lineas ?? []) as Record<string, any>[];

	// Se juntan por producto: dos líneas del mismo producto son dos escrituras
	// al mismo ítem, y eso una transacción no lo admite.
	const porProducto = new Map<string, Map<string, number>>();

	for (const l of lineas) {
		const id = String(l.productoId ?? "");
		if (!id) continue;

		const acumulado = porProducto.get(id) ?? new Map<string, number>();
		for (const t of (l.tallas ?? []) as { size: string; piezas: number }[]) {
			const clave = variante(l.colorPrenda ?? null, t.size);
			acumulado.set(clave, (acumulado.get(clave) ?? 0) + t.piezas);
		}
		porProducto.set(id, acumulado);
	}

	await Promise.all(
		[...porProducto].map(async ([id, variantes]) => {
			try {
				const nombres: Record<string, string> = {};
				const valores: Record<string, number> = { ":cero": 0 };
				const sets: string[] = [];

				[...variantes].forEach(([clave, piezas], n) => {
					nombres[`#v${n}`] = clave;
					valores[`:n${n}`] = piezas;
					sets.push(
						`existencias.#v${n} = if_not_exists(existencias.#v${n}, :cero) + :n${n}`,
					);
				});

				await dynamo.send(
					new UpdateCommand({
						TableName: TABLA,
						Key: llaves.producto(id),
						UpdateExpression: `SET ${sets.join(", ")}`,
						ExpressionAttributeNames: nombres,
						ExpressionAttributeValues: valores,
						// Todo producto lleva cuenta, pero los de antes de esa regla
						// pueden no tener el mapa: sin él, escribir dentro revienta
						// con `ValidationException`. La condición lo salta callando.
						ConditionExpression: "attribute_exists(existencias)",
					}),
				);
			} catch (error) {
				if (esConflicto(error)) return;
				console.error(`No pudimos devolver existencias de ${id}:`, error);
			}
		}),
	);
}

/**
 * Trae el pedido sólo si es de quien lo pide.
 *
 * 404 y no 403: un 403 le confirmaría a un taller que cierto pedido existe y
 * es de otro, con lo que eso dice de la competencia.
 */
async function suyoOFalla(proveedorId: string, id: string) {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.pedido(id) }),
	);

	if (!Item || Item.proveedorId !== proveedorId) {
		throw noEncontrado("Ese pedido no existe o no es tuyo");
	}

	return Item;
}

/** Lo que todos los avisos necesitan del pedido, en un solo sitio. */
function paraElAviso(pedido: Record<string, any>) {
	const comprador = (pedido.comprador ?? {}) as Record<string, any>;
	const primera = ((pedido.lineas ?? []) as Record<string, any>[])[0];

	return {
		email: String(comprador.email ?? ""),
		nombre: String(comprador.nombre ?? ""),
		folio: String(pedido.folio ?? ""),
		producto: String(primera?.producto ?? "Tu pedido"),
		piezas: Number(pedido.piezas ?? 0),
		metodo:
			pedido.entrega?.metodo === "recoger"
				? ("recoger" as const)
				: ("envio" as const),
	};
}

/**
 * "Ya está hecho".
 *
 * Con `recoger` es EL correo del pedido: sin él, quien compró no tiene forma
 * de enterarse de que puede ir por su prenda, porque después de esto ya no hay
 * más estados que le avisen de nada. Por eso lleva la dirección del taller y
 * su WhatsApp, y por eso se lee el taller aquí aunque cueste una lectura más.
 *
 * Con envío se manda igual, pero es sólo informativo: el que importa es el de
 * "va en camino", que trae el rastreo.
 *
 * Nunca lanza, como todos: el pedido ya se movió.
 */
async function avisarQueEstaListo(
	proveedorId: string,
	pedido: Record<string, any>,
) {
	try {
		const d = paraElAviso(pedido);
		if (!d.email) return;

		let taller: string | null = null;
		let direccion: string | null = null;
		let whatsapp: string | null = null;

		// Sólo se lee el taller si el cliente va a ir: con envío, su dirección no
		// pinta nada en el correo y la lectura sobraría.
		if (d.metodo === "recoger") {
			const { Item } = await dynamo.send(
				new GetCommand({
					TableName: TABLA,
					Key: llaves.proveedor(proveedorId),
				}),
			);

			taller = (Item?.displayName ?? Item?.name ?? null) as string | null;
			whatsapp = (Item?.whatsapp ?? null) as string | null;

			const r = Item?.recoleccion as Record<string, any> | undefined;
			if (r?.calle) {
				direccion = [
					[r.calle, r.numero].filter(Boolean).join(" "),
					r.interior ? `int. ${r.interior}` : "",
					r.colonia,
					[r.cp, r.ciudad].filter(Boolean).join(" "),
					r.estado,
				]
					.filter(Boolean)
					.join(", ");
			}
		}

		await enviar(
			pedidoListo({
				para: d.email,
				nombre: d.nombre,
				folio: d.folio,
				producto: d.producto,
				piezas: d.piezas,
				metodo: d.metodo,
				taller,
				direccion,
				whatsapp,
			}),
		);
	} catch (error) {
		console.error("No pudimos avisar que está listo:", error);
	}
}

/** El que cierra: el cliente ya lo recogió. Nunca lanza. */
async function avisarQueLlego(pedido: Record<string, any>) {
	try {
		const d = paraElAviso(pedido);
		if (!d.email) return;

		await enviar(
			pedidoEntregado({
				para: d.email,
				nombre: d.nombre,
				folio: d.folio,
				producto: d.producto,
				metodo: d.metodo,
			}),
		);
	} catch (error) {
		console.error("No pudimos avisar que llegó:", error);
	}
}

/**
 * Le dice al comprador que su paquete salió.
 *
 * Nunca lanza: el pedido ya se movió y el taller ya lo vio moverse. Si el
 * correo falla, lo que se pierde es un aviso, no el estado.
 *
 * Sin número de rastreo no se manda: un "va en camino" sin nada que rastrear
 * no le sirve a nadie y quema la confianza en el siguiente.
 */
async function avisarQueSalio(pedido: Record<string, any>) {
	try {
		const guia = pedido.guia ?? {};
		const comprador = pedido.comprador ?? {};

		if (!guia.rastreo || !comprador.email) return;

		await enviar(
			pedidoEnviado({
				para: String(comprador.email),
				nombre: String(comprador.nombre ?? ""),
				folio: String(pedido.folio ?? ""),
				paqueteria: String(
					guia.paqueteria ?? pedido.envio?.paqueteria ?? "la paquetería",
				),
				rastreo: String(guia.rastreo),
				rastreoUrl: guia.rastreoUrl ?? null,
			}),
		);
	} catch (error) {
		console.error("No pudimos avisar que salió:", error);
	}
}
