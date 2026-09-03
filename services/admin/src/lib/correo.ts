/**
 * DUPLICADO A PROPÓSITO en `services/admin` y `services/proveedores`.
 *
 * Cada servicio es su propio bundle y tiene su `lib/`, como ya pasa con
 * `skydropx.ts`. El correo de "va en camino" se dispara desde los DOS: el
 * taller puede marcarlo a mano (proveedores) y la paquetería puede marcarlo
 * por webhook (admin).
 *
 * COPIA EL ARCHIVO ENTERO al cambiarlo. Si las plantillas divergen, el mismo
 * cliente recibe un texto u otro según quién movió el pedido, y eso no se ve
 * en ninguna prueba.
 *
 * Si algún día hace falta un TERCER disparador, esto deja de compensar: la
 * salida buena es una Lambda sobre el stream de DynamoDB que mire las
 * transiciones y mande desde un solo sitio. Los streams ya están activados.
 */

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";

/**
 * Mandar correo.
 *
 * SE ENVÍA DESDE OTRA CUENTA, asumiendo un rol. No es un rodeo: el SES de ESTA
 * cuenta está en **sandbox** —200 al día y sólo a direcciones verificadas a
 * mano— y el de la cuenta root tiene acceso a producción.
 *
 * NO BASTA CON AUTORIZAR LA IDENTIDAD. Se probó: SES permite que una cuenta
 * envíe usando la identidad verificada de otra (`FromEmailAddressIdentityArn`),
 * pero **la cuota y el sandbox son los de quien LLAMA**, no los del dueño de la
 * identidad. Con eso, el envío se contaba en esta cuenta y seguía rechazando
 * cualquier destinatario sin verificar. Lo que sí funciona es asumir un rol en
 * la cuenta root: así quien llama a SES es ella.
 *
 * Lo monta `infra/correo-envio.sh`, que necesita los dos lados: el rol allá con
 * su relación de confianza, y el permiso para asumirlo acá.
 *
 * NUNCA LANZA. Un correo se manda DESPUÉS de que el pedido ya está escrito y
 * el cliente ya vio su confirmación en pantalla. Si el envío falla, el pedido
 * sigue siendo válido; tumbarlo por un correo sería cambiar algo que importa
 * por algo que no. Al log entero, y a seguir.
 */

const ROL = process.env.KUSTTO_CORREO_ROL ?? "";

/**
 * El cliente, apuntando a la cuenta que sí puede enviar.
 *
 * `fromTemporaryCredentials` asume el rol y renueva las credenciales solo
 * cuando caducan, así que un contenedor caliente no vuelve a pedirlas en cada
 * correo. Se crea una vez por contenedor, como el resto de clientes.
 */
const ses = ROL
	? new SESv2Client({
			credentials: fromTemporaryCredentials({
				params: { RoleArn: ROL, RoleSessionName: "kustto-correo" },
			}),
		})
	: null;
const DE = process.env.KUSTTO_CORREO_DE ?? "hola@kustto.com.mx";
const NOMBRE = "Kustto";

/** Dónde vive el sitio, para armar los enlaces de los correos. */
export const SITIO = (
	process.env.KUSTTO_SITIO ??
	process.env.KUSTTO_ORIGEN ??
	"https://kustto.com.mx"
).replace(/\/$/, "");

export type Correo = {
	para: string;
	asunto: string;
	/** El cuerpo en texto. Se manda SIEMPRE, también con html. */
	texto: string;
	html?: string;
	/** A dónde contesta quien reciba. Por defecto, a nosotros. */
	responderA?: string;
};

export async function enviar(correo: Correo): Promise<boolean> {
	if (!ses) {
		console.error("Sin KUSTTO_CORREO_ROL: no se manda correo");
		return false;
	}

	if (!correo.para) return false;

	try {
		await ses.send(
			new SendEmailCommand({
				FromEmailAddress: `${NOMBRE} <${DE}>`,
				Destination: { ToAddresses: [correo.para] },
				ReplyToAddresses: [correo.responderA ?? DE],
				Content: {
					Simple: {
						Subject: { Data: correo.asunto, Charset: "UTF-8" },
						Body: {
							// El texto va siempre. Un correo sólo-HTML puntúa peor en
							// los filtros de spam, y hay clientes que no lo pintan.
							Text: { Data: correo.texto, Charset: "UTF-8" },
							...(correo.html
								? { Html: { Data: correo.html, Charset: "UTF-8" } }
								: {}),
						},
					},
				},
			}),
		);

		return true;
	} catch (error) {
		console.error(
			`No pudimos mandar "${correo.asunto}" a ${correo.para}:`,
			error,
		);
		return false;
	}
}

/**
 * Escapa lo que va dentro del HTML.
 *
 * Todo lo que entra en estos correos lo escribió alguien: su nombre, el nombre
 * de su producto, una nota. Sin escapar, un `<` en el nombre de un taller
 * rompe la maqueta, y algo peor si alguien se lo propone.
 */
export function esc(v: unknown): string {
	return String(v ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** Pesos, como se leen. */
export function pesos(n: number): string {
	return new Intl.NumberFormat("es-MX", {
		style: "currency",
		currency: "MXN",
	}).format(n);
}
