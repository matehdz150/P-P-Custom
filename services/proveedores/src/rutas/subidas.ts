import { randomBytes } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
 * Permiso para subir una foto de producto.
 *
 * QUIÉN DECIDE LA CARPETA — y por qué importa
 *
 *   El prefijo sale del `sub` del token, nunca del cuerpo de la petición.
 *   La Lambda tiene permiso de escritura sobre todo `medios/productos/*`
 *   —IAM no sabe de talleres, la política es de la función y no del usuario—
 *   así que lo único que impide que un taller escriba sobre las fotos de
 *   otro es esta línea. Si algún día la carpeta llega en el cuerpo, la
 *   separación entre talleres se acabó sin que nadie lo note.
 *
 * El archivo no pasa por la Lambda: el navegador hace PUT directo a S3. Se
 * devuelve una RUTA (`/medios/...`), nunca la URL del bucket, para que todo
 * se sirva desde el mismo origen que el sitio.
 */
export async function urlParaFoto(proveedorId: string, cuerpo: unknown) {
  const c = (cuerpo ?? {}) as Record<string, unknown>;

  const contentType = String(c.contentType ?? "");
  const ext = TIPOS.get(contentType);
  if (!ext) {
    throw malaPeticion(`Tipo no soportado: ${contentType}. Usa PNG, JPG o WebP.`);
  }

  const key = `medios/productos/${proveedorId}/${randomBytes(8).toString("hex")}.${ext}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: BUCKET_PUBLICO,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: VIGENCIA },
  );

  return { uploadUrl, path: `/${key}` };
}
