import { randomBytes, randomUUID } from "node:crypto";
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  dynamo,
  esConflicto,
  llaves,
  sinLlaves,
  TABLA,
  type Estado,
} from "../lib/dynamo.js";
import { conflicto, malaPeticion, noEncontrado } from "../lib/http.js";

/**
 * Los productos de un taller.
 *
 * El vocabulario de los campos se queda en inglés (`name`, `printSides`,
 * `pricing`…) porque es el que ya habla el asistente de alta del front. Lo
 * que agregamos nosotros va en español (`estado`, `proveedorId`,
 * `notaRevision`); traducir el payload a medias sería peor que la mezcla.
 */

/** Lo que el taller puede guardar. Todo lo que no esté aquí se ignora. */
const CAMPOS = [
  "name",
  "internalName",
  "sku",
  "description",
  "categoryIds",
  "templateId",
  "isCustomizable",
  "images",
  "printSides",
  "templateSides",
  "customizationRules",
  "sizes",
  "colors",
  "pricing",
  "production",
] as const;

type Cuerpo = Record<string, unknown>;

export async function listar(proveedorId: string) {
  const { Items } = await dynamo.send(
    new QueryCommand({
      TableName: TABLA,
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: {
        ":pk": llaves.productoDeProveedor(proveedorId, "", "").gsi1pk,
      },
      // Del más nuevo al más viejo: la fecha va en la llave de orden.
      ScanIndexForward: false,
    }),
  );

  return (Items ?? []).map(sinLlaves);
}

export async function obtener(proveedorId: string, id: string) {
  return sinLlaves(await suyoOFalla(proveedorId, id));
}

export async function crear(proveedorId: string, cuerpo: unknown) {
  const c = (cuerpo ?? {}) as Cuerpo;
  const datos = validar(c);

  const id = randomUUID();
  const ahora = new Date().toISOString();

  // El taller decide si lo manda a revisar o lo deja a medias; lo que no
  // puede es publicarlo. `activo` sólo lo pone el admin.
  const estado: Estado = c.enviar === true ? "en_revision" : "borrador";

  const item = {
    ...llaves.producto(id),
    ...llaves.productoDeProveedor(proveedorId, id, ahora),
    ...llaves.productoPorEstado(estado, ahora),
    id,
    ...datos,
    slug: "", // lo pone escribirConSlug, que es quien sabe cuál quedó libre
    estado,
    notaRevision: null,
    proveedorId,
    createdAt: ahora,
    updatedAt: ahora,
  };

  const slug = await escribirConSlug(item, aSlug(String(datos.name)), id);

  return { id, slug, estado };
}

/**
 * Guarda los cambios del taller.
 *
 * Un producto ya aprobado vuelve a `en_revision` en cuanto se toca: si no,
 * bastaría con publicar algo inocuo, esperar el visto bueno y cambiarle el
 * contenido después. La aprobación es del producto, no del momento.
 *
 * El slug NO se recalcula aunque cambie el nombre. Es la URL pública: si se
 * mueve, los enlaces que ya circulan dejan de existir.
 */
export async function actualizar(
  proveedorId: string,
  id: string,
  cuerpo: unknown,
) {
  const previo = await suyoOFalla(proveedorId, id);
  const c = (cuerpo ?? {}) as Cuerpo;

  const datos = validar({ ...previo, ...c });
  const ahora = new Date().toISOString();

  const estado: Estado =
    previo.estado === "activo" || c.enviar === true
      ? "en_revision"
      : (previo.estado as Estado);

  const asigna: string[] = ["#updatedAt = :updatedAt", "#estado = :estado"];
  const nombres: Record<string, string> = {
    "#updatedAt": "updatedAt",
    "#estado": "estado",
  };
  const valores: Record<string, unknown> = {
    ":updatedAt": ahora,
    ":estado": estado,
  };

  for (const campo of CAMPOS) {
    if (datos[campo] === undefined) continue;
    asigna.push(`#${campo} = :${campo}`);
    nombres[`#${campo}`] = campo;
    valores[`:${campo}`] = datos[campo];
  }

  // El índice de estados vive en el ítem: si no se reescribe, la bandeja del
  // admin sigue enseñando el producto en el estado viejo.
  const indice = llaves.productoPorEstado(estado, ahora);
  asigna.push("gsi2pk = :gsi2pk", "gsi2sk = :gsi2sk");
  valores[":gsi2pk"] = indice.gsi2pk;
  valores[":gsi2sk"] = indice.gsi2sk;

  const { Attributes } = await dynamo.send(
    new UpdateCommand({
      TableName: TABLA,
      Key: llaves.producto(id),
      UpdateExpression: `SET ${asigna.join(", ")}`,
      ExpressionAttributeNames: nombres,
      ExpressionAttributeValues: valores,
      ConditionExpression: "attribute_exists(pk)",
      ReturnValues: "ALL_NEW",
    }),
  );

  return sinLlaves(Attributes ?? {});
}

