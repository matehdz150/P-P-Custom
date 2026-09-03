import { CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Mover archivos dentro del bucket público.
 *
 * SIEMPRE DEL LADO DEL SERVIDOR. Ni un byte pasa por el navegador: un arte de
 * producción son varios MB, y hacer que el cliente lo baje para volver a
 * subirlo multiplica por dos el tráfico de algo que ya está a un metro de
 * distancia. Es el mismo camino que sigue `copiarDelCarrito` al comprar.
 */

const s3 = new S3Client({});

export const BUCKET_PUBLICO =
	process.env.KUSTTO_BUCKET_PUBLICO ?? "kustto-publico-prod";

/**
 * Copia una llave a otra. Devuelve `false` si el origen no estaba.
 *
 * Que falte un archivo NO es excepcional: los pedidos viejos pueden no tener
 * diseño editable, y `carritos/` caduca a los 30 días. Quien llama decide si
 * eso es un problema — para el diseño editable lo es, para una miniatura no.
 */
export async function copiar(de: string, a: string) {
	try {
		await s3.send(
			new CopyObjectCommand({
				Bucket: BUCKET_PUBLICO,
				CopySource: `${BUCKET_PUBLICO}/${de}`,
				Key: a,
			}),
		);
		return true;
	} catch (error) {
		const nombre = (error as { name?: string })?.name;
		// AccessDenied entra aquí porque S3 lo devuelve en vez de NoSuchKey
		// cuando el rol no puede LEER el origen: sin permiso de lectura no se
		// puede distinguir "no existe" de "no te dejo verlo".
		if (nombre === "NoSuchKey" || nombre === "AccessDenied") return false;
		throw error;
	}
}
