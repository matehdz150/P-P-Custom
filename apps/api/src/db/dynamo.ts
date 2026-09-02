import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * El cliente de DynamoDB.
 *
 * Las credenciales NO se pasan a mano: el SDK las resuelve por su cadena
 * normal. En local sale del perfil (`AWS_PROFILE=kustto-admin`, con
 * ~/.aws montado); en Lambda sale del rol de ejecución, sin llaves de por
 * medio. Nunca hay un secreto en el código ni en el repositorio.
 */
const cliente = new DynamoDBClient({
	region: process.env.AWS_REGION ?? "us-east-1",
});

export const dynamo = DynamoDBDocumentClient.from(cliente, {
	marshallOptions: {
		// Un campo opcional que llega como undefined simplemente no se escribe,
		// en vez de tronar.
		removeUndefinedValues: true,
	},
});

/** La tabla única. Todo el sistema vive aquí; ver infra/tabla.sh. */
export const TABLA = process.env.KUSTTO_TABLA ?? "kustto-prod";

/* ─── Las llaves ──────────────────────────────────────────────────────────
   Están juntas a propósito: el reparto del espacio de llaves es la decisión
   más cara de cambiar, así que vive en un solo lugar y no desperdigada en
   cada servicio. */

export const llaves = {
	/** Las plantillas comparten partición: listarlas es un Query, no un Scan. */
	plantilla: (id: string) => ({ pk: "TEMPLATE", sk: `TPL#${id}` }),
	plantillas: () => "TEMPLATE",

	categoria: (id: string) => ({ pk: "CATEGORY", sk: `CAT#${id}` }),
	categorias: () => "CATEGORY",

	/** El producto completo en un ítem: un GetItem pinta la ficha entera. */
	producto: (id: string) => ({ pk: `PRODUCT#${id}`, sk: "META" }),
	proveedor: (id: string) => ({ pk: `PROVIDER#${id}`, sk: "META" }),
	pedido: (id: string) => ({ pk: `ORDER#${id}`, sk: "META" }),

	/** Candado de unicidad: en Dynamo no existe el constraint de Postgres. */
	slug: (slug: string) => ({ pk: `SLUG#${slug}`, sk: "LOCK" }),
};
