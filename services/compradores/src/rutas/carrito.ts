import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo, llaves, sinLlaves, TABLA } from "../lib/dynamo.js";
import { malaPeticion } from "../lib/http.js";
import type { Identidad } from "./pedidos.js";

/**
 * El carrito de quien tiene sesión.
 *
 * QUÉ GUARDA, Y QUÉ NO. Sólo rutas y cantidades: el arte ya vive en S3 desde
 * que se agregó al carrito, bajo `carritos/<itemId>/`. Meter los archivos aquí
 * reventaría el ítem —400 KB— con un solo diseño que lleve una foto.
 *
 * POR QUÉ SE GUARDA ENTERO Y NO POR ARTÍCULO. Un carrito son cuatro o cinco
 * cosas y siempre se lee completo. Guardarlo de una pieza deja que el
 * navegador y la cuenta hablen el mismo lenguaje —una lista— y hace trivial la
 * fusión al entrar: se juntan dos listas, no se reconcilian dos historiales.
 */

/** Un carrito no es un almacén. Con más de esto, algo va mal. */
const MAXIMO = 30;

type Cuerpo = Record<string, any>;

export async function obtener(quien: Identidad) {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.carrito(quien.sub) }),
	);

	if (!Item) return { articulos: [], actualizadoEn: null };

	return sinLlaves(Item);
}

/**
 * Guarda el carrito tal como viene.
 *
 * NO se valida contra el catálogo aquí a propósito: un producto puede
 * agotarse o dejar de publicarse mientras está en el carrito, y bloquear el
 * guardado dejaría a alguien sin poder ni quitar lo que ya no existe. Lo que
 * de verdad decide —que el producto siga publicado y a qué precio— se
 * comprueba al crear el pedido, que es donde importa.
 */
export async function guardar(quien: Identidad, cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;
	const articulos = Array.isArray(c.articulos) ? c.articulos : [];

	if (articulos.length > MAXIMO) {
		throw malaPeticion(
			`El carrito no admite más de ${MAXIMO} artículos. Pide en dos veces.`,
		);
	}

	const ahora = new Date().toISOString();

	await dynamo.send(
		new PutCommand({
			TableName: TABLA,
			Item: {
				...llaves.carrito(quien.sub),
				articulos,
				actualizadoEn: ahora,
			},
		}),
	);

	return { articulos, actualizadoEn: ahora };
}

/** Vaciar es borrar el ítem: un carrito vacío y uno que no existe son lo mismo. */
export async function vaciar(quien: Identidad) {
	await dynamo.send(
		new DeleteCommand({ TableName: TABLA, Key: llaves.carrito(quien.sub) }),
	);

	return { articulos: [], actualizadoEn: null };
}
