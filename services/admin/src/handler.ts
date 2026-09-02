import * as categorias from "./rutas/categorias.js";
import * as plantillas from "./rutas/plantillas.js";
import * as proveedores from "./rutas/proveedores.js";
import * as subidas from "./rutas/subidas.js";
import { crearRouter, json, noAutorizado, respuestaDeError } from "./lib/http.js";

const router = crearRouter();

router.get("/templates", () => plantillas.listar());
router.get("/templates/:id", (p) => plantillas.obtener(p.params.id));
router.post("/templates", (p) => plantillas.crear(p.cuerpo));
router.patch("/templates/:id", (p) => plantillas.actualizar(p.params.id, p.cuerpo));
router.delete("/templates/:id", (p) => plantillas.borrar(p.params.id));

router.get("/categories", () => categorias.listar());
router.post("/categories", (p) => categorias.crear(p.cuerpo));
router.patch("/categories/:id", (p) => categorias.actualizar(p.params.id, p.cuerpo));
router.delete("/categories/:id", (p) => categorias.borrar(p.params.id));

router.get("/providers", () => proveedores.listar());
router.post("/providers", (p) => proveedores.crear(p.cuerpo));

router.post("/uploads/mockup-url", (p) => subidas.urlParaMockup(p.cuerpo));
router.post("/uploads/imagen-url", (p) => subidas.urlParaImagen(p.cuerpo));

/**
 * Rutas que NO piden la llave de admin.
 *
 * Leer un mockup es público por definición —lo pide el navegador de
 * cualquiera que abra el editor— y en producción ni siquiera pasa por aquí,
 * lo sirve CloudFront.
 */
const ABIERTAS = [/^GET \/publico\//];

export async function handler(evento: any) {
  const metodo: string =
    evento?.requestContext?.http?.method ?? evento?.httpMethod ?? "GET";
  const ruta: string =
    evento?.requestContext?.http?.path ?? evento?.rawPath ?? evento?.path ?? "/";

  // El preflight se contesta antes de mirar credenciales.
  if (metodo === "OPTIONS") return json(204, null);

  try {
    const headers: Record<string, string | undefined> = Object.fromEntries(
      Object.entries(evento?.headers ?? {}).map(([k, v]) => [
        k.toLowerCase(),
        v as string,
      ]),
    );

    // El camino de desarrollo para leer mockups; sale antes del router
    // porque devuelve bytes, no JSON.
    if (metodo === "GET" && ruta.startsWith("/publico/")) {
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
