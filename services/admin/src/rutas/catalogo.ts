import {
	BatchGetCommand,
	GetCommand,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import {
	consultarTodo,
	dynamo,
	llaves,
	sinLlaves,
	TABLA,
} from "../lib/dynamo.js";
import { noEncontrado } from "../lib/http.js";

/**
 * El catálogo público: lo único que se lee sin llave ni token.
 *
 * POR QUÉ QUERY DIRECTO Y NO UN JSON MATERIALIZADO EN S3
 *
 *   La otra opción sobre la mesa era que un stream de DynamoDB reescribiera
 *   un JSON del catálogo en cada cambio, para servirlo desde CloudFront sin
 *   Lambda. Se descartó POR AHORA, no por siempre:
 *
 *   - El catálogo no se filtra en el servidor. Técnica, color y días se
 *     aplican en el navegador sobre la lista completa, así que no hace falta
 *     un índice por filtro; con `PRODUCT_ESTADO#activo` basta, y ese índice
 *     ya existe para la bandeja de revisión.
 *   - Son decenas de productos y visitas contadas. Un Query por visita se
 *     paga en centavos y siempre está fresco.
 *   - Materializar añade una Lambda, un stream y segundos de retraso entre
 *     aprobar un producto y verlo publicado.
 *
 *   CUÁNDO CAMBIAR: cuando la lista pase de unos cientos de productos (la
 *   respuesta empieza a pesar y el Query a paginar) o cuando el tráfico haga
 *   que la Lambda por visita se note en la factura. El modelo de datos y la
 *   escritura no cambian, y esta misma forma de respuesta se puede volcar
 *   tal cual a un JSON: el front no se entera.
 */

/**
 * La forma que espera el catálogo del front.
 *
 * Los campos que pueden faltar se omiten en vez de mandarse en `null`: el
 * front los tiene como opcionales, y `null` obligaría a tocar las pantallas
 * que ya funcionan sólo para aceptar un hueco que JSON sabe representar
 * dejando la clave fuera.
 */
type Ficha = {
	id: string;
	slug: string;
	name: string;
	description?: string;
	images: { url: string; order: number }[];
	basePrice?: number;
	categoryIds: string[];
	provider?: string;
	/**
	 * La técnica todavía no se pregunta en el alta, así que hoy siempre va
	 * vacía. El filtro del catálogo se esconde solo cuando no hay ninguna, así
	 * que no estorba hasta que el asistente la capture.
	 */
	technique?: string;
	productionDays?: number;
	colors: { name: string; hex?: string | null }[];
	sizes: { size: string; widthIn: number; lengthIn: number }[];
	/* `recargo` se declara aunque el objeto se pase entero: sin él en el tipo,
	   quien lea la ficha no sabe que puede venir, y es lo que decide cuánto
	   suma cada lado. */
	printSides: {
		sideKey: string;
		widthCm: number;
		heightCm: number;
		recargo?: number | null;
	}[];
	templateId: string;
};

export async function listar() {
	const items = await consultarTodo({
		TableName: TABLA,
		IndexName: "gsi2",
		KeyConditionExpression: "gsi2pk = :pk",
		ExpressionAttributeValues: {
			":pk": llaves.productoPorEstado("activo", "").gsi2pk,
		},
		// Lo último aprobado primero: es lo que se ve arriba del catálogo.
		ScanIndexForward: false,
	});

	const productos = items.map(sinLlaves);
	const talleres = await talleresDe(productos);

	return productos.map((p) => aFicha(p, talleres));
}

/**
 * Una ficha de producto.
 *
 * Sólo se sirve si está publicado: un borrador o algo que espera revisión no
 * existe para el público, y decir 404 evita que un id adivinado enseñe lo
 * que un taller todavía está armando.
 */
export async function obtener(id: string) {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.producto(id) }),
	);

	if (!Item || Item.estado !== "activo") {
		throw noEncontrado("Producto no encontrado");
	}

	const producto = sinLlaves(Item);

	// La plantilla y el taller se resuelven aquí y no en el navegador: son dos
	// lecturas más que el front tendría que encadenar antes de pintar nada, y
	// el editor no puede montar el lienzo sin la plantilla.
	const [talleres, plantilla] = await Promise.all([
		talleresDe([producto]),
		plantillaDe(String(producto.templateId ?? "")),
	]);

	const taller = talleres.get(String(producto.proveedorId ?? ""));

	return {
		...aFicha(producto, talleres),
		customizationRules: producto.customizationRules ?? {},
		templateSides: producto.templateSides ?? [],
		pricing: producto.pricing ?? {},
		production: producto.production ?? {},
		/* Las fotos de la prenda real con su cuadro de impresión. Van SÓLO en la
		   ficha y no en el listado: las usa el editor para enseñar el diseño
		   puesto, y en el catálogo serían decenas de cuadros de cuatro puntos
		   que nadie mira, multiplicados por cada producto. */
		fotosReales: producto.fotosReales ?? [],
		plantilla,
		taller: taller ?? null,
	};
}

