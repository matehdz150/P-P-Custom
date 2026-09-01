import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import {
  dynamo,
  esConflicto,
  llaves,
  sinLlaves,
  TABLA,
} from "../lib/dynamo.js";
import { malaPeticion, noEncontrado } from "../lib/http.js";

export async function listar() {
  const { Items } = await dynamo.send(
    new QueryCommand({
      TableName: TABLA,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: { ":pk": llaves.categorias },
    }),
  );

  return (Items ?? []).map(sinLlaves);
}

export async function crear(cuerpo: unknown) {
  const c = (cuerpo ?? {}) as Record<string, unknown>;

  const name = String(c.name ?? "").trim();
  const image = String(c.image ?? "").trim();
  const description = c.description ? String(c.description).trim() : null;

  if (!name) throw malaPeticion("Falta el nombre de la categoría");
  // La imagen no es opcional: es lo que se ve en el chip del catálogo.
  if (!image) throw malaPeticion("Falta la imagen de la categoría");

  const id = randomUUID();

  await dynamo.send(
    new PutCommand({
      TableName: TABLA,
      Item: {
        ...llaves.categoria(id),
        id,
        name,
        description,
        image,
        createdAt: new Date().toISOString(),
      },
    }),
  );

  return { id, name, description, image };
}

export async function actualizar(id: string, cuerpo: unknown) {
  const c = (cuerpo ?? {}) as Record<string, unknown>;

  const asigna: string[] = [];
  const nombres: Record<string, string> = {};
  const valores: Record<string, unknown> = {};

  for (const campo of ["name", "description", "image"] as const) {
    if (c[campo] === undefined) continue;
    asigna.push(`#${campo} = :${campo}`);
    nombres[`#${campo}`] = campo; // "name" es reservada en Dynamo
    valores[`:${campo}`] = c[campo];
  }

  if (asigna.length === 0) throw malaPeticion("Nada que actualizar");

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: TABLA,
        Key: llaves.categoria(id),
        UpdateExpression: `SET ${asigna.join(", ")}`,
        ExpressionAttributeNames: nombres,
        ExpressionAttributeValues: valores,
        ConditionExpression: "attribute_exists(pk)",
      }),
    );
  } catch (error) {
    if (esConflicto(error)) throw noEncontrado("Categoría no encontrada");
    throw error;
  }

  return { ok: true };
}

export async function borrar(id: string) {
  // Ojo: no valida que no haya productos usándola. Cuando migremos productos
  // hay que decidir si se bloquea el borrado o se limpian las referencias.
  try {
    await dynamo.send(
      new DeleteCommand({
        TableName: TABLA,
        Key: llaves.categoria(id),
        ConditionExpression: "attribute_exists(pk)",
      }),
    );
  } catch (error) {
    if (esConflicto(error)) throw noEncontrado("Categoría no encontrada");
    throw error;
  }

  return { ok: true };
}
