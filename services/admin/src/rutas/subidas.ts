import { randomBytes } from "node:crypto";
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { malaPeticion, noEncontrado } from "../lib/http.js";

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
/** Todo lo que llega del navegador y acaba en una key de S3 pasa por aquí. */
const limpio = (s: unknown) =>
	String(s ?? "")
		.replace(/[^a-zA-Z0-9-_]/g, "")
		.slice(0, 60);

function extension(contentType: string) {
	const ext = TIPOS.get(contentType);
	if (!ext) {
		throw malaPeticion(
			`Tipo no soportado: ${contentType}. Usa PNG, JPG o WebP.`,
		);
	}
	return ext;
}

async function firmar(key: string, contentType: string) {
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

export async function urlParaMockup(cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Record<string, unknown>;

	const contentType = String(c.contentType ?? "");
	const ext = extension(contentType);

	const templateId = limpio(c.templateId);
	const side = limpio(c.side);
	if (!templateId || !side) throw malaPeticion("Falta templateId o side");

	// Nombre único por subida: al ser inmutable se puede cachear para siempre
	// en CloudFront, y re-subir un lado no obliga a invalidar nada.
	const key = `mockups/${templateId}/${side}-${randomBytes(6).toString("hex")}.${ext}`;

	return firmar(key, contentType);
}

/**
 * Las carpetas donde el admin puede escribir imágenes que no son mockups.
 *
 * Es lista blanca porque el nombre llega del navegador: sin ella, una
 * petición podría pedir `carpeta: "mockups/tshirt"` y sobrescribir el mockup
 * de una plantilla en uso.
 */
const CARPETAS = new Set(["categorias", "paquetes", "productos"]);

/**
 * Permiso para subir una imagen del catálogo (la foto de una categoría, por
 * ejemplo). Mismo trato que los mockups: el archivo va directo del navegador
 * a S3 y lo que se guarda en la base es la RUTA, nunca la URL de S3, para
 * que todo se sirva desde el mismo origen que el sitio.
 *
 * Viven bajo `medios/` para que `/mockups/*` siga siendo sólo mockups: son
 * dos comportamientos distintos de caché el día que entre CloudFront.
 */
export async function urlParaImagen(cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Record<string, unknown>;

	const contentType = String(c.contentType ?? "");
	const ext = extension(contentType);

	const carpeta = limpio(c.carpeta);
	if (!CARPETAS.has(carpeta)) {
		throw malaPeticion(
			`Carpeta no permitida: ${carpeta || "(vacía)"}. Usa ${[...CARPETAS].join(", ")}.`,
		);
	}

	const key = `medios/${carpeta}/${randomBytes(8).toString("hex")}.${ext}`;

	return firmar(key, contentType);
}

/**
 * Sirve un objeto del bucket público.
 *
 * Es el camino de DESARROLLO, detrás del rewrite de Next, para que
 * `/mockups/...` sea del mismo origen sin abrir el bucket. En producción
 * CloudFront lo sirve directo con OAC y esto no se invoca.
 */
export async function leerPublico(key: string) {
	const salida = await s3
		.send(new GetObjectCommand({ Bucket: BUCKET_PUBLICO, Key: key }))
		.catch((error) => {
			const nombre = (error as { name?: string })?.name;

			// Un archivo que no está es un 404, no un 500: pasa con plantillas
			// viejas que apuntan a mockups que nunca se subieron, y un 500 manda a
			// buscar el problema en la Lambda en vez de en el dato.
			//
			// `AccessDenied` cuenta como "no existe" AQUÍ, y sólo aquí: el rol
			// tiene GetObject sobre todo el bucket pero NO ListBucket, y sin
			// ListBucket S3 contesta 403 en vez de 404 para no revelar qué hay
			// dentro. Si algún día se le quita GetObject al rol, esto empezará a
			// enseñar 404 donde en realidad falta un permiso.
			if (
				nombre === "NoSuchKey" ||
				nombre === "NotFound" ||
				nombre === "AccessDenied"
			) {
				throw noEncontrado(`No hay ningún archivo en ${key}`);
			}

			throw error;
		});

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
