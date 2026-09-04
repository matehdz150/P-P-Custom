import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { consultarTodo, dynamo, llaves, sinLlaves, TABLA } from "../lib/dynamo.js";
import { malaPeticion, noEncontrado } from "../lib/http.js";
import { BUCKET_PUBLICO } from "../lib/medios.js";
import type { Identidad } from "./pedidos.js";

/**
 * La biblioteca de imágenes del comprador.
 *
 * QUÉ RESUELVE. Quien pide para su empresa sube el MISMO logo cada vez. El
 * editor lo llevaba al lienzo y de ahí al arte del pedido, sin dejarlo en
 * ninguna parte donde volver a encontrarlo: la vez siguiente había que ir a
 * buscar el archivo otra vez. Ahora subir una imagen la guarda, y la próxima
 * está a un clic.
 *
 * VIVE EN `medios/imagenes/<sub>/` Y NO CADUCA, al revés que `carritos/`, que
 * se limpia a los 30 días (`infra/buckets.sh`). Una biblioteca que se vacía
 * sola no es una biblioteca.
 *
 * EL DESTINO LO DECIDE EL SERVIDOR. Del cuerpo no sale ni una parte de la
 * ruta: lleva el `sub` del token, así que nadie puede escribir en la carpeta
 * de otro por muy bien que arme la petición. Misma regla que el arte del
 * carrito.
 *
 * SÓLO CON SESIÓN, y no es una limitación que haya que superar: sin cuenta no
 * hay dónde colgar la biblioteca. Quien diseña sin entrar sigue subiendo
 * archivos como siempre; lo único que no tiene es memoria.
 */

const s3 = new S3Client({});

/**
 * Los tipos que se aceptan.
 *
 * SVG SE QUEDA FUERA a propósito, y no por capricho del lienzo: un SVG es un
 * documento que puede traer `<script>` dentro, y esto se sirve desde NUESTRO
 * origen (`/medios/…`). Aceptarlo sería dejar subir código ejecutable al
 * dominio donde vive la sesión de todo el mundo.
 */
const TIPOS: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

/** Una foto de teléfono ronda los 5 MB; 15 deja aire sin permitir un vídeo. */
const MAXIMO = 15 * 1024 * 1024;

/** Suficiente para el logo, sus variantes y las fotos de una campaña. */
const MAXIMAS = 60;

const ID = /^[a-zA-Z0-9-]{1,64}$/;

type Cuerpo = Record<string, any>;

export async function listar(quien: Identidad) {
	const { pk, prefijo } = llaves.imagenesDe(quien.sub);

	const items = await consultarTodo({
		TableName: TABLA,
		KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
		ExpressionAttributeValues: { ":pk": pk, ":sk": prefijo },
		// El id empieza por la fecha, así que al revés es de la más nueva a la
		// más vieja: lo último que subiste es lo primero que quieres ver.
		ScanIndexForward: false,
	});

	return items.map(sinLlaves);
}

/**
 * Firma la subida y devuelve dónde va a quedar.
 *
 * NO CREA EL REGISTRO. Se anota después, con `confirmar`, cuando el archivo ya
 * está en S3: al revés, un fallo de red a mitad de la subida dejaría la
 * biblioteca enseñando una imagen rota, que es peor que no enseñar nada.
 *
 * EL TAMAÑO VA DENTRO DE LA FIRMA (`ContentLength`), así que lo aplica S3. Sin
 * eso el tope sería una promesa de la que nadie se encarga.
 */
