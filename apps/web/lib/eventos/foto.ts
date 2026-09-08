import { firmarFotoDeEvento } from "@/lib/api/eventos";

/**
 * Sube la portada de un evento y devuelve su ruta.
 *
 * DOS PASOS: la Lambda firma y el navegador hace el PUT directo a S3. El
 * archivo no pasa por la función, que es lo que evita pagar el tráfico y el
 * tiempo de ejecución de una foto de varios MB.
 *
 * LA CABECERA `content-type` DEL PUT TIENE QUE SER LA MISMA que se mandó a
 * firmar. S3 rechaza la subida si no coincide con la de la firma, y el error
 * que devuelve no menciona la cabecera.
 */
export async function subirFotoDeEvento(archivo: File) {
	const { uploadUrl, url } = await firmarFotoDeEvento({
		tipo: archivo.type,
		bytes: archivo.size,
	});

	const res = await fetch(uploadUrl, {
		method: "PUT",
		headers: { "content-type": archivo.type },
		body: archivo,
	});
	if (!res.ok) throw new Error("No pudimos subir la foto. Inténtalo otra vez.");

	return url;
}

export const TIPOS_DE_FOTO = "image/png,image/jpeg,image/webp";
export const MAXIMO_FOTO = 10 * 1024 * 1024;
