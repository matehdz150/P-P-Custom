import {
	crearRouter,
	json,
	noAutorizado,
	respuestaDeError,
} from "./lib/http.js";
import * as catalogo from "./rutas/catalogo.js";
import * as categorias from "./rutas/categorias.js";
import * as envios from "./rutas/envios.js";
import * as pedidos from "./rutas/pedidos.js";
import * as plantillas from "./rutas/plantillas.js";
import * as productos from "./rutas/productos.js";
import * as proveedores from "./rutas/proveedores.js";
import * as rastreo from "./rutas/rastreo.js";
import * as subidas from "./rutas/subidas.js";

const router = crearRouter();

router.get("/templates", () => plantillas.listar());
router.get("/templates/:id", (p) => plantillas.obtener(p.params.id));
router.post("/templates", (p) => plantillas.crear(p.cuerpo));
router.patch("/templates/:id", (p) =>
	plantillas.actualizar(p.params.id, p.cuerpo),
);
router.delete("/templates/:id", (p) => plantillas.borrar(p.params.id));

router.get("/categories", () => categorias.listar());
router.post("/categories", (p) => categorias.crear(p.cuerpo));
router.patch("/categories/:id", (p) =>
	categorias.actualizar(p.params.id, p.cuerpo),
);
router.delete("/categories/:id", (p) => categorias.borrar(p.params.id));

router.get("/providers", () => proveedores.listar());
router.post("/providers", (p) => proveedores.crear(p.cuerpo));

/* Los productos los escribe el taller; el admin los revisa. Por defecto la
   lista trae los que esperan revisión, que es la cola de trabajo. */
router.get("/productos", (p) => productos.listar(p.query));
router.get("/productos/:id", (p) => productos.obtener(p.params.id));
router.patch("/productos/:id/revision", (p) =>
	productos.revisar(p.params.id, p.cuerpo),
);

router.post("/uploads/mockup-url", (p) => subidas.urlParaMockup(p.cuerpo));
router.post("/uploads/imagen-url", (p) => subidas.urlParaImagen(p.cuerpo));

/* ─── El catálogo público ───────────────────────────────────────────────
   Sin llave: lo pide el navegador de cualquiera que abra la tienda. Cuelga
   de /publico/ porque es el prefijo que ya está abierto, y así no hay dos
   reglas distintas que recordar. Sólo salen productos aprobados. */
router.get("/publico/catalogo", () => catalogo.listar());
router.get("/publico/catalogo/:id", (p) => catalogo.obtener(p.params.id));
router.get("/publico/categorias", () => categorias.listar());

/* Cotizar es público porque pasa ANTES de pagar y antes de que exista un
   pedido. No acepta pesos ni medidas del cuerpo: sólo qué se pide y a dónde,
   y el paquete lo arma el servidor con los datos del producto. */
router.post("/publico/envios/cotizar", (p) => envios.crear(p.cuerpo));
router.get("/publico/envios/cotizacion/:id", (p) =>
	envios.consultar(p.params.id),
);

/* Pedir no exige cuenta: la cuenta es opcional a propósito. El seguimiento
   se abre con el token que se le manda al comprador por correo, no con una
   sesión. */
/* El rastreo que manda Skydropx. Abierta porque la llama un tercero, pero NO
   sin autenticar: verifica la firma HMAC del cuerpo y rechaza si falta el
   secreto. Ver services/admin/src/rutas/rastreo.ts. */
router.post("/publico/envios/rastreo", (p) =>
	rastreo.recibir(p.cuerpo, p.cuerpoCrudo, p.headers),
);

router.post("/publico/pedidos", (p) => pedidos.crear(p.cuerpo));
router.get("/publico/pedidos/:id", (p) =>
	pedidos.seguimiento(p.params.id, p.query.token),
);

/**
 * Rutas que NO piden la llave de admin.
 *
 * Leer un mockup es público por definición —lo pide el navegador de
 * cualquiera que abra el editor— y en producción ni siquiera pasa por aquí,
 * lo sirve CloudFront.
 */
const ABIERTAS = [
	/^GET \/publico\//,
	// Las escrituras sin llave del sistema. Van enumeradas una por una y no
	// como `POST /publico/` a secas: abrir el prefijo entero significaría que
	// cualquier ruta que alguien cuelgue ahí mañana nace abierta sin que nadie
	// lo decida.
	/^POST \/publico\/pedidos$/,
	// El webhook de Skydropx. Abierta al mundo pero cerrada de verdad: exige
	// la firma HMAC del cuerpo y rechaza si no hay secreto configurado.
	/^POST \/publico\/envios\/rastreo$/,
	// Cotizar no escribe nada nuestro, pero sí gasta cuota en Skydropx, que
	// admite 2 peticiones por segundo. Por eso no acepta direcciones ni pesos
	// libres: hay que traer ids de productos publicados, y eso ya acota
	// bastante quién puede pedirlas en serie.
	/^POST \/publico\/envios\/cotizar$/,
];

export async function handler(evento: any) {
	const metodo: string =
		evento?.requestContext?.http?.method ?? evento?.httpMethod ?? "GET";
	const ruta: string =
		evento?.requestContext?.http?.path ??
		evento?.rawPath ??
		evento?.path ??
		"/";

	// El preflight se contesta antes de mirar credenciales.
	if (metodo === "OPTIONS") return json(204, null);

	try {
		const headers: Record<string, string | undefined> = Object.fromEntries(
			Object.entries(evento?.headers ?? {}).map(([k, v]) => [
				k.toLowerCase(),
				v as string,
			]),
		);

		// El camino de desarrollo para leer archivos del bucket; sale antes del
		// router porque devuelve bytes, no JSON.
		//
		// Se comprueban los DOS prefijos de archivos y no `/publico/` entero:
		// bajo ese prefijo también cuelga el catálogo, que sí es JSON y sí tiene
		// que llegar al router. Con el `startsWith` de antes, `/publico/catalogo`
		// se habría ido a buscar un objeto a S3 y contestado 500.
		if (
			metodo === "GET" &&
			(ruta.startsWith("/publico/mockups/") ||
				ruta.startsWith("/publico/medios/"))
		) {
			return await subidas.leerPublico(ruta.slice("/publico/".length));
		}

		if (!ABIERTAS.some((r) => r.test(`${metodo} ${ruta}`))) {
			exigirLlave(headers["x-clave-admin"]);
		}

		const cuerpoCrudo = evento?.isBase64Encoded
			? Buffer.from(evento.body ?? "", "base64").toString("utf8")
			: evento?.body;

		return await router.resolver({
			metodo,
			ruta,
			query: evento?.queryStringParameters ?? {},
			cuerpo: cuerpoCrudo ? JSON.parse(cuerpoCrudo) : undefined,
			cuerpoCrudo,
			headers,
		});
	} catch (error) {
		return respuestaDeError(error);
	}
}

/**
 * Comparación en tiempo constante para que la llave no se pueda adivinar
 * midiendo cuánto tarda en fallar.
 */
function exigirLlave(recibida: string | undefined) {
	const esperada = process.env.KUSTTO_CLAVE_ADMIN;

	// Sin llave configurada la Lambda no atiende: mejor caída que abierta.
	if (!esperada) throw noAutorizado("El admin no tiene llave configurada");
	if (!recibida) throw noAutorizado();

	const a = Buffer.from(recibida);
	const b = Buffer.from(esperada);
	if (a.length !== b.length) throw noAutorizado();

	let diferencia = 0;
	for (let i = 0; i < a.length; i++) diferencia |= a[i] ^ b[i];
	if (diferencia !== 0) throw noAutorizado();
}
