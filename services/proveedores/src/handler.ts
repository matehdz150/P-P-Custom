import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo, llaves, sinLlaves, TABLA } from "./lib/dynamo.js";
import {
  crearRouter,
  json,
  malaPeticion,
  noAutorizado,
  noEncontrado,
  respuestaDeError,
} from "./lib/http.js";

/**
 * La API del panel del proveedor.
 *
 * Aquí NO se verifica ningún token: eso lo hace el autorizador JWT de API
 * Gateway antes de invocar la función. Si la petición llega hasta acá, el
 * token ya fue validado contra Cognito — firma, caducidad y audiencia.
 *
 * Lo que sí hay que hacer es leer QUIÉN es, y eso viene en las claims. El
 * `sub` del token es el mismo id con el que el proveedor está en DynamoDB,
 * así que no hay traducción de por medio.
 */

type Claims = { sub?: string; email?: string; name?: string };

function quienEs(evento: any): Claims {
  const claims =
    evento?.requestContext?.authorizer?.jwt?.claims ??
    evento?.requestContext?.authorizer?.claims;

  if (!claims?.sub) {
    // No debería pasar nunca: significaría que la ruta quedó sin autorizador.
    throw noAutorizado("El token no trae identidad");
  }

  return claims as Claims;
}

const router = crearRouter();

/** El perfil del proveedor que trae el token. Nunca el de otro. */
router.get("/proveedores/yo", async (p) => {
  const { Item } = await dynamo.send(
    new GetCommand({
      TableName: TABLA,
      Key: llaves.proveedor(p.headers["x-sub"]!),
    }),
  );

  if (!Item) {
    // El usuario existe en Cognito pero no en la tabla: pasa si el alta se
    // quedó a medias. Vale decirlo claro en vez de devolver un 404 mudo.
    throw noEncontrado(
      "Tu usuario existe pero no tiene perfil de proveedor. Avísale al admin.",
    );
  }

  return sinLlaves(Item);
});

/** El taller edita su propia ficha pública. */
router.patch("/proveedores/yo", async (p) => {
  const c = (p.cuerpo ?? {}) as Record<string, unknown>;

  const asigna: string[] = [];
  const nombres: Record<string, string> = {};
  const valores: Record<string, unknown> = {};

  // Lista blanca: el proveedor no puede cambiarse el id, el correo ni el
  // slug desde aquí. Sin esto, un PATCH podría reescribir su identidad.
  for (const campo of ["displayName", "bio", "avatarUrl", "bannerUrl"] as const) {
    if (c[campo] === undefined) continue;
    asigna.push(`#${campo} = :${campo}`);
    nombres[`#${campo}`] = campo;
    valores[`:${campo}`] = c[campo];
  }

  if (asigna.length === 0) throw malaPeticion("Nada que actualizar");

  const { Attributes } = await dynamo.send(
    new UpdateCommand({
      TableName: TABLA,
      Key: llaves.proveedor(p.headers["x-sub"]!),
      UpdateExpression: `SET ${asigna.join(", ")}`,
      ExpressionAttributeNames: nombres,
      ExpressionAttributeValues: valores,
      ConditionExpression: "attribute_exists(pk)",
      ReturnValues: "ALL_NEW",
    }),
  );

  return sinLlaves(Attributes ?? {});
});

export async function handler(evento: any) {
  const metodo: string = evento?.requestContext?.http?.method ?? "GET";
  const ruta: string = evento?.requestContext?.http?.path ?? "/";

  if (metodo === "OPTIONS") return json(204, null);

  try {
    const claims = quienEs(evento);

    const headers: Record<string, string | undefined> = Object.fromEntries(
      Object.entries(evento?.headers ?? {}).map(([k, v]) => [
        k.toLowerCase(),
        v as string,
      ]),
    );

    // La identidad viaja por aquí para que los handlers no tengan que
    // conocer la forma del evento de API Gateway.
    headers["x-sub"] = claims.sub;
    headers["x-email"] = claims.email;

    const cuerpoCrudo = evento?.isBase64Encoded
      ? Buffer.from(evento.body ?? "", "base64").toString("utf8")
      : evento?.body;

    return await router.resolver({
      metodo,
      ruta,
      query: evento?.queryStringParameters ?? {},
      cuerpo: cuerpoCrudo ? JSON.parse(cuerpoCrudo) : undefined,
      headers,
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}
