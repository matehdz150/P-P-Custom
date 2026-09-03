import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	QueryCommand,
	type QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";

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

/**
 * Un `Query` completo, siguiendo las páginas.
 *
 * POR QUÉ EXISTE. DynamoDB corta toda respuesta de `Query` en **1 MB** y
 * devuelve `LastEvaluatedKey` para pedir el resto. Quien no lo lee recibe una
 * respuesta a medias SIN error de por medio: no hay excepción, no hay aviso,
 * simplemente faltan filas. Aquí se traducía en un catálogo al que le
 * empezaban a faltar productos y una bandeja a la que le faltaban pedidos, y
 * nadie se habría enterado hasta que un taller preguntara por uno.
 *
 * EL TOPE ES A PROPÓSITO Y AVISA. Traer sin límite acabaría reventando el
 * tope de 6 MB de respuesta de Lambda, que falla feo y tarde. Con `maximo` se
 * corta antes y se deja dicho en el log: sigue siendo una respuesta
 * incompleta, pero ahora es una que se puede encontrar.
 *
 * NO ES LA SOLUCIÓN DEFINITIVA para el catálogo público. Eso es la vista
 * materializada en S3 (ver infra/README.md); esto es lo que evita perder
 * datos en silencio mientras tanto.
 */
export async function consultarTodo(
	entrada: QueryCommandInput,
	maximo = 2000,
): Promise<Record<string, unknown>[]> {
	const items: Record<string, unknown>[] = [];
	let desde: Record<string, unknown> | undefined;

	do {
		const pagina = await dynamo.send(
			new QueryCommand({ ...entrada, ExclusiveStartKey: desde }),
		);

		items.push(...(pagina.Items ?? []));
		desde = pagina.LastEvaluatedKey;
	} while (desde && items.length < maximo);

	if (desde) {
		console.warn(
			`Consulta cortada en ${items.length} ítems (tope ${maximo}): ` +
				`${entrada.IndexName ?? "tabla"} ${JSON.stringify(entrada.ExpressionAttributeValues)}`,
		);
	}

	return items;
}

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

	/**
	 * El producto entero en UN ítem.
	 *
	 * En Postgres eran diez tablas (colores, tallas, imágenes, precios, lados,
	 * producción, reglas…) y cada ficha costaba otros tantos joins. Aquí la
	 * ficha se lee de una sola vez, que es como se usa siempre: nadie pide los
	 * colores de un producto sin pedir el producto.
	 */
	producto: (id: string) => ({ pk: `PRODUCT#${id}`, sk: "META" }),

	/**
	 * "Mis productos" del taller. La fecha va en la llave de orden para que
	 * lleguen del más nuevo al más viejo sin ordenar en memoria.
	 */
	productoDeProveedor: (proveedorId: string, id: string, creadoEn: string) => ({
		gsi1pk: `PROVIDER_PRODUCTS#${proveedorId}`,
		gsi1sk: `${creadoEn}#${id}`,
	}),

	/**
	 * La bandeja de revisión del admin: los que esperan aprobación, sin
	 * recorrer la tabla entera. Se reescribe en cada cambio de estado.
	 */
	productoPorEstado: (estado: string, actualizadoEn: string) => ({
		gsi2pk: `PRODUCT_ESTADO#${estado}`,
		gsi2sk: actualizadoEn,
	}),

	/**
	 * El slug es la URL pública del producto, así que se defiende igual que el
	 * correo del proveedor: con un ítem-candado en la misma transacción.
	 */
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

	/**
	 * Del envío de Skydropx al pedido.
	 *
	 * Hace falta para el webhook de rastreo: lo que llega es el id del envío y
	 * hay que llegar al pedido. Sin este apunte habría que recorrer la tabla
	 * entera en cada aviso de la paquetería.
	 *
	 * Se escribe al comprar la guía, junto al pedido.
	 */
	envioDeSkydropx: (envioId: string) => ({
		pk: `ENVIO#${envioId}`,
		sk: "LOCK",
	}),

	/** El folio corto que ve la gente (#2418). Único, con su candado. */
	folioDePedido: (folio: string) => ({
		pk: `ORDER_FOLIO#${folio}`,
		sk: "LOCK",
	}),
};

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
/* ─── Existencias ─────────────────────────────────────────────────────────
   Espejo en services/admin y services/proveedores: los dos tienen que
   moverse juntos. Ver infra/README.md. */

/**
 * La llave de una variante dentro del mapa `existencias` del producto.
 *
 * La unidad de inventario NO es el producto: es color × talla. "Tengo
 * playeras" no sirve para producir; "tengo 12 negras M" sí.
 *
 * Hay productos sin colores capturados —hoy los hay— y para esos la variante
 * es sólo la talla. Si mañana se les añaden colores, las llaves cambian y el
 * inventario viejo queda huérfano: por eso `existencias` se recalcula cuando
 * el taller edita colores o tallas, en vez de arrastrarse.
 *
 * La barra separa porque no aparece en un nombre de color ni en una talla. Si
 * algún día apareciera, lo que se rompe es el conteo de esa variante y en
 * silencio, así que se limpia al construir la llave.
 */
export function variante(color: string | null, talla: string) {
	const limpia = (s: string) => s.trim().replace(/\|/g, "-");
	return color ? `${limpia(color)}|${limpia(talla)}` : limpia(talla);
}

/**
 * Cuánto hay de una variante. Puede ser NEGATIVO a propósito.
 *
 * Se puede comprar sin existencias —el taller avisa de más días y compra el
 * blanco—, así que el descuento no lleva condición y el número baja de cero.
 * Un -2 no es un error: es "compra 2 blancos para sacar este pedido".
 */
export function existenciasDe(
	producto: Record<string, unknown>,
	color: string | null,
	talla: string,
): number {
	const mapa = (producto.existencias ?? {}) as Record<string, number>;
	return Number(mapa[variante(color, talla)] ?? 0);
}

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
	/**
	 * Ya no está en el taller: salió con la paquetería.
	 *
	 * Existe porque `listo` se tragaba todo el envío — un paquete viajando tres
	 * días se veía igual que uno recién salido de la plancha. Sólo aplica a los
	 * pedidos con envío; los de recoger van de `listo` a `entregado`.
	 */
	"enviado",
	"entregado",
	"cancelado",
] as const;

export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];
