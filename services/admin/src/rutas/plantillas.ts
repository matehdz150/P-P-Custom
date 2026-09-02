import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import {
	consultarTodo,
	dynamo,
	esConflicto,
	llaves,
	sinLlaves,
	TABLA,
} from "../lib/dynamo.js";
import { conflicto, malaPeticion, noEncontrado } from "../lib/http.js";

/** El área imprimible de un lado, en unidades del lienzo del editor. */
type Area = {
	id: string;
	type: "rect";
	left: number;
	top: number;
	width: number;
	height: number;
};

type DatosPlantilla = {
	sides: string[];
	sideLabels: Record<string, string>;
	mockups: Record<string, string>;
	editableAreas: Record<string, Area[]>;
};

export async function listar() {
	const items = await consultarTodo({
		TableName: TABLA,
		KeyConditionExpression: "pk = :pk",
		ExpressionAttributeValues: { ":pk": llaves.plantillas },
	});

	return items.map(sinLlaves);
}

export async function obtener(id: string) {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.plantilla(id) }),
	);

	if (!Item) throw noEncontrado("Plantilla no encontrada");
	return sinLlaves(Item);
}

export async function crear(cuerpo: unknown) {
	const dto = validar(cuerpo);
	const ahora = new Date().toISOString();

	try {
		await dynamo.send(
			new PutCommand({
				TableName: TABLA,
				Item: {
					...llaves.plantilla(dto.id),
					id: dto.id,
					name: dto.name,
					data: dto.data,
					createdAt: ahora,
					updatedAt: ahora,
				},
				// En Postgres esto era la llave primaria. Sin la condición, crear dos
				// veces el mismo id sobrescribe la plantilla sin avisar.
				ConditionExpression: "attribute_not_exists(pk)",
			}),
		);
	} catch (error) {
		if (esConflicto(error)) {
			throw conflicto(`Ya existe una plantilla con id "${dto.id}"`);
		}
		throw error;
	}

	return { id: dto.id };
}

export async function actualizar(id: string, cuerpo: unknown) {
	const dto = (cuerpo ?? {}) as Partial<{ name: string; data: DatosPlantilla }>;

	const asigna = ["#updatedAt = :updatedAt"];
	const nombres: Record<string, string> = { "#updatedAt": "updatedAt" };
	const valores: Record<string, unknown> = {
		":updatedAt": new Date().toISOString(),
	};

	if (dto.name !== undefined) {
		asigna.push("#name = :name");
		nombres["#name"] = "name"; // "name" y "data" son reservadas en Dynamo
		valores[":name"] = dto.name;
	}

	if (dto.data !== undefined) {
		asigna.push("#data = :data");
		nombres["#data"] = "data";
		valores[":data"] = dto.data;
	}

	if (asigna.length === 1) throw malaPeticion("Nada que actualizar");

	try {
		await dynamo.send(
			new UpdateCommand({
				TableName: TABLA,
				Key: llaves.plantilla(id),
				UpdateExpression: `SET ${asigna.join(", ")}`,
				ExpressionAttributeNames: nombres,
				ExpressionAttributeValues: valores,
				// Sin esto, un PATCH a un id inexistente CREA la plantilla a medias.
				ConditionExpression: "attribute_exists(pk)",
			}),
		);
	} catch (error) {
		if (esConflicto(error)) throw noEncontrado("Plantilla no encontrada");
		throw error;
	}

	return { ok: true };
}

export async function borrar(id: string) {
	try {
		await dynamo.send(
			new DeleteCommand({
				TableName: TABLA,
				Key: llaves.plantilla(id),
				ConditionExpression: "attribute_exists(pk)",
			}),
		);
	} catch (error) {
		if (esConflicto(error)) throw noEncontrado("Plantilla no encontrada");
		throw error;
	}

	return { ok: true };
}

/**
 * Sin Nest no hay class-validator, así que la validación va a mano. Es poca
 * y explícita: lo que entra aquí define lo que el editor puede dibujar, y un
 * lado sin mockup o sin área rompe el lienzo en silencio.
 */
function validar(cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Record<string, unknown>;

	const id = String(c.id ?? "").trim();
	const name = String(c.name ?? "").trim();
	const data = c.data as DatosPlantilla | undefined;

	if (!/^[a-z0-9-]{2,50}$/.test(id)) {
		throw malaPeticion("El id debe ser minúsculas, números o guiones");
	}
	if (!name) throw malaPeticion("Falta el nombre");
	if (!data || !Array.isArray(data.sides) || data.sides.length === 0) {
		throw malaPeticion("La plantilla necesita al menos un lado");
	}

	for (const lado of data.sides) {
		if (!data.mockups?.[lado]) {
			throw malaPeticion(`El lado "${lado}" no tiene mockup`);
		}
		if (!data.editableAreas?.[lado]?.length) {
			throw malaPeticion(`El lado "${lado}" no tiene área imprimible`);
		}
	}

	return { id, name, data };
}
