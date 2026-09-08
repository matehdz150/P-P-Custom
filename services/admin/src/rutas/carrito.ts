import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { malaPeticion } from "../lib/http.js";

/**
 * Las subidas del carrito.
 *
 * POR QUÉ EXISTE ESTA RUTA, SIENDO PÚBLICA
 *
 *   El arte se sube al AGREGAR al carrito y no al pagar. Si esperara al pago,
 *   el carrito tendría que guardar los archivos mientras tanto, y no caben: un
 *   arte a 300 dpi son varios MB y el diseño editable lleva dentro las fotos
 *   del cliente. `localStorage` da unos 5 MB para todo el sitio.
 *
 *   El precio de esa decisión es esto: una ruta que firma escrituras sin
 *   sesión de por medio, igual que la de crear pedidos. Se acota con lo único
 *   que se puede acotar aquí:
 *
 *   - **El destino lo decide el servidor.** El `itemId` se genera aquí; del
 *     cuerpo no sale ni una parte de la ruta. Si viniera del cliente, se
 *     podría escribir sobre el arte de un pedido ajeno.
 *   - **El tipo está cerrado**: PNG para el arte, JSON para el diseño.
 *   - **El tamaño se firma.** Se manda cuántos bytes va a pesar y eso entra en
 *     la firma: subir otra cosa la invalida. Sin esto, "límite de tamaño"
 *     sería una promesa que S3 no comprueba.
 *   - **Todo caduca a los 30 días** (regla `carritos-caducan`, en
 *     `infra/buckets.sh`), porque la mayor parte de lo que se sube aquí es de
 *     gente que nunca llega a comprar.
 */

const s3 = new S3Client({});

const BUCKET_PUBLICO =
	process.env.KUSTTO_BUCKET_PUBLICO ?? "kustto-publico-prod";

/** Lo que tarda alguien en darle a "agregar" y que el navegador suba. */
const VIGENCIA = 900;

/**
 * Topes por archivo.
 *
 * El arte de un lado a 300 dpi ronda los pocos MB; 25 deja aire para un
 * diseño denso sin que quepa un vídeo. El diseño editable pesa menos, pero
 * lleva las fotos del cliente en base64 y por eso no es 1 MB.
 */
const MAXIMO = {
	arte: 25 * 1024 * 1024,
	colocacion: 25 * 1024 * 1024,
	/* La prenda real con el diseño encima. Sale de una foto de estudio
	   reescalada a 1600 px de ancho, así que pesa menos que el arte; el mismo
	   tope evita tener que pensarlo dos veces. */
	prenda: 25 * 1024 * 1024,
	/* El MISMO arte en trazos, para lo que no se imprime sino que se graba. Un
	   SVG es texto y pesa poco… salvo si alguien vectorizó una foto y trae
	   cuarenta mil trazos. Ahí el tope es la defensa. */
	vector: 12 * 1024 * 1024,
	diseno: 10 * 1024 * 1024,
} as const;

/* Cuatro archivos por lado —arte, colocación, prenda real y, en los productos
   de grabado, el vector— más el diseño. Con seis lados son veinticinco; se
   deja en veintiséis. Eran veinte cuando los archivos por lado eran tres. */
const MAXIMO_ARCHIVOS = 26;

type Tipo = keyof typeof MAXIMO;

const TIPOS: Record<Tipo, string> = {
	arte: "image/png",
	colocacion: "image/png",
	prenda: "image/png",
	vector: "image/svg+xml",
	diseno: "application/json",
};

/** Con qué extensión se guarda cada uno. Todo era `.png` hasta que entró el láser. */
const EXTENSION: Partial<Record<Tipo, string>> = {
	vector: "svg",
	diseno: "json",
};

const LIMPIO = (s: unknown) =>
	String(s ?? "")
		.replace(/[^a-zA-Z0-9-_]/g, "")
		.slice(0, 30);

export async function firmarSubidas(
	cuerpo: unknown,
	/* Sólo lo construyen rutas del servidor. En eventos incluye el id del
	   evento y del producto para que una referencia no se pueda reutilizar en
	   otro artículo del mismo enlace compartido. */
	prefijo: "carritos" | `eventos/${string}/${string}` = "carritos",
) {
	const c = (cuerpo ?? {}) as Record<string, unknown>;
	const archivos = Array.isArray(c.archivos) ? c.archivos : [];

	if (archivos.length === 0) throw malaPeticion("No dijiste qué vas a subir");

	if (archivos.length > MAXIMO_ARCHIVOS) {
		throw malaPeticion(
			`Demasiados archivos de una vez (${archivos.length}). El máximo es ${MAXIMO_ARCHIVOS}.`,
		);
	}

	// El destino lo decide el servidor, siempre.
	const itemId = randomUUID();

	const subidas = await Promise.all(
		archivos.map(async (a: Record<string, unknown>) => {
			const tipo = String(a.tipo ?? "") as Tipo;

			if (!(tipo in MAXIMO)) {
				throw malaPeticion(
					`Tipo de archivo desconocido: ${tipo || "(vacío)"}. Usa ${Object.keys(MAXIMO).join(", ")}.`,
				);
			}

			const bytes = Math.trunc(Number(a.bytes ?? 0));

			if (!(bytes > 0)) throw malaPeticion("Falta cuánto pesa el archivo");

			if (bytes > MAXIMO[tipo]) {
				const mb = Math.round(MAXIMO[tipo] / 1024 / 1024);
				throw malaPeticion(`Ese archivo pasa de ${mb} MB, que es el máximo`);
			}

			const lado = LIMPIO(a.lado);

			if (tipo !== "diseno" && !lado) {
				throw malaPeticion("Falta de qué lado es el archivo");
			}

			const nombre =
				tipo === "diseno"
					? "diseno.json"
					: `${lado}-${tipo}.${EXTENSION[tipo] ?? "png"}`;
			const key = `${prefijo}/${itemId}/${nombre}`;

			const uploadUrl = await getSignedUrl(
				s3,
				new PutObjectCommand({
					Bucket: BUCKET_PUBLICO,
					Key: key,
					ContentType: TIPOS[tipo],
					// Firmar el tamaño es lo que convierte el tope en una regla:
					// S3 rechaza la subida si el `content-length` no es este.
					ContentLength: bytes,
				}),
				{ expiresIn: VIGENCIA },
			);

			return { tipo, lado: lado || null, ruta: `/${key}`, uploadUrl };
		}),
	);

	return { itemId, subidas };
}
