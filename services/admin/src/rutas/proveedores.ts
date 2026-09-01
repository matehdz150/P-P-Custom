import { randomBytes } from "node:crypto";
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

import {
  dynamo,
  esConflicto,
  llaves,
  sinLlaves,
  TABLA,
} from "../lib/dynamo.js";
import { conflicto, malaPeticion } from "../lib/http.js";

const cognito = new CognitoIdentityProviderClient({});
const POOL = process.env.KUSTTO_POOL_ID;

export async function listar() {
  const { Items } = await dynamo.send(
    new QueryCommand({
      TableName: TABLA,
      IndexName: "gsi1",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": "PROVIDER" },
    }),
  );

  return (Items ?? []).map(sinLlaves);
}

/**
 * Alta de proveedor.
 *
 * Son dos sistemas y el orden importa:
 *
 *   1. Cognito crea el usuario y devuelve su `sub`.
 *   2. Ese `sub` ES el id del proveedor en DynamoDB.
 *
 * Usar el mismo identificador en los dos lados evita una tabla de
 * equivalencias y, sobre todo, evita el bug clásico: el token dice una cosa
 * y la base otra. Cuando el proveedor llegue con su JWT, el `sub` del token
 * apunta directo a su ítem.
 *
 * La contraseña ya NO se guarda aquí. La administra Cognito, que además
 * obliga a cambiarla en el primer ingreso.
 *
 * El correo único se sigue defendiendo con el ítem-candado, aunque Cognito
 * también lo valide: si mañana alguien crea un proveedor sin pasar por
 * Cognito, la tabla no se corrompe.
 */
export async function crear(cuerpo: unknown) {
  if (!POOL) {
    throw new Error("Falta KUSTTO_POOL_ID: no se puede dar de alta sin Cognito");
  }

  const c = (cuerpo ?? {}) as Record<string, unknown>;

  const email = String(c.email ?? "").trim().toLowerCase();
  const name = String(c.name ?? "").trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw malaPeticion("Correo inválido");
  }
  if (!name) throw malaPeticion("Falta el nombre del taller");

  // Contraseña temporal. Cognito la marca como "hay que cambiarla" y en el
  // primer login lanza el reto NEW_PASSWORD_REQUIRED.
  const temporal = contrasenaTemporal();

  let sub: string;
  try {
    const { User } = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: POOL,
        Username: email,
        TemporaryPassword: temporal,
        // Sin correo automático por ahora: la contraseña se entrega a mano.
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: name },
        ],
      }),
    );

    sub = User?.Attributes?.find((a) => a.Name === "sub")?.Value ?? "";
    if (!sub) throw new Error("Cognito no devolvió el sub del usuario");
  } catch (error) {
    if ((error as { name?: string }).name === "UsernameExistsException") {
      throw conflicto(`Ya hay un proveedor con el correo ${email}`);
    }
    throw error;
  }

  const ahora = new Date().toISOString();

  try {
    await dynamo.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLA,
              Item: {
                ...llaves.proveedor(sub),
                ...llaves.proveedorEnIndice(sub),
                id: sub,
                email,
                name,
                slug: aSlug(name),
                displayName: name,
                bio: null,
                avatarUrl: null,
                bannerUrl: null,
                createdAt: ahora,
              },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Put: {
              TableName: TABLA,
              Item: { ...llaves.correoDeProveedor(email), providerId: sub },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
        ],
      }),
    );
  } catch (error) {
    // Cognito ya creó al usuario: si la tabla falla, queda huérfano. Se
    // borra para que reintentar el alta no choque con "ya existe".
    await cognito
      .send(
        new AdminSetUserPasswordCommand({
          UserPoolId: POOL,
          Username: email,
          Password: contrasenaTemporal(),
          Permanent: false,
        }),
      )
      .catch(() => {});

    if (esConflicto(error)) {
      throw conflicto(`Ya hay un proveedor con el correo ${email}`);
    }
    throw error;
  }

  // La temporal se devuelve UNA vez, para que el admin se la pase al
  // taller. No queda guardada en ningún lado.
  return {
    id: sub,
    email,
    name,
    slug: aSlug(name),
    createdAt: ahora,
    contrasenaTemporal: temporal,
  };
}

/** Cumple la política del pool: 10+, minúscula y número. */
function contrasenaTemporal() {
  return `Kt${randomBytes(9).toString("base64url")}7a`;
}

/**
 * El rango de diacríticos combinantes se construye desde una cadena ASCII a
 * propósito: escritos como caracteres literales dependen de la codificación
 * con que se guarde el archivo, y si se estropean el slug sale mal sin que
 * nadie se entere.
 */
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

function aSlug(s: string) {
  return s
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
