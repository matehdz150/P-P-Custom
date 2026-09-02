import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo, llaves, sinLlaves, TABLA } from "../lib/dynamo.js";

/**
 * Lo que el taller necesita LEER para dar de alta un producto: las prendas
 * base y las categorías del catálogo.
 *
 * Existen aquí, y no se leen de la API de admin, porque el asistente de alta
 * las pedía por el proxy `/api/admin/*` — o sea, con la llave del admin
 * puesta. Funciona hoy sólo porque ese proxy no exige sesión; en cuanto el
 * admin tenga login, el taller se quedaría sin poder elegir prenda. Un
 * proveedor no debe pasar nunca por la puerta del admin.
 *
 * Son de sólo lectura: quien las crea y las borra sigue siendo el admin.
 */

export async function plantillas() {
  const { Items } = await dynamo.send(
    new QueryCommand({
      TableName: TABLA,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": llaves.plantillas },
    }),
  );

  return (Items ?? []).map(sinLlaves);
}

export async function categorias() {
  const { Items } = await dynamo.send(
    new QueryCommand({
      TableName: TABLA,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": llaves.categorias },
    }),
  );

  return (Items ?? []).map(sinLlaves);
}
