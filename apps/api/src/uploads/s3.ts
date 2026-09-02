import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cliente de S3. Igual que Dynamo: las credenciales las resuelve el SDK del
 * perfil en local y del rol de ejecución en Lambda. Nunca hay una llave en
 * el código.
 */
export const s3 = new S3Client({
	region: process.env.AWS_REGION ?? "us-east-1",
});

/** Mockups y fotos de producto. Se sirven por CloudFront, nunca directo. */
export const BUCKET_PUBLICO =
	process.env.KUSTTO_BUCKET_PUBLICO ?? "kustto-publico-prod";

/** Logos del cliente y archivos de impresión. Nunca públicos. */
export const BUCKET_PRIVADO =
	process.env.KUSTTO_BUCKET_PRIVADO ?? "kustto-privado-prod";
