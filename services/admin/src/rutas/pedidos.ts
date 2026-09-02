import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

import {
  dynamo,
  esConflicto,
  llaves,
  sinLlaves,
  TABLA,
  type EstadoPedido,
} from "../lib/dynamo.js";
import { conflicto, malaPeticion, noAutorizado, noEncontrado } from "../lib/http.js";

/**
 * Los pedidos.
 *
 * Esta es la ÚNICA ruta pública que escribe. Quien pide no tiene sesión —la
 * cuenta es opcional a propósito— así que todo lo que llega es sospechoso y
 * nada de lo que decide el precio o el destinatario sale del cuerpo: el
 * producto se lee de la tabla y de ahí salen el taller y el importe.
 */

const s3 = new S3Client({});
const BUCKET_PUBLICO =
  process.env.KUSTTO_BUCKET_PUBLICO ?? "kustto-publico-prod";

/** Lo que se firma para el arte. Sólo PNG: es lo que exporta el editor. */
const VIGENCIA_SUBIDA = 900;
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Cuerpo = Record<string, any>;

export async function crear(cuerpo: unknown) {
  const c = (cuerpo ?? {}) as Cuerpo;

  const comprador = {
    nombre: String(c.comprador?.nombre ?? "").trim(),
    email: String(c.comprador?.email ?? "").trim().toLowerCase(),
    whatsapp: String(c.comprador?.whatsapp ?? "").trim() || null,
    notas: String(c.comprador?.notas ?? "").trim() || null,
  };

  if (!comprador.nombre) throw malaPeticion("Falta tu nombre");
  if (!CORREO.test(comprador.email)) {
    throw malaPeticion("Hace falta un correo válido: ahí llega el seguimiento");
  }

  const lineas = Array.isArray(c.lineas) ? c.lineas : [];
  if (lineas.length === 0) throw malaPeticion("El pedido va vacío");

  // El producto manda sobre el precio y sobre a quién le toca producirlo. Si
  // esto saliera del cuerpo, cualquiera podría pedir a un peso.
  const productos = await Promise.all(
    lineas.map((l: Cuerpo) => leerProductoPublicado(String(l.productoId ?? ""))),
  );

  const talleres = new Set(productos.map((p) => String(p.proveedorId)));
  if (talleres.size > 1) {
    throw malaPeticion(
      "Un pedido es de un solo taller. Sepáralo en uno por taller.",
    );
  }

  const proveedorId = [...talleres][0];
  const ahora = new Date().toISOString();
  const id = randomUUID();

  const detalladas = lineas.map((l: Cuerpo, i: number) =>
    aLinea(l, productos[i], id),
  );

  const total = detalladas.reduce((suma, l) => suma + l.importe, 0);

  /* El token de seguimiento NO se guarda: se guarda su huella. Si alguien
     llega a leer la tabla, no se lleva los enlaces de seguimiento de nadie.
     Es la misma razón por la que la llave del admin se compara con hash. */
  const token = randomBytes(24).toString("base64url");

  const pedido = {
    ...llaves.pedido(id),
    ...llaves.pedidoDeProveedor(proveedorId, id, ahora),
    ...llaves.pedidoPorEstado("nuevo", ahora),
    ...llaves.pedidoDeComprador(comprador.email, id, ahora),
    id,
    comprador,
    /** Se llena el día que haya cuentas; hoy el pedido vive por su correo. */
    compradorId: null,
    proveedorId,
    lineas: detalladas,
    total,
    piezas: detalladas.reduce((n, l) => n + l.piezas, 0),
    estado: "nuevo" as EstadoPedido,
    bitacora: [{ estado: "nuevo", en: ahora, por: "cliente", nota: null }],
    tokenHuella: huella(token),
    createdAt: ahora,
    updatedAt: ahora,
  };

  const folio = await escribirConFolio(pedido, id);

  return {
    id,
    folio,
    token,
    total,
    // El arte va directo del navegador a S3, como los mockups: firmar aquí
    // ata el permiso a este pedido en vez de dejar un firmador abierto.
    subidas: await firmarArte(id, detalladas),
  };
}

/**
 * El pedido, para quien trae el enlace de seguimiento.
 *
 * El token se compara en tiempo constante: una comparación normal filtra por
 * cuánto tarda en fallar, y aquí eso permitiría adivinarlo carácter a
 * carácter.
 */
export async function seguimiento(id: string, token: string | undefined) {
  const { Item } = await dynamo.send(
    new GetCommand({ TableName: TABLA, Key: llaves.pedido(id) }),
  );

  if (!Item) throw noEncontrado("No encontramos ese pedido");
  if (!token) throw noAutorizado("Falta el enlace de seguimiento");

  const esperada = Buffer.from(String(Item.tokenHuella ?? ""));
  const recibida = Buffer.from(huella(token));

  if (
    esperada.length !== recibida.length ||
    !timingSafeEqual(esperada, recibida)
  ) {
    throw noAutorizado("Ese enlace de seguimiento no es válido");
  }

  return sinSecretos(Item);
}