/* ─── Lo que sostiene todo lo de arriba ─────────────────────────────────── */

/**
 * Trae el producto sólo si es de quien lo pide.
 *
 * Responde 404 y no 403 a propósito: un 403 le confirmaría a un taller que
 * cierto id existe y es de otro.
 */
async function suyoOFalla(proveedorId: string, id: string) {
  const { Item } = await dynamo.send(
    new GetCommand({ TableName: TABLA, Key: llaves.producto(id) }),
  );

  if (!Item || Item.proveedorId !== proveedorId) {
    throw noEncontrado("Ese producto no existe o no es tuyo");
  }

  return Item;
}

/**
 * Escribe el producto y su candado de slug en la misma transacción.
 *
 * Dos talleres pueden llamarle igual a su playera negra, y rechazar el alta
 * por eso sería absurdo: si el slug está tomado, se reintenta con un sufijo
 * corto. Sólo si también choca —que ya es mala suerte— se rinde.
 */
async function escribirConSlug(
  item: Record<string, unknown>,
  base: string,
  id: string,
) {
  const candidatos = [
    base,
    `${base}-${randomBytes(2).toString("hex")}`,
    `${base}-${randomBytes(3).toString("hex")}`,
  ];

  for (const slug of candidatos) {
    try {
      await dynamo.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLA,
                Item: { ...item, slug },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: TABLA,
                Item: { ...llaves.slugDeProducto(slug), productId: id },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
          ],
        }),
      );

      return slug;
    } catch (error) {
      if (!esConflicto(error)) throw error;
    }
  }

  throw conflicto("No pudimos generarle una dirección única a este producto");
}

/**
 * Valida lo que rompe el producto, no lo que lo deja incompleto.
 *
 * El asistente del front ya valida por pasos, pero eso es cortesía para el
 * taller, no seguridad: aquí llega lo que llegue.
 */
function validar(c: Cuerpo) {
  const datos: Cuerpo = {};
  for (const campo of CAMPOS) {
    if (c[campo] !== undefined) datos[campo] = c[campo];
  }

  const name = String(datos.name ?? "").trim();
  if (!name) throw malaPeticion("Falta el nombre del producto");
  datos.name = name;

  if (!String(datos.templateId ?? "").trim()) {
    throw malaPeticion("Falta la plantilla: de ahí salen los lados imprimibles");
  }

  const precio = Number((datos.pricing as Cuerpo | undefined)?.basePrice ?? 0);
  if (!(precio > 0)) throw malaPeticion("El precio base tiene que ser mayor a 0");

  // Sin lados no hay nada que personalizar, y el editor se queda sin lienzo.
  if (!Array.isArray(datos.printSides) || datos.printSides.length === 0) {
    throw malaPeticion("Marca al menos un lado que puedas imprimir");
  }

  return datos;
}

/**
 * El rango de diacríticos se construye desde una cadena ASCII a propósito:
 * escrito con caracteres literales depende de cómo se guarde el archivo, y
 * si se estropea el slug sale mal sin que nadie se entere.
 */
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function aSlug(s: string) {
  const limpio = s
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  // Un nombre entero de emojis dejaría el slug vacío y el candado sería `SLUG#`.
  return limpio || "producto";
}
