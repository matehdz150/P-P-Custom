import {
	ConflictException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	QueryCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { dynamo, llaves, TABLA } from "../db/dynamo";
import type { CreateTemplateDto } from "./dto/create-template.dto";
import type { UpdateTemplateDto } from "./dto/update-template.dto";

/**
 * Las plantillas de prenda: lados, mockups y áreas imprimibles.
 *
 * Primer dominio que vive en DynamoDB. Se pudo migrar solo porque nada lo
 * une con nada: al publicar un producto la plantilla se COPIA dentro de él,
 * así que editar una plantilla no mueve los productos ya publicados.
 *
 * La forma de la respuesta es la misma que tenía en Postgres —{ id, name,
 * data, createdAt, updatedAt }— para que ni el controlador ni el admin se
 * enteren del cambio.
 */
@Injectable()
export class TemplatesService {
	async findAll() {
		const { Items } = await dynamo.send(
			new QueryCommand({
				TableName: TABLA,
				KeyConditionExpression: "pk = :pk",
				ExpressionAttributeValues: { ":pk": llaves.plantillas() },
			}),
		);

		return (Items ?? []).map(sinLlaves);
	}

	async findOne(id: string) {
		const { Item } = await dynamo.send(
			new GetCommand({ TableName: TABLA, Key: llaves.plantilla(id) }),
		);

		if (!Item) {
			throw new NotFoundException("Template no encontrado");
		}

		return sinLlaves(Item);
	}

	async create(dto: CreateTemplateDto) {
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
					// En Postgres esto era la llave primaria. Sin la condición, crear
					// dos veces el mismo id sobrescribe la plantilla en silencio.
					ConditionExpression: "attribute_not_exists(pk)",
				}),
			);
		} catch (error) {
			if (esConflicto(error)) {
				throw new ConflictException(
					`Ya existe una plantilla con id "${dto.id}"`,
				);
			}
			throw error;
		}

		return { id: dto.id };
	}

	async update(id: string, dto: UpdateTemplateDto) {
		// Se arma dinámico porque el PATCH puede traer name, data o los dos.
		const asigna: string[] = ["#updatedAt = :updatedAt"];
		const nombres: Record<string, string> = { "#updatedAt": "updatedAt" };
		const valores: Record<string, unknown> = {
			":updatedAt": new Date().toISOString(),
		};

		if (dto.name !== undefined) {
			asigna.push("#name = :name");
			nombres["#name"] = "name"; // "name" es palabra reservada en Dynamo
			valores[":name"] = dto.name;
		}

		if (dto.data !== undefined) {
			asigna.push("#data = :data");
			nombres["#data"] = "data";
			valores[":data"] = dto.data;
		}

		try {
			await dynamo.send(
				new UpdateCommand({
					TableName: TABLA,
					Key: llaves.plantilla(id),
					UpdateExpression: `SET ${asigna.join(", ")}`,
					ExpressionAttributeNames: nombres,
					ExpressionAttributeValues: valores,
					// Sin esto, un PATCH a un id inexistente CREA la plantilla a
					// medias en vez de fallar.
					ConditionExpression: "attribute_exists(pk)",
				}),
			);
		} catch (error) {
			if (esConflicto(error)) {
				throw new NotFoundException("Template no encontrado");
			}
			throw error;
		}

		return { ok: true };
	}

	async remove(id: string) {
		try {
			await dynamo.send(
				new DeleteCommand({
					TableName: TABLA,
					Key: llaves.plantilla(id),
					ConditionExpression: "attribute_exists(pk)",
				}),
			);
		} catch (error) {
			if (esConflicto(error)) {
				throw new NotFoundException("Template no encontrado");
			}
			throw error;
		}

		return { ok: true };
	}
}

/** Las llaves son de la tabla, no de la plantilla: no salen a la API. */
function sinLlaves(item: Record<string, unknown>) {
	const { pk, sk, ...resto } = item;
	return resto;
}

function esConflicto(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as { name?: string }).name === "ConditionalCheckFailedException"
	);
}