async function plantillaDe(templateId: string) {
	if (!templateId) return null;

	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.plantilla(templateId) }),
	);

	return Item ? sinLlaves(Item) : null;
}

type Taller = {
	id: string;
	name: string | null;
	displayName: string | null;
	slug: string | null;
	avatarUrl: string | null;
};

function aFicha(
	p: Record<string, unknown>,
	talleres: Map<string, Taller>,
): Ficha {
	const taller = talleres.get(String(p.proveedorId ?? ""));
	const pricing = (p.pricing ?? {}) as Record<string, number | undefined>;
	const production = (p.production ?? {}) as {
		meta?: { diasProduccion?: number };
	};

	return {
		id: String(p.id),
		slug: String(p.slug ?? ""),
		name: String(p.name ?? ""),
		description: (p.description as string | undefined) ?? undefined,
		images: (p.images as Ficha["images"]) ?? [],
		basePrice: pricing.basePrice,
		categoryIds: (p.categoryIds as string[]) ?? [],
		provider: taller?.displayName ?? taller?.name ?? undefined,
		productionDays: production.meta?.diasProduccion,
		colors: (p.colors as Ficha["colors"]) ?? [],
		sizes: (p.sizes as Ficha["sizes"]) ?? [],
		printSides: (p.printSides as Ficha["printSides"]) ?? [],
		templateId: String(p.templateId ?? ""),
	};
}

/**
 * El nombre del taller se resuelve al leer, no se copia dentro del producto:
 * el taller puede cambiárselo y el catálogo acabaría enseñando el viejo.
 */
async function talleresDe(productos: Record<string, unknown>[]) {
	const ids = [
		...new Set(
			productos
				.map((p) => String(p.proveedorId ?? ""))
				.filter((id) => id.length > 0),
		),
	];

	if (ids.length === 0) return new Map<string, Taller>();

	const { Responses } = await dynamo.send(
		new BatchGetCommand({
			RequestItems: {
				[TABLA]: {
					Keys: ids.map((id) => llaves.proveedor(id)),
					// Sólo lo que la ficha enseña del taller. El correo no sale al
					// público aunque esté en el mismo ítem.
					ProjectionExpression: "id, #nombre, displayName, slug, avatarUrl",
					ExpressionAttributeNames: { "#nombre": "name" },
				},
			},
		}),
	);

	return new Map<string, Taller>(
		(Responses?.[TABLA] ?? []).map((t) => [
			String(t.id),
			{
				id: String(t.id),
				name: (t.name as string | null) ?? null,
				displayName: (t.displayName as string | null) ?? null,
				slug: (t.slug as string | null) ?? null,
				avatarUrl: (t.avatarUrl as string | null) ?? null,
			},
		]),
	);
}
