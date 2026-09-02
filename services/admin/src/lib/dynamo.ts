import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Las credenciales las resuelve el SDK solo: del rol de ejecución en Lambda,
 * del perfil de ~/.aws cuando se corre en local. Nunca hay una llave en el
 * código ni en variables de entorno.
 */
const cliente = new DynamoDBClient({});

export const dynamo = DynamoDBDocumentClient.from(cliente, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLA = process.env.KUSTTO_TABLA ?? "kustto-prod";

/* ─── El reparto del espacio de llaves ────────────────────────────────────
   Vive en un solo archivo a propósito: es la decisión más cara de deshacer
   en DynamoDB, y desperdigada por los handlers se vuelve imposible de
   cambiar. Ver infra/tabla.sh. */

export const llaves = {
  /** Las colecciones chicas comparten partición: listarlas es Query, no Scan. */
  plantilla: (id: string) => ({ pk: "TEMPLATE", sk: `TPL#${id}` }),
  plantillas: "TEMPLATE",

  categoria: (id: string) => ({ pk: "CATEGORY", sk: `CAT#${id}` }),
  categorias: "CATEGORY",

  proveedor: (id: string) => ({ pk: `PROVIDER#${id}`, sk: "META" }),
  /** Para listarlos sin Scan, cada proveedor se indexa también en gsi1. */
  proveedorEnIndice: (id: string) => ({
    gsi1pk: "PROVIDER",
    gsi1sk: `PROVIDER#${id}`,
  }),

  /** Candado de unicidad: en Dynamo no existe el UNIQUE de Postgres. */
  correoDeProveedor: (correo: string) => ({
    pk: `PROVIDER_EMAIL#${correo.toLowerCase()}`,
    sk: "LOCK",
  }),

  /* Los productos los escribe el taller (services/proveedores). El admin
     sólo los revisa, pero necesita las mismas llaves: este bloque es espejo
     del de allá y los dos tienen que moverse juntos. */

  /** El producto entero en UN ítem: en Postgres eran diez tablas. */
  producto: (id: string) => ({ pk: `PRODUCT#${id}`, sk: "META" }),

  productoDeProveedor: (proveedorId: string, id: string, creadoEn: string) => ({
    gsi1pk: `PROVIDER_PRODUCTS#${proveedorId}`,
    gsi1sk: `${creadoEn}#${id}`,
  }),

  /** La bandeja de revisión: se reescribe en cada cambio de estado. */
  productoPorEstado: (estado: string, actualizadoEn: string) => ({
    gsi2pk: `PRODUCT_ESTADO#${estado}`,
    gsi2sk: actualizadoEn,
  }),

  slugDeProducto: (slug: string) => ({ pk: `SLUG#${slug}`, sk: "LOCK" }),

  /* ─── Pedidos ─────────────────────────────────────────────────────────
     Un pedido es de UN taller: puede llevar varios productos con diseños
     distintos, pero todos suyos. Mezclar talleres obligaría a partirlo, y
     entonces "el pedido" dejaría de ser lo que el cliente cree que mandó. */

  pedido: (id: string) => ({ pk: `ORDER#${id}`, sk: "META" }),

  /** La bandeja del taller: sus pedidos, del más nuevo al más viejo. */
  pedidoDeProveedor: (proveedorId: string, id: string, creadoEn: string) => ({
    gsi1pk: `PROVIDER_ORDERS#${proveedorId}`,
    gsi1sk: `${creadoEn}#${id}`,
  }),

  pedidoPorEstado: (estado: string, actualizadoEn: string) => ({
    gsi2pk: `ORDER_ESTADO#${estado}`,
    gsi2sk: actualizadoEn,
  }),

  /**
   * Los pedidos de un correo, para que quien pida sin cuenta pueda verlos
   * todos y para poder atarlos a una cuenta el día que exista.
   */
  pedidoDeComprador: (correo: string, id: string, creadoEn: string) => ({
    gsi3pk: `BUYER#${correo.toLowerCase()}`,
    gsi3sk: `${creadoEn}#${id}`,
  }),

  /* ─── Conexiones en vivo ──────────────────────────────────────────────
     El panel del taller se entera de un pedido nuevo por WebSocket, y hay
     que saber a qué conexiones escribirle. Se guarda UN ítem por conexión,
     con el taller en gsi1:

       - al desconectar sólo llega el connectionId, y la llave primaria basta
         para borrarlo sin buscar nada;
       - al publicar hace falta ir del taller a sus conexiones, y eso es el
         Query del índice.

     Lleva `expiraEn` (TTL): si una Lambda muere sin procesar el $disconnect,
     el ítem se va solo en vez de quedarse escribiéndole a un fantasma. */

  conexion: (connectionId: string) => ({
    pk: `CONN#${connectionId}`,
    sk: "META",
  }),

  conexionesDeProveedor: (proveedorId: string, connectionId: string) => ({
    gsi1pk: `PROVIDER_CONNS#${proveedorId}`,
    gsi1sk: connectionId,
  }),

  /** El folio corto que ve la gente (#2418). Único, con su candado. */
  folioDePedido: (folio: string) => ({ pk: `ORDER_FOLIO#${folio}`, sk: "LOCK" }),
};

/**
 * Por dónde pasa un pedido.
 *
 * Son los estados que el panel del taller ya sabía pintar. `pagado` no está
 * todavía: cuando entre la pasarela será uno más entre `nuevo` y
 * `produccion`, no un rediseño de esto.
 */
export const ESTADOS_PEDIDO = [
  "nuevo",
  "produccion",
  "listo",
  "entregado",
  "cancelado",
] as const;

export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

/**
 * Los estados por los que pasa un producto.
 *
 * El taller mueve entre `borrador`, `en_revision` y `archivado`; sólo el
 * admin pone `activo` o `rechazado`. Que el catálogo público filtre por
 * `activo` es lo que hace que la aprobación signifique algo.
 */
export const ESTADOS = [
  "borrador",
  "en_revision",
  "activo",
  "rechazado",
  "archivado",
] as const;

export type Estado = (typeof ESTADOS)[number];

/** Las llaves son de la tabla, no del recurso: no salen a la API. */
export function sinLlaves<T extends Record<string, unknown>>(item: T) {
  const { pk, sk, gsi1pk, gsi1sk, gsi2pk, gsi2sk, gsi3pk, gsi3sk, ...resto } =
    item;
  return resto;
}

export function esConflicto(error: unknown) {
  const nombre = (error as { name?: string } | null)?.name;
  return (
    nombre === "ConditionalCheckFailedException" ||
    nombre === "TransactionCanceledException"
  );
}
