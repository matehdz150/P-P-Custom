import { DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo, llaves, TABLA } from "./lib/dynamo.js";
import { proveedorDelToken } from "./lib/cognito.js";

/**
 * Las conexiones en vivo del panel del taller.
 *
 * Aquí no se sirve ningún dato: esta función sólo apunta quién está conectado
 * y quién se fue. Los pedidos siguen saliendo de la API de siempre. Cuando cae
 * uno nuevo, `kustto-admin` mira esta lista y avisa a las conexiones del taller
 * dueño; el navegador entonces recarga su lista por HTTP.
 *
 * Se manda un aviso y no el pedido entero a propósito: así el WebSocket no se
 * convierte en una segunda API que hay que mantener en paralelo —con sus
 * mismas reglas de qué ve cada taller— y sigue habiendo un único sitio donde
 * se decide qué datos salen.
 *
 * UNA SOLA FUNCIÓN PARA DOS COSAS. API Gateway invoca esta misma Lambda como
 * autorizador de `$connect` y como integración de las rutas. Los eventos se
 * distinguen sin ambigüedad (`type: "REQUEST"` sólo lo trae el autorizador), y
 * separarlas serían dos paquetes y dos despliegues para cien líneas.
 */

/**
 * Cuánto vive el apunte de una conexión.
 *
 * API Gateway cierra las conexiones ociosas a las 2 horas, y el tope duro son
 * 2 horas también, así que a las 3 el ítem sobra con certeza. El TTL es la red
 * de seguridad para cuando el `$disconnect` no llega —la Lambda falla, la
 * región hipa—: sin él quedarían apuntes eternos a los que escribir.
 */
const VIDA_CONEXION_S = 3 * 60 * 60;

type Evento = {
	type?: string;
	methodArn?: string;
	queryStringParameters?: Record<string, string | undefined> | null;
	requestContext?: {
		routeKey?: string;
		connectionId?: string;
		authorizer?: { proveedorId?: string } | null;
	};
};

export async function handler(evento: Evento) {
	// El autorizador. Es el único evento que trae `type`.
	if (evento.type === "REQUEST") return await autorizar(evento);

	const ruta = evento.requestContext?.routeKey;
	const connectionId = evento.requestContext?.connectionId ?? "";

	if (ruta === "$connect") return await conectar(evento, connectionId);
	if (ruta === "$disconnect") return await desconectar(connectionId);

	// `$default`: hoy el cliente no manda nada que haya que atender. Se
	// responde 200 para que API Gateway no cierre la conexión.
	return { statusCode: 200 };
}

/**
 * Deja pasar o no la conexión.
 *
 * Devolver una política de IAM es lo que espera API Gateway; lo que de verdad
 * importa es el `context`, que viaja hasta `$connect` y es de donde sale el
 * taller. Confiar en un `proveedorId` que mandara el cliente sería dejar que
 * cualquiera escuchara los pedidos de otro.
 */
async function autorizar(evento: Evento) {
	const token = evento.queryStringParameters?.token ?? "";

	if (!token) throw new Error("Unauthorized");

	let proveedorId: string;
	try {
		proveedorId = await proveedorDelToken(token);
	} catch (error) {
		// El motivo va al registro, no al cliente: decirle a quien prueba
		// tokens cuál falló y por qué le ahorra trabajo.
		console.error("Token rechazado:", error);
		throw new Error("Unauthorized");
	}

	return {
		principalId: proveedorId,
		policyDocument: {
			Version: "2012-10-17",
			Statement: [
				{
					Action: "execute-api:Invoke",
					Effect: "Allow",
					Resource: evento.methodArn,
				},
			],
		},
		context: { proveedorId },
	};
}

async function conectar(evento: Evento, connectionId: string) {
	const proveedorId = evento.requestContext?.authorizer?.proveedorId;

	// Sin taller no hay a quién avisarle: mejor rechazar que guardar un apunte
	// huérfano al que nunca se le va a escribir.
	if (!proveedorId) return { statusCode: 401 };

	await dynamo.send(
		new PutCommand({
			TableName: TABLA,
			Item: {
				...llaves.conexion(connectionId),
				...llaves.conexionesDeProveedor(proveedorId, connectionId),
				connectionId,
				proveedorId,
				desde: new Date().toISOString(),
				expiraEn: Math.floor(Date.now() / 1000) + VIDA_CONEXION_S,
			},
		}),
	);

	return { statusCode: 200 };
}

async function desconectar(connectionId: string) {
	await dynamo.send(
		new DeleteCommand({
			TableName: TABLA,
			Key: llaves.conexion(connectionId),
		}),
	);

	return { statusCode: 200 };
}
