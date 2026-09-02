import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

/**
 * El buzón de kustto: reenvía a una bandeja de verdad lo que llega al dominio.
 *
 * SES ya dejó el correo crudo en S3 antes de invocar esto —las acciones de
 * una regla corren en orden—, así que aquí sólo se lee, se le arreglan las
 * cabeceras y se vuelve a enviar.
 *
 * POR QUÉ NO SE PUEDE REENVIAR TAL CUAL
 *
 * El `From` original NO puede quedarse. Si reenviamos un correo de
 * `alguien@gmail.com` diciendo que viene de `alguien@gmail.com`, lo estamos
 * mandando nosotros desde una IP de SES que el SPF de Gmail no autoriza: el
 * destino lo marca como falsificación y va a spam, o lo rechaza. Por eso el
 * `From` pasa a ser nuestro y el remitente real viaja en el `Reply-To`, que
 * es lo que hace que "Responder" siga funcionando.
 *
 * Y hay que quitar la `DKIM-Signature` original: se calculó sobre un mensaje
 * que acabamos de modificar, así que ya no cuadra. Una firma que no valida es
 * peor que ninguna.
 */

const s3 = new S3Client({});
const ses = new SESv2Client({});

const BUCKET = process.env.KUSTTO_BUCKET_CORREO ?? "";
const PREFIJO = process.env.KUSTTO_PREFIJO_CORREO ?? "entrada/";
/** Desde dónde decimos que va. Tiene que ser del dominio verificado. */
const REMITENTE = process.env.KUSTTO_REMITENTE ?? "";
/** A dónde se reenvía. La bandeja de verdad. */
const DESTINO = process.env.KUSTTO_DESTINO ?? "";

/**
 * Cabeceras que se caen al reenviar.
 *
 * Las de firma y ruta describen el mensaje ORIGINAL y su viaje hasta
 * nosotros. Conservadas sobre un mensaje reescrito y reenviado, o no validan
 * o mienten. `Return-Path` además lo pone el que envía, no el que redacta.
 */
const FUERA = new Set([
	"dkim-signature",
	"domainkey-signature",
	"arc-authentication-results",
	"arc-message-signature",
	"arc-seal",
	"authentication-results",
	"received-spf",
	"return-path",
	"sender",
	"from",
	"reply-to",
	"to",
	"cc",
	"bcc",
	"message-id",
]);

type Cabecera = { nombre: string; linea: string };

/**
 * Parte el mensaje en cabeceras y cuerpo.
 *
 * Una cabecera puede ocupar varias líneas: las continuaciones empiezan por
 * espacio o tabulador y pertenecen a la anterior. Partiendo por líneas sin
 * respetar eso, un asunto largo se convierte en una cabecera inventada.
 */
function partir(crudo: string) {
	const corte = crudo.search(/\r?\n\r?\n/);
	if (corte === -1) return { cabeceras: [] as Cabecera[], cuerpo: crudo };

	const bloque = crudo.slice(0, corte);
	const cuerpo = crudo.slice(corte).replace(/^\r?\n\r?\n/, "");

	const cabeceras: Cabecera[] = [];
	for (const linea of bloque.split(/\r?\n/)) {
		if (/^[ \t]/.test(linea) && cabeceras.length > 0) {
			cabeceras[cabeceras.length - 1].linea += `\r\n${linea}`;
			continue;
		}
		const dosPuntos = linea.indexOf(":");
		if (dosPuntos === -1) continue;
		cabeceras.push({
			nombre: linea.slice(0, dosPuntos).trim().toLowerCase(),
			linea,
		});
	}

	return { cabeceras, cuerpo };
}

function valorDe(cabeceras: Cabecera[], nombre: string) {
	const c = cabeceras.find((x) => x.nombre === nombre);
	if (!c) return "";
	return c.linea
		.slice(c.linea.indexOf(":") + 1)
		.replace(/\r?\n[ \t]+/g, " ")
		.trim();
}

/**
 * El nombre para mostrar del reenvío.
 *
 * Se cita siempre y se le escapan las comillas: un remitente llamado
 * `Juan "El Bueno"` rompería la cabecera y con ella el mensaje entero.
 * Los saltos de línea se quitan porque son inyección de cabeceras.
 */
function nombreVisible(de: string) {
	const limpio = de.replace(/[\r\n]+/g, " ").trim();
	const conNombre = limpio.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
	const texto = conNombre ? (conNombre[1].trim() || conNombre[2]) : limpio;
	return `"${texto.replace(/"/g, "'").slice(0, 120)} (vía kustto)"`;
}

export async function handler(evento: any) {
	if (!BUCKET || !REMITENTE || !DESTINO) {
		throw new Error(
			"Falta KUSTTO_BUCKET_CORREO, KUSTTO_REMITENTE o KUSTTO_DESTINO",
		);
	}

	const registros = evento?.Records ?? [];

	for (const registro of registros) {
		const correo = registro?.ses?.mail;
		const id = correo?.messageId;
		if (!id) continue;

		try {
			const objeto = await s3.send(
				new GetObjectCommand({ Bucket: BUCKET, Key: `${PREFIJO}${id}` }),
			);
			const crudo = await objeto.Body!.transformToString("utf8");

			const { cabeceras, cuerpo } = partir(crudo);
			const de = valorDe(cabeceras, "from");
			const para = valorDe(cabeceras, "to");

			const conservadas = cabeceras
				.filter((c) => !FUERA.has(c.nombre))
				.map((c) => c.linea);

			const nuevas = [
				`From: ${nombreVisible(de)} <${REMITENTE}>`,
				`Reply-To: ${de.replace(/[\r\n]+/g, " ")}`,
				`To: ${DESTINO}`,
				// A qué dirección del dominio escribieron. Con el dominio entero
				// aceptado, esto es lo único que distingue hola@ de ventas@.
				`X-Kustto-Para: ${para.replace(/[\r\n]+/g, " ")}`,
			];

			const mensaje = `${[...nuevas, ...conservadas].join("\r\n")}\r\n\r\n${cuerpo}`;

			await ses.send(
				new SendEmailCommand({
					FromEmailAddress: REMITENTE,
					Destination: { ToAddresses: [DESTINO] },
					Content: { Raw: { Data: Buffer.from(mensaje, "utf8") } },
				}),
			);

			console.log(`Reenviado ${id}: de "${de}" para "${para}"`);
		} catch (error) {
			// No se relanza a propósito. SES no reintenta esta invocación, y
			// tirar la función no devuelve el correo: ya está guardado en S3,
			// que es la copia que importa. Se grita y se sigue con el resto.
			console.error(`No pude reenviar ${id}:`, error);
		}
	}

	return { disposition: "CONTINUE" };
}
