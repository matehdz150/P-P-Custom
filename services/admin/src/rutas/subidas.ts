import { randomBytes } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { malaPeticion } from "../lib/http.js";

const s3 = new S3Client({});

const BUCKET_PUBLICO =
  process.env.KUSTTO_BUCKET_PUBLICO ?? "kustto-publico-prod";

const TIPOS = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

/** La URL firmada es para subir ahora, no para guardarla. */
const VIGENCIA = 300;

/**
 * Permiso para subir un archivo directo a S3.
 *
 * El archivo NUNCA pasa por la Lambda: el navegador hace PUT contra la URL
 * firmada. Así no se paga tiempo de ejecución moviendo bytes ni se topa uno
 * con el límite de 10 MB de API Gateway.
 *
 * Devuelve una RUTA (`/mockups/...`), no la URL de S3. Es deliberado: los
 * mockups se leen desde el mismo origen que el sitio, porque el teñido de
 * prenda hace getImageData() sobre ellos y desde otro origen el canvas
 * queda contaminado y el teñido se apaga sin avisar.
 */
export async function urlParaMockup(cuerpo: unknown) {
  const c = (cuerpo ?? {}) as Record<string, unknown>;

  const contentType = String(c.contentType ?? "");
  const ext = TIPOS.get(contentType);
  if (!ext) {
    throw malaPeticion(`Tipo no soportado: ${contentType}. Usa PNG, JPG o WebP.`);
  }

  const limpio = (s: unknown) =>
    String(s ?? "").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 60);

  const templateId = limpio(c.templateId);
  const side = limpio(c.side);
  if (!templateId || !side) throw malaPeticion("Falta templateId o side");

  // Nombre único por subida: al ser inmutable se puede cachear para siempre
  // en CloudFront, y re-subir un lado no obliga a invalidar nada.
  const key = `mockups/${templateId}/${side}-${randomBytes(6).toString("hex")}.${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET_PUBLICO, Key: key, ContentType: contentType }),
    { expiresIn: VIGENCIA },
  );

  return { uploadUrl, path: `/${key}` };
}

/**
 * Sirve un objeto del bucket público.
 *
 * Es el camino de DESARROLLO, detrás del rewrite de Next, para que
 * `/mockups/...` sea del mismo origen sin abrir el bucket. En producción
 * CloudFront lo sirve directo con OAC y esto no se invoca.
 */
export async function leerPublico(key: string) {
  const salida = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET_PUBLICO, Key: key }),
  );

  const bytes = await salida.Body!.transformToByteArray();

  return {
    statusCode: 200,
    headers: {
      "content-type": salida.ContentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
    body: Buffer.from(bytes).toString("base64"),
    isBase64Encoded: true,
  };
}
