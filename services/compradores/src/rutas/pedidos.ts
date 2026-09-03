import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

import {
	consultarTodo,
	dynamo,
	llaves,
	sinLlaves,
	TABLA,
} from "../lib/dynamo.js";
import { noAutorizado, noEncontrado } from "../lib/http.js";

/**
 * Los pedidos de quien trae el token.
 *
 * Se buscan por CORREO, no por `sub`, y eso es a propósito: se puede pedir sin
 * cuenta, y el pedido queda indexado por el correo que se capturó al pedir.
 * Quien después se registra con ese mismo correo se encuentra su historial ya
 * puesto, sin migrar nada.
 *
 * El precio de esa decisión es que el correo del token TIENE que venir
 * verificado. Si no, cualquiera se registra con el correo de otro y le lee los
 * pedidos —con su dirección y su teléfono dentro—. Por eso `correoDe` corta
 * cuando `email_verified` no es cierto: es la única cosa que separa un
 * historial del de otra persona.
 */

export type Identidad = {
	sub: string;
	email: string;
	correoVerificado: boolean;
};

export function correoDe(quien: Identidad) {
	if (!quien.correoVerificado) {
		throw noAutorizado(
			"Tu correo no está verificado, así que no podemos enseñarte pedidos.",
		);
	}
	return quien.email.toLowerCase();
}

/**
 * Lo que NO sale nunca de aquí.
 *
 * `tokenHuella` es la huella del enlace de seguimiento. No sirve para
 * suplantar a nadie —es un hash— pero es un secreto de la fila y no tiene por
 * qué viajar al navegador.
 */
function sinSecretos(item: Record<string, unknown>) {
	const { tokenHuella, ...resto } = sinLlaves(item);
	return resto;
}

/**
 * El pedido tal como puede verlo QUIEN LO COMPRÓ.
 *
 * Quitar la huella del token no basta: el envío y la guía llevan dentro cosas
 * del taller. La **etiqueta** es su documento operativo, y el **costo real**
 * comparado con lo que se cobró deja el margen a la vista. Se recortan a lo
 * único que el comprador necesita: quién lleva el paquete, cuánto pagó y el
 * número para rastrearlo.
 *
 * OJO: esto está DUPLICADO en `services/admin/src/rutas/pedidos.ts`, porque
 * cada servicio tiene su propio `lib`. Si cambias una, cambia la otra — es un
 * filtro de seguridad y divergirlo se nota tarde.
 */
function paraComprador(item: Record<string, unknown>) {
	const pedido = sinSecretos(item) as Record<string, any>;

	if (pedido.envio) {
		const { paqueteria, servicio, precio, diasEstimados } = pedido.envio;
		pedido.envio = { paqueteria, servicio, precio, diasEstimados };
	}

	if (pedido.guia) {
		const { paqueteria, rastreo, rastreoUrl, compradaEn } = pedido.guia;
		pedido.guia = { paqueteria, rastreo, rastreoUrl, compradaEn };
	}

	return pedido;
}

export async function listar(quien: Identidad) {
	const items = await consultarTodo({
		TableName: TABLA,
		IndexName: "gsi3",
		KeyConditionExpression: "gsi3pk = :pk",
		ExpressionAttributeValues: {
			":pk": llaves.pedidosDeComprador(correoDe(quien)).gsi3pk,
		},
		// La llave de orden empieza por la fecha, así que al revés es del
		// más nuevo al más viejo, que es como se miran los pedidos.
		ScanIndexForward: false,
	});

	return items.map(paraComprador);
}

export async function obtener(quien: Identidad, id: string) {
	const correo = correoDe(quien);

	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.pedido(id) }),
	);

	// Mismo mensaje si no existe y si es de otra persona: distinguirlos
	// convierte esta ruta en una forma de averiguar qué pedidos existen.
	if (!Item || String(Item.comprador?.email ?? "").toLowerCase() !== correo) {
		throw noEncontrado("No encontramos ese pedido");
	}

	return paraComprador(Item);
}
