import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import * as catalogo from "./rutas/catalogo.js";
import * as pedidos from "./rutas/pedidos.js";
import * as productos from "./rutas/productos.js";
import * as subidas from "./rutas/subidas.js";
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

/**
 * Quién hace la petición. El `sub` lo pone el handler desde las claims del
 * token, así que aquí siempre está: si faltara, `quienEs` ya habría cortado.
 */
const quien = (p: { headers: Record<string, string | undefined> }) =>
  p.headers["x-sub"]!;

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

/* ─── El catálogo del taller ────────────────────────────────────────────── */

/** Las prendas base y las categorías, para el asistente de alta. Sólo leer. */
router.get("/proveedores/plantillas", () => catalogo.plantillas());
router.get("/proveedores/categorias", () => catalogo.categorias());

/** El permiso para subir una foto. La carpeta la decide el token, no el cuerpo. */
router.post("/proveedores/subidas/foto", (p) =>
  subidas.urlParaFoto(quien(p), p.cuerpo),
);

router.get("/proveedores/productos", (p) => productos.listar(quien(p)));
router.post("/proveedores/productos", (p) => productos.crear(quien(p), p.cuerpo));
router.get("/proveedores/productos/:id", (p) =>
  productos.obtener(quien(p), p.params.id),
);
router.patch("/proveedores/productos/:id", (p) =>
  productos.actualizar(quien(p), p.params.id, p.cuerpo),
);

/* Los pedidos los escribe el cliente por la ruta pública; el taller sólo ve
   los suyos y los mueve de estado. */
router.get("/proveedores/pedidos", (p) => pedidos.listar(quien(p)));
router.get("/proveedores/pedidos/:id", (p) =>
  pedidos.obtener(quien(p), p.params.id),
);
router.patch("/proveedores/pedidos/:id/estado", (p) =>
  pedidos.cambiarEstado(quien(p), p.params.id, p.cuerpo),
);

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
