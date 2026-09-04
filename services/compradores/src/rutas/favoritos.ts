import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo, llaves, sinLlaves, TABLA } from "../lib/dynamo.js";
import { malaPeticion } from "../lib/http.js";
import type { Identidad } from "./pedidos.js";

/**
 * Los favoritos de quien tiene sesión.
 *
 * SÓLO IDS DE PRODUCTO. Nombre, foto y precio salen del catálogo al pintarlos:
 * copiarlos aquí sería tener el mismo dato en dos sitios, y el de aquí se
 * quedaría viejo en cuanto el taller cambiara un precio.
 *
 * SE GUARDA LA LISTA ENTERA, como el carrito. Son unas decenas y siempre se
 * leen completas; de una pieza, fundir lo del navegador con lo de la cuenta al
 * entrar es juntar dos listas en vez de reconciliar dos historiales.
 *
 * NO SE VALIDA CONTRA EL CATÁLOGO, también como el carrito: un producto puede
 * dejar de publicarse mientras está en favoritos, y rechazar el guardado
 * dejaría a alguien sin poder ni quitar lo que ya no existe. Al pintarlos se
 * cruzan con el catálogo y los que ya no están sencillamente no salen.
 */

/** Un id de producto es un uuid; nada de aquí sale a una ruta ni a una llave. */
const ID = /^[a-zA-Z0-9_-]{1,64}$/;

/** Con más de esto no es una lista de deseos, es un raspado. */
const MAXIMO = 200;

type Cuerpo = Record<string, any>;

export async function obtener(quien: Identidad) {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.favoritos(quien.sub) }),
	);

	if (!Item) return { ids: [], actualizadoEn: null };

	return sinLlaves(Item);
}

export async function guardar(quien: Identidad, cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;
	const crudos = Array.isArray(c.ids) ? c.ids : [];

	/* Se limpia en vez de rechazar: lo que llega es una lista que el navegador
	   fue armando a lo largo de meses, y tirarla entera porque un id venga raro
	   le borraría los favoritos buenos a alguien. */
	const ids = [
		...new Set(
			crudos
				.filter((v: unknown): v is string => typeof v === "string")
				.filter((v: string) => ID.test(v)),
		),
	];

	if (ids.length > MAXIMO) {
		throw malaPeticion(`No se pueden guardar más de ${MAXIMO} favoritos.`);
	}

	const ahora = new Date().toISOString();

	await dynamo.send(
		new PutCommand({
			TableName: TABLA,
			Item: {
				...llaves.favoritos(quien.sub),
				ids,
				actualizadoEn: ahora,
			},
		}),
	);

	return { ids, actualizadoEn: ahora };
}
