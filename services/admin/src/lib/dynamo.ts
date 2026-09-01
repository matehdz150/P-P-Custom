import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

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

/* ─── El reparto del espacio de llaves ────────────────────────────────────
   Vive en un solo archivo a propósito: es la decisión más cara de deshacer
   en DynamoDB, y desperdigada por los handlers se vuelve imposible de
   cambiar. Ver infra/tabla.sh. */

export const llaves = {
  /** Las colecciones chicas comparten partición: listarlas es Query, no Scan. */
  plantilla: (id: string) => ({ pk: "TEMPLATE", sk: `TPL#${id}` }),
  plantillas: "TEMPLATE",

  categoria: (id: string) => ({ pk: "CATEGORY", sk: `CAT#${id}` }),
  categorias: "CATEGORY",

  proveedor: (id: string) => ({ pk: `PROVIDER#${id}`, sk: "META" }),
  /** Para listarlos sin Scan, cada proveedor se indexa también en gsi1. */
  proveedorEnIndice: (id: string) => ({
    gsi1pk: "PROVIDER",
    gsi1sk: `PROVIDER#${id}`,
  }),

  /** Candado de unicidad: en Dynamo no existe el UNIQUE de Postgres. */
  correoDeProveedor: (correo: string) => ({
    pk: `PROVIDER_EMAIL#${correo.toLowerCase()}`,
    sk: "LOCK",
  }),
};

/** Las llaves son de la tabla, no del recurso: no salen a la API. */
export function sinLlaves<T extends Record<string, unknown>>(item: T) {
  const { pk, sk, gsi1pk, gsi1sk, gsi2pk, gsi2sk, gsi3pk, gsi3sk, ...resto } =
    item;
  return resto;
}

export function esConflicto(error: unknown) {
  const nombre = (error as { name?: string } | null)?.name;
  return (
    nombre === "ConditionalCheckFailedException" ||
    nombre === "TransactionCanceledException"
  );
}
