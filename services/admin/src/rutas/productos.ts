import {
	BatchGetCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import {
	consultarTodo,
	dynamo,
	ESTADOS,
	type Estado,
	esConflicto,
	llaves,
	sinLlaves,
	TABLA,
} from "../lib/dynamo.js";
import { conflicto, malaPeticion, noEncontrado } from "../lib/http.js";

/**
 * Los productos, vistos por el admin.
 *
 * Quien los escribe es el taller (`services/proveedores`); aquí sólo se
 * revisan. La única transición que el admin puede hacer —y el taller no— es
 * poner un producto en `activo`: eso es lo que significa la aprobación.
 */

export async function listar(query: Record<string, string | undefined>) {
	const estado = (query.estado ?? "en_revision") as Estado;

	if (!ESTADOS.includes(estado)) {
		throw malaPeticion(
			`Estado desconocido: ${estado}. Usa ${ESTADOS.join(", ")}.`,
		);
	}

	const items = await consultarTodo({
		TableName: TABLA,
		IndexName: "gsi2",
		KeyConditionExpression: "gsi2pk = :pk",
		ExpressionAttributeValues: {
			":pk": llaves.productoPorEstado(estado, "").gsi2pk,
		},
		// Lo que lleva más tiempo esperando, primero: es una cola de trabajo.
		ScanIndexForward: true,
	});

	const productos = items.map(sinLlaves);

	return conNombreDelTaller(productos);
}

export async function obtener(id: string) {
	const items = await consultarTodo({
		TableName: TABLA,
		KeyConditionExpression: "pk = :pk",
		ExpressionAttributeValues: { ":pk": llaves.producto(id).pk },
	});

	const item = items[0];
	if (!item) throw noEncontrado("Producto no encontrado");

	const [conNombre] = await conNombreDelTaller([sinLlaves(item)]);
	return conNombre;
}

/**
 * Aprueba o regresa un producto.
 *
 * Sólo se puede revisar lo que está esperando revisión: la condición evita
 * que dos personas resuelvan la misma cosa a la vez, y que se apruebe algo
 * que el taller acaba de regresar a borrador.
 */
export async function revisar(id: string, cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Record<string, unknown>;
	const decision = String(c.decision ?? "");

	if (decision !== "aprobar" && decision !== "rechazar") {
		throw malaPeticion("La decisión tiene que ser 'aprobar' o 'rechazar'");
	}

	const nota = String(c.nota ?? "").trim();

	// Rechazar sin decir por qué deja al taller adivinando qué corregir, y la
	// nota es lo único que va a ver en su panel.
	if (decision === "rechazar" && !nota) {
		throw malaPeticion("Escribe por qué lo regresas: el taller sólo verá eso");
	}

	const estado: Estado = decision === "aprobar" ? "activo" : "rechazado";
	const ahora = new Date().toISOString();
	const indice = llaves.productoPorEstado(estado, ahora);

	try {
		const { Attributes } = await dynamo.send(
			new UpdateCommand({
				TableName: TABLA,
				Key: llaves.producto(id),
				UpdateExpression:
					"SET #estado = :estado, notaRevision = :nota, updatedAt = :ahora, " +
					"gsi2pk = :gsi2pk, gsi2sk = :gsi2sk",
				ExpressionAttributeNames: { "#estado": "estado" },
				ExpressionAttributeValues: {
					":estado": estado,
					// Al aprobar se limpia: una nota vieja junto a un producto
					// publicado se lee como si siguiera habiendo algo mal.
					":nota": decision === "aprobar" ? null : nota,
					":ahora": ahora,
					":gsi2pk": indice.gsi2pk,
					":gsi2sk": indice.gsi2sk,
					":esperando": "en_revision",
				},
				ConditionExpression: "attribute_exists(pk) AND #estado = :esperando",
				ReturnValues: "ALL_NEW",
			}),
		);

		return sinLlaves(Attributes ?? {});
	} catch (error) {
		if (esConflicto(error)) {
			throw conflicto(
				"Ese producto ya no está esperando revisión: alguien se te adelantó o el taller lo movió",
			);
		}
		throw error;
	}
}

/**
 * Le pega el nombre del taller a cada producto.
 *
 * No se guarda dentro del producto a propósito: el taller puede cambiarse el
 * nombre cuando quiera, y una copia vieja haría que la bandeja mienta sobre
 * de quién es cada cosa. Se leen sólo los talleres distintos que aparecen,
 * que en una cola de revisión son un puñado.
 */
async function conNombreDelTaller(productos: Record<string, unknown>[]) {
	const ids = [
		...new Set(
			productos
				.map((p) => String(p.proveedorId ?? ""))
				.filter((id) => id.length > 0),
		),
	];

	if (ids.length === 0) return productos;

	const { Responses } = await dynamo.send(
		new BatchGetCommand({
			RequestItems: {
				[TABLA]: {
					Keys: ids.map((id) => llaves.proveedor(id)),
					ProjectionExpression: "id, #nombre, displayName",
					ExpressionAttributeNames: { "#nombre": "name" },
				},
			},
		}),
	);

	const porId = new Map(
		(Responses?.[TABLA] ?? []).map((t) => [
			String(t.id),
			String(t.displayName ?? t.name ?? ""),
		]),
	);

	return productos.map((p) => ({
		...p,
		proveedorNombre:
			porId.get(String(p.proveedorId ?? "")) ?? "Taller dado de baja",
	}));
}
