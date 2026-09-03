import {
	crearRouter,
	json,
	noAutorizado,
	respuestaDeError,
} from "./lib/http.js";
import type { Identidad } from "./rutas/pedidos.js";
import * as carrito from "./rutas/carrito.js";
import * as pedidos from "./rutas/pedidos.js";
import * as perfil from "./rutas/perfil.js";

/**
 * La API de la cuenta del comprador.
 *
 * Aquí NO se verifica ningún token: lo hace el autorizador JWT de API Gateway
 * antes de invocar la función, contra el pool de COMPRADORES. Ese pool es otro
 * que el de talleres, así que un token de taller no abre esta puerta ni al
 * revés — y eso no depende de que nadie se acuerde de comprobarlo.
 *
 * Lo que sí se lee de las claims son tres cosas, y las tres importan:
 *   `sub`            es el id de la cuenta (perfil, direcciones)
 *   `email`          es lo que ata los pedidos, incluidos los de antes de tener cuenta
 *   `email_verified` es lo único que impide leer los pedidos de otro
 */

function quienEs(evento: any): Identidad {
	const claims =
		evento?.requestContext?.authorizer?.jwt?.claims ??
		evento?.requestContext?.authorizer?.claims;

	if (!claims?.sub) {
		// No debería pasar nunca: significaría que la ruta quedó sin autorizador.
		throw noAutorizado("El token no trae identidad");
	}

	// Cognito manda los booleanos de las claims como cadena según de dónde
	// venga el usuario: `true` desde Google, `"true"` desde un alta con correo.
	// Compararlo sólo contra el booleano deja fuera a media base sin decir nada.
	const verificado = claims.email_verified;

	return {
		sub: String(claims.sub),
		email: String(claims.email ?? ""),
		correoVerificado: verificado === true || verificado === "true",
	};
}

const router = crearRouter();

/* ─── Pedidos ───────────────────────────────────────────────────────────── */

router.get("/cuenta/pedidos", (p) => pedidos.listar(quien(p)));
router.get("/cuenta/pedidos/:id", (p) =>
	pedidos.obtener(quien(p), p.params.id),
);

/* ─── Perfil y direcciones ──────────────────────────────────────────────── */

/* El carrito de quien tiene sesión. Sin ella vive en el navegador y no pasa
   por aquí: son las dos mitades de lo mismo, y al entrar se funden. */
router.get("/cuenta/carrito", (p) => carrito.obtener(quien(p)));
/* PATCH y no PUT aunque se guarde entero: la API Gateway declara una ruta por
   método y PUT no está entre ellos. Añadirlo obligaría a tocar la
   infraestructura y el CORS para no ganar nada. */
router.patch("/cuenta/carrito", (p) => carrito.guardar(quien(p), p.cuerpo));
router.delete("/cuenta/carrito", (p) => carrito.vaciar(quien(p)));

router.get("/cuenta/perfil", (p) => perfil.obtener(quien(p)));
router.patch("/cuenta/perfil", (p) => perfil.guardar(quien(p), p.cuerpo));

/**
 * La identidad viaja en el objeto de la petición para que los handlers no
 * tengan que conocer la forma del evento de API Gateway.
 */
function quien(p: { headers: Record<string, string | undefined> }): Identidad {
	return {
		sub: p.headers["x-sub"]!,
		email: p.headers["x-email"] ?? "",
		correoVerificado: p.headers["x-email-verificado"] === "1",
	};
}

export async function handler(evento: any) {
	const metodo: string = evento?.requestContext?.http?.method ?? "GET";
	const ruta: string = evento?.requestContext?.http?.path ?? "/";

	if (metodo === "OPTIONS") return json(204, null);

	try {
		const identidad = quienEs(evento);

		const headers: Record<string, string | undefined> = Object.fromEntries(
			Object.entries(evento?.headers ?? {}).map(([k, v]) => [
				k.toLowerCase(),
				v as string,
			]),
		);

		headers["x-sub"] = identidad.sub;
		headers["x-email"] = identidad.email;
		headers["x-email-verificado"] = identidad.correoVerificado ? "1" : "0";

		const cuerpoCrudo = evento?.isBase64Encoded
			? Buffer.from(evento.body ?? "", "base64").toString("utf8")
			: evento?.body;

		return await router.resolver({
			metodo,
			ruta,
			query: evento?.queryStringParameters ?? {},
			cuerpo: cuerpoCrudo ? JSON.parse(cuerpoCrudo) : undefined,
			headers,
		});
	} catch (error) {
		return respuestaDeError(error);
	}
}
