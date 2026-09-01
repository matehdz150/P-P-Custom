import { randomBytes } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { BUCKET_PUBLICO, s3 } from "./s3";

/** Lo que aguanta el editor sin pelearse. */
const TIPOS = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

/** La URL firmada vive poco: es para subir ya, no para guardarla. */
const VIGENCIA_SEGUNDOS = 300;

@Injectable()
export class UploadsService {
  /**
   * Permiso para subir un mockup directo a S3.
   *
   * El archivo NUNCA pasa por la API: el navegador hace PUT contra la URL
   * firmada. Así no se paga tiempo de Lambda moviendo bytes ni se topa uno
   * con el límite de tamaño de API Gateway.
   *
   * Devuelve también la RUTA con la que hay que guardar el mockup —
   * `/mockups/...`, no la URL de S3. Eso es deliberado: los mockups se leen
   * desde el mismo origen que el sitio (rewrite en desarrollo, CloudFront en
   * producción) porque el teñido de prenda hace getImageData() sobre ellos.
   * Con una URL de S3 el canvas queda contaminado y el teñido se apaga solo.
   */
  async urlParaMockup(params: {
    templateId: string;
    side: string;
    contentType: string;
  }) {
    const ext = TIPOS.get(params.contentType);
    if (!ext) {
      throw new BadRequestException(
        `Tipo no soportado: ${params.contentType}. Usa PNG, JPG o WebP.`,
      );
    }

    const limpio = (s: string) => s.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 60);
    const templateId = limpio(params.templateId);
    const side = limpio(params.side);

    if (!templateId || !side) {
      throw new BadRequestException("Falta templateId o side");
    }

    // Nombre único por subida. Que sea inmutable es lo que deja cachear
    // para siempre en CloudFront: si el admin re-sube el mockup de un lado,
    // es una llave nueva y no hay que invalidar nada.
    const marca = randomBytes(6).toString("hex");
    const key = `mockups/${templateId}/${side}-${marca}.${ext}`;

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: BUCKET_PUBLICO,
        Key: key,
        ContentType: params.contentType,
      }),
      { expiresIn: VIGENCIA_SEGUNDOS },
    );

    return { uploadUrl, path: `/${key}` };
  }

  /**
   * Sirve un objeto del bucket público.
   *
   * Solo se usa en desarrollo, detrás del rewrite de Next, para que
   * `/mockups/...` sea del mismo origen que la app sin abrir el bucket. En
   * producción esto no se invoca: CloudFront lo sirve directo con OAC.
   */
  async leerPublico(key: string) {
    const { Body, ContentType } = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET_PUBLICO, Key: key }),
    );

    return {
      cuerpo: Body as NodeJS.ReadableStream,
      contentType: ContentType ?? "application/octet-stream",
    };
  }
}
