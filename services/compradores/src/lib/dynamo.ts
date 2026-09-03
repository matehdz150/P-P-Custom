import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	QueryCommand,
	type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

/**
 * Las credenciales las resuelve el SDK solo: del rol de ejecución en Lambda,
 * del perfil de ~/.aws cuando se corre en local. Nunca hay una llave en el
 * código ni en variables de entorno.
 */
const cliente = new DynamoDBClient({});

export const dynamo = DynamoDBDocumentClient.from(cliente, {
	marshallOptions: { removeUndefinedValues: true },
});

export const TABLA = process.env.KUSTTO_TABLA ?? "kustto-prod";

/**
 * Un `Query` completo, siguiendo las páginas.
 *
 * POR QUÉ EXISTE. DynamoDB corta toda respuesta de `Query` en **1 MB** y
 * devuelve `LastEvaluatedKey` para pedir el resto. Quien no lo lee recibe una
 * respuesta a medias SIN error de por medio: no hay excepción, no hay aviso,
 * simplemente faltan filas. Aquí se traducía en un catálogo al que le
 * empezaban a faltar productos y una bandeja a la que le faltaban pedidos, y
 * nadie se habría enterado hasta que un taller preguntara por uno.
 *
 * EL TOPE ES A PROPÓSITO Y AVISA. Traer sin límite acabaría reventando el
 * tope de 6 MB de respuesta de Lambda, que falla feo y tarde. Con `maximo` se
 * corta antes y se deja dicho en el log: sigue siendo una respuesta
 * incompleta, pero ahora es una que se puede encontrar.
 *
 * NO ES LA SOLUCIÓN DEFINITIVA para el catálogo público. Eso es la vista
 * materializada en S3 (ver infra/README.md); esto es lo que evita perder
 * datos en silencio mientras tanto.
 */
export async function consultarTodo(
	entrada: QueryCommandInput,
	maximo = 2000,
): Promise<Record<string, unknown>[]> {
	const items: Record<string, unknown>[] = [];
	let desde: Record<string, unknown> | undefined;

	do {
		const pagina = await dynamo.send(
			new QueryCommand({ ...entrada, ExclusiveStartKey: desde }),
		);

		items.push(...(pagina.Items ?? []));
		desde = pagina.LastEvaluatedKey;
	} while (desde && items.length < maximo);

	if (desde) {
		console.warn(
			`Consulta cortada en ${items.length} ítems (tope ${maximo}): ` +
				`${entrada.IndexName ?? "tabla"} ${JSON.stringify(entrada.ExpressionAttributeValues)}`,
		);
	}

	return items;
}

/* ─── Las llaves que toca el comprador ────────────────────────────────────
   Espejo del bloque de services/admin y services/proveedores: las tres
   copias tienen que moverse juntas. Ver infra/README.md. */

export const llaves = {
	/** El pedido, para comprobar que es suyo antes de enseñarlo. */
	pedido: (id: string) => ({ pk: `ORDER#${id}`, sk: "META" }),

	/**
	 * Los pedidos de un correo. Es el índice que hace que pedir SIN cuenta y
	 * ver tus pedidos DESPUÉS de crearla sean lo mismo: quien se registra con
	 * el correo con el que pidió, se encuentra su historial ya puesto.
	 */
	pedidosDeComprador: (correo: string) => ({
		gsi3pk: `BUYER#${correo.toLowerCase()}`,
	}),

	/**
	 * La cuenta del comprador: su perfil y sus direcciones.
	 *
	 * CUSTOMER y no BUYER a propósito, aunque hablen de la misma persona.
	 * `BUYER#` ya existe en gsi3 y va por CORREO; esto va por el `sub` de
	 * Cognito. Dos cosas distintas con el mismo prefijo es como alguien acaba
	 * escribiendo una donde va la otra.
	 */
	comprador: (sub: string) => ({ pk: `CUSTOMER#${sub}`, sk: "META" }),

	/**
	 * El carrito de quien tiene sesión.
	 *
	 * Cuelga del mismo `CUSTOMER#` que su perfil pero en otro `sk`: es un dato
	 * que cambia mucho más y que se lee solo, y meterlo dentro del perfil
	 * obligaría a reescribir el perfil entero cada vez que alguien agrega algo.
	 *
	 * Guarda RUTAS, no archivos: el arte ya está en S3 desde que se agregó
	 * (ver `carritos/` en infra/buckets.sh).
	 */
	carrito: (sub: string) => ({ pk: `CUSTOMER#${sub}`, sk: "CART" }),

	/**
	 * Un diseño guardado: el logo al que su dueño le puso nombre.
	 *
	 * CUELGA DEL MISMO `CUSTOMER#` que el perfil y el carrito, en otro `sk`. No
	 * es una comodidad, es la única forma de listarlos: los tres índices ya
	 * están ocupados (ver infra/README.md) y un cuarto obligaría a replantear
	 * el reparto entero. Con esto, "mis diseños" es un `Query` sobre la
	 * partición que ya existe, con `begins_with(sk, "DESIGN#")`.
	 */
	diseno: (sub: string, id: string) => ({
		pk: `CUSTOMER#${sub}`,
		sk: `DESIGN#${id}`,
	}),

	/** El prefijo con el que se listan. Espejo del `sk` de arriba. */
	disenosDe: (sub: string) => ({
		pk: `CUSTOMER#${sub}`,
		prefijo: "DESIGN#",
	}),

	/**
	 * El producto, para comparar lo que se pagó con lo que cuesta HOY.
	 *
	 * Sólo se lee. El comprador no escribe productos; esto existe porque
	 * repetir un pedido cruza la frontera entre lo congelado y el catálogo, y
	 * alguien tiene que mirar los dos lados.
	 */
	producto: (id: string) => ({ pk: `PRODUCT#${id}`, sk: "META" }),
};

/* ─── Existencias ─────────────────────────────────────────────────────────
   Espejo de services/admin y services/proveedores: los tres se mueven
   juntos. Ver infra/README.md. */

/** La llave de una variante dentro del mapa `existencias` del producto. */
export function variante(color: string | null, talla: string) {
	const limpia = (s: string) => s.trim().replace(/\|/g, "-");
	return color ? `${limpia(color)}|${limpia(talla)}` : limpia(talla);
}

/** Las llaves son de la tabla, no del recurso: no salen a la API. */
export function sinLlaves<T extends Record<string, unknown>>(item: T) {
	const { pk, sk, gsi1pk, gsi1sk, gsi2pk, gsi2sk, gsi3pk, gsi3sk, ...resto } =
		item;
	return resto;
}
