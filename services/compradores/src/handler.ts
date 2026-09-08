import {
	crearRouter,
	json,
	noAutorizado,
	respuestaDeError,
} from "./lib/http.js";
import * as carrito from "./rutas/carrito.js";
import * as disenos from "./rutas/disenos.js";
import * as imagenes from "./rutas/imagenes.js";
import * as favoritos from "./rutas/favoritos.js";
import * as eventos from "./rutas/eventos.js";
import type { Identidad } from "./rutas/pedidos.js";
import * as pedidos from "./rutas/pedidos.js";
import * as perfil from "./rutas/perfil.js";
import * as plantillas from "./rutas/plantillas.js";

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

/* ─── Eventos ───────────────────────────────────────────────────────────── */
router.get("/cuenta/eventos", (p) => eventos.listar(quien(p)));
router.get("/cuenta/eventos/:id", (p) =>
	eventos.obtener(quien(p), p.params.id),
);
router.post("/cuenta/eventos", (p) => eventos.crear(quien(p), p.cuerpo));
router.post("/cuenta/eventos/subidas", (p) =>
	eventos.firmarFoto(quien(p), p.cuerpo),
);
router.patch("/cuenta/eventos/:id", (p) =>
	eventos.actualizar(quien(p), p.params.id, p.cuerpo),
);
router.post("/cuenta/eventos/:id/publicar", (p) =>
	eventos.publicar(quien(p), p.params.id),
);
router.post("/cuenta/eventos/:id/cerrar", (p) =>
	eventos.cerrar(quien(p), p.params.id),
);
router.patch("/cuenta/eventos/:id/productos/:itemId", (p) =>
	eventos.configurarProducto(quien(p), p.params.id, p.params.itemId, p.cuerpo),
);
router.delete("/cuenta/eventos/:id", (p) =>
	eventos.borrar(quien(p), p.params.id),
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

/* ─── Repetir ───────────────────────────────────────────────────────────
   Devuelve la comparación con el catálogo de hoy; NO crea el pedido. El
   pedido se sigue creando por el camino público de siempre, para que no
   existan dos sitios donde se decide un precio. */
router.get("/cuenta/pedidos/:id/repetir", (p) =>
	pedidos.repetir(quien(p), p.params.id),
);

/* Y el POST deja las líneas elegidas en el carrito, copiando su arte de
   servidor a servidor. Tampoco crea el pedido: devuelve artículos. */
router.post("/cuenta/pedidos/:id/repetir", (p) =>
	pedidos.alCarrito(quien(p), p.params.id, p.cuerpo),
);

/* ─── Diseños guardados ─────────────────────────────────────────────────
   Un diseño se GUARDA ascendiendo una línea de pedido que ya existe, no
   desde el editor: así quien compra una vez no ve un concepto nuevo. */
/* ─── La biblioteca de imágenes ─────────────────────────────────────────
   Lo que el comprador sube en el editor, para no volver a buscar el mismo
   logo en su disco cada vez. Ver `rutas/imagenes.ts`. */
router.get("/cuenta/imagenes", (p) => imagenes.listar(quien(p)));
router.post("/cuenta/imagenes/subidas", (p) =>
	imagenes.firmarSubida(quien(p), p.cuerpo),
);
router.post("/cuenta/imagenes", (p) => imagenes.confirmar(quien(p), p.cuerpo));
router.delete("/cuenta/imagenes/:id", (p) =>
	imagenes.borrar(quien(p), p.params.id),
);

router.get("/cuenta/disenos", (p) => disenos.listar(quien(p)));
router.post("/cuenta/disenos", (p) => disenos.guardar(quien(p), p.cuerpo));
router.patch("/cuenta/disenos/:id", (p) =>
	disenos.renombrar(quien(p), p.params.id, p.cuerpo),
);
router.delete("/cuenta/disenos/:id", (p) =>
	disenos.borrar(quien(p), p.params.id),
);

/* PATCH y no PUT: la API Gateway declara GET, POST, PATCH y DELETE sobre
   `/cuenta/{proxy+}` y PUT no está entre ellos. Añadirlo obligaría a tocar
   infraestructura sin ganar nada — igual que con el carrito. */
/* Las plantillas: la receta de un pedido que se repite. Se editan enteras
   —`PATCH` con todo el contenido— porque la pantalla tiene delante los
   productos y sus cantidades y manda el resultado; un campo por llamada sería
   una petición por cada "+1". */
router.get("/cuenta/plantillas", (p) => plantillas.listar(quien(p)));
router.post("/cuenta/plantillas", (p) => plantillas.crear(quien(p), p.cuerpo));
router.patch("/cuenta/plantillas/:id", (p) =>
	plantillas.actualizar(quien(p), p.params.id, p.cuerpo),
);
router.delete("/cuenta/plantillas/:id", (p) =>
	plantillas.borrar(quien(p), p.params.id),
);
/* Convertirla en artículos de carrito. `POST` y no `GET` porque no es una
   consulta: copia archivos en S3 y anota el uso de la plantilla. */
router.post("/cuenta/plantillas/:id/carrito", (p) =>
	plantillas.alCarrito(quien(p), p.params.id),
);
/* Firma las subidas del arte de una plantilla. Detrás de sesión —a diferencia
   de la del carrito, que es pública— porque escribe en un sitio que NO caduca
   y va bajo la carpeta del propio `sub`. */
router.post("/cuenta/plantillas/subidas", (p) =>
	plantillas.firmarSubidas(quien(p), p.cuerpo),
);

router.get("/cuenta/favoritos", (p) => favoritos.obtener(quien(p)));
router.patch("/cuenta/favoritos", (p) => favoritos.guardar(quien(p), p.cuerpo));

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