export async function firmarSubida(quien: Identidad, cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;

	const tipo = String(c.tipo ?? "");
	const extension = TIPOS[tipo];

	if (!extension) {
		throw malaPeticion(
			`Ese tipo de imagen no se puede guardar (${tipo || "sin tipo"}). Usa PNG, JPG o WebP.`,
		);
	}

	const bytes = Number(c.bytes ?? 0);
	if (!Number.isFinite(bytes) || bytes <= 0) {
		throw malaPeticion("Falta el tamaño de la imagen");
	}
	if (bytes > MAXIMO) {
		throw malaPeticion(
			`Esa imagen pesa demasiado. El máximo son ${Math.round(MAXIMO / 1024 / 1024)} MB.`,
		);
	}

	const cuantas = await listar(quien);
	if (cuantas.length >= MAXIMAS) {
		throw malaPeticion(
			`Ya tienes ${MAXIMAS} imágenes guardadas. Borra alguna para subir otra.`,
		);
	}

	/* El id empieza por la fecha para que ordenen solas por `sk`, pero SIN los
	   dos puntos ni los puntos del ISO: acaba en una URL y ahí `:` obliga a
	   codificar. Misma forma que los diseños y las plantillas. */
	const cuando = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
	const id = `${cuando}-${randomUUID().slice(0, 8)}`;
	const llave = `medios/imagenes/${quien.sub}/${id}.${extension}`;

	const uploadUrl = await getSignedUrl(
		s3,
		new PutObjectCommand({
			Bucket: BUCKET_PUBLICO,
			Key: llave,
			ContentType: tipo,
			ContentLength: bytes,
		}),
		{ expiresIn: 300 },
	);

	return {
		id,
		uploadUrl,
		/* Ruta relativa, NUNCA la de S3. El editor la mete en un lienzo y luego
		   exporta ese lienzo: una imagen de otro origen lo contamina y
		   `toDataURL` empieza a lanzar `SecurityError`. Es la misma regla que
		   obliga a servir los mockups desde nuestro dominio. */
		url: `/${llave}`,
	};
}

/** Anota la imagen ya subida. La llama el navegador cuando el PUT terminó. */
export async function confirmar(quien: Identidad, cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;

	const id = String(c.id ?? "").trim();
	if (!ID.test(id)) throw malaPeticion("Ese identificador no es válido");

	const url = String(c.url ?? "");
	/* Se comprueba que la ruta sea la SUYA y no cualquier cadena: sin esto, el
	   cuerpo podría apuntar la entrada a `medios/imagenes/<otro>/…` y la
	   biblioteca enseñaría el logo de otra empresa. */
	if (!url.startsWith(`/medios/imagenes/${quien.sub}/`)) {
		throw malaPeticion("Esa imagen no es de esta cuenta");
	}

	const item = {
		...llaves.imagen(quien.sub, id),
		id,
		url,
		nombre:
			String(c.nombre ?? "")
				.trim()
				.slice(0, 80) || "Imagen",
		ancho: Math.trunc(Number(c.ancho ?? 0)) || null,
		alto: Math.trunc(Number(c.alto ?? 0)) || null,
		creadaEn: new Date().toISOString(),
	};

	await dynamo.send(new PutCommand({ TableName: TABLA, Item: item }));
	return sinLlaves(item);
}

/**
 * Borra la imagen de la biblioteca Y el archivo.
 *
 * SE BORRA TAMBIÉN EL OBJETO, al revés que el arte de un pedido: aquél es un
 * registro de algo que se produjo y se conserva; esto es un archivo personal
 * que alguien pidió quitar, y dejarlo en S3 para siempre después de decirle
 * "borrada" sería mentirle.
 *
 * EL PEDIDO NO SE QUEDA SIN NADA. Lo que va a máquina es el arte exportado del
 * lienzo, que se copió a `medios/pedidos/` al comprar: borrar el original de
 * la biblioteca no toca un pedido ya hecho.
 */
export async function borrar(quien: Identidad, id: string) {
	if (!ID.test(id)) throw noEncontrado("Esa imagen no existe");

	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.imagen(quien.sub, id) }),
	);

	// La llave lleva el `sub` del token, así que esto sólo puede fallar si no
	// existe: nunca devuelve la de otra persona.
	if (!Item) throw noEncontrado("Esa imagen no existe");

	await dynamo.send(
		new DeleteCommand({ TableName: TABLA, Key: llaves.imagen(quien.sub, id) }),
	);

	try {
		await s3.send(
			new DeleteObjectCommand({
				Bucket: BUCKET_PUBLICO,
				Key: String(Item.url ?? "").slice(1),
			}),
		);
	} catch {
		// El registro ya no está, que es lo que la persona pidió. Un archivo
		// huérfano en S3 no se lo enseña a nadie y no vale un error en pantalla.
	}

	return { ok: true };
}