/* ─── Lo que sostiene todo lo de arriba ─────────────────────────────────── */

async function leerProductoPublicado(productoId: string) {
  if (!productoId) throw malaPeticion("Una línea del pedido no dice qué producto es");

  const { Item } = await dynamo.send(
    new GetCommand({ TableName: TABLA, Key: llaves.producto(productoId) }),
  );

  // Sólo se puede pedir lo que está publicado: un borrador o algo que volvió
  // a revisión no existe para el público, y menos para cobrarlo.
  if (!Item || Item.estado !== "activo") {
    throw malaPeticion("Uno de los productos ya no está disponible");
  }

  return Item;
}

function aLinea(l: Cuerpo, producto: Cuerpo, pedidoId: string) {
  const tallas = (Array.isArray(l.tallas) ? l.tallas : [])
    .map((t: Cuerpo) => ({
      size: String(t.size ?? "").trim(),
      piezas: Math.trunc(Number(t.piezas ?? 0)),
    }))
    .filter((t: { size: string; piezas: number }) => t.size && t.piezas > 0);

  if (tallas.length === 0) {
    throw malaPeticion(`Dinos cuántas piezas quieres de ${producto.name}`);
  }

  const piezas = tallas.reduce(
    (n: number, t: { piezas: number }) => n + t.piezas,
    0,
  );

  const lados = (Array.isArray(l.lados) ? l.lados : [])
    .map((s: unknown) => String(s))
    .filter(Boolean);

  const precios = (producto.pricing ?? {}) as Record<string, number | undefined>;
  const base = Number(precios.basePrice ?? 0);

  // El primer lado va en el precio base; cada lado extra se cobra aparte si
  // el taller lo puso. Es la regla que ya describía su propio formulario.
  const extraPorLados =
    lados.length > 1 ? (lados.length - 1) * Number(precios.perSidePrice ?? 0) : 0;

  const lineaId = randomUUID();

  return {
    id: lineaId,
    productoId: String(producto.id),
    producto: String(producto.name),
    imagen: (producto.images as { url: string }[] | undefined)?.[0]?.url ?? null,
    templateId: String(producto.templateId ?? ""),
    colorPrenda: String(l.colorPrenda ?? "").trim() || null,
    lados,
    tallas,
    piezas,
    importe: (base + extraPorLados) * piezas,
    /** El diseño editable, para poder reabrirlo o corregirlo. */
    diseno: l.diseno ?? null,
    /**
     * Dónde quedará el archivo listo para máquina de cada lado. Se apunta
     * antes de que exista: el navegador lo sube enseguida con la URL firmada,
     * y así el taller siempre sabe dónde mirar.
     */
    arte: lados.map((lado: string) => ({
      lado,
      ruta: `/medios/pedidos/${pedidoId}/${lineaId}-${lado}.png`,
    })),
  };
}

type Linea = ReturnType<typeof aLinea>;

async function firmarArte(pedidoId: string, lineas: Linea[]) {
  const piezas = lineas.flatMap((l) =>
    l.arte.map((a) => ({ lineaId: l.id, lado: a.lado, ruta: a.ruta })),
  );

  return Promise.all(
    piezas.map(async (p) => ({
      ...p,
      uploadUrl: await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: BUCKET_PUBLICO,
          Key: p.ruta.slice(1),
          ContentType: "image/png",
        }),
        { expiresIn: VIGENCIA_SUBIDA },
      ),
    })),
  );
}

/**
 * Escribe el pedido con su folio corto, único, en una sola transacción.
 *
 * El folio es lo que la gente dice por teléfono ("mi pedido 2418"), así que
 * son cuatro dígitos y no un uuid. Al ser corto choca de vez en cuando: se
 * reintenta con otro en vez de fallar, y sólo se rinde tras varios intentos.
 */
async function escribirConFolio(pedido: Record<string, unknown>, id: string) {
  for (let intento = 0; intento < 6; intento++) {
    const folio = String(1000 + Math.floor(Math.random() * 9000));

    try {
      await dynamo.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLA,
                Item: { ...pedido, folio },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: TABLA,
                Item: { ...llaves.folioDePedido(folio), pedidoId: id },
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
          ],
        }),
      );

      return folio;
    } catch (error) {
      if (!esConflicto(error)) throw error;
    }
  }

  throw conflicto("No pudimos asignarle un folio al pedido. Inténtalo otra vez.");
}

function huella(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** La huella del token nunca sale de la Lambda. */
export function sinSecretos(item: Record<string, unknown>) {
  const { tokenHuella, ...resto } = sinLlaves(item);
  return resto;
}
