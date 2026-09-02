import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo, llaves, sinLlaves, TABLA } from "../lib/dynamo.js";
import { malaPeticion } from "../lib/http.js";
import type { Identidad } from "./pedidos.js";

/**
 * La cuenta del comprador: cómo se llama, cómo contactarlo y a dónde manda.
 *
 * QUÉ NO SE GUARDA AQUÍ. El correo no: lo manda Cognito en el token y es el
 * que ata los pedidos. Guardar una copia editable sería tener dos verdades, y
 * dejar que alguien se lo cambiara aquí le movería el historial al de otra
 * persona.
 *
 * LA DIRECCIÓN DE AQUÍ NO ES LA DEL PEDIDO. Esta es la de "la próxima vez";
 * el pedido copia la suya al crearse y no se vuelve a mirar. Si la ficha del
 * pedido leyera de aquí, cambiar de casa reescribiría a dónde se mandó algo de
 * hace un mes.
 */

const CP = /^\d{5}$/;

type Cuerpo = Record<string, any>;

const texto = (v: unknown) => String(v ?? "").trim();

export async function obtener(quien: Identidad) {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.comprador(quien.sub) }),
	);

	// Sin perfil no es un 404: es alguien que acaba de entrar y todavía no ha
	// guardado nada. Se devuelve el esqueleto para que la pantalla pinte los
	// campos vacíos en vez de un error.
	if (!Item) {
		return {
			id: quien.sub,
			nombre: null,
			whatsapp: null,
			direccion: null,
			creadoEn: null,
		};
	}

	return sinLlaves(Item);
}

export async function guardar(quien: Identidad, cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;

	const nombre = texto(c.nombre);
	if (!nombre) throw malaPeticion("Falta tu nombre");

	const previo = await obtener(quien);

	const item = {
		...llaves.comprador(quien.sub),
		id: quien.sub,
		nombre,
		whatsapp: texto(c.whatsapp) || null,
		direccion: leerDireccion(c.direccion),
		creadoEn: previo.creadoEn ?? new Date().toISOString(),
		actualizadoEn: new Date().toISOString(),
	};

	await dynamo.send(new PutCommand({ TableName: TABLA, Item: item }));
	return sinLlaves(item);
}

/**
 * La dirección guardada, en lista blanca y con los MISMOS nombres de campo
 * que usa el pedido: así el checkout la puede precargar tal cual, sin traducir
 * nada en medio.
 *
 * Aquí se puede borrar —mandando `null`— y se puede dejar incompleta mientras
 * no falte lo esencial, porque nadie va a mandar un paquete con esto: es un
 * borrador para la próxima compra.
 */
function leerDireccion(d: unknown) {
	if (d === null || d === undefined) return null;

	const dir = d as Cuerpo;

	const direccion = {
		calle: texto(dir.calle),
		numero: texto(dir.numero),
		interior: texto(dir.interior) || null,
		colonia: texto(dir.colonia),
		ciudad: texto(dir.ciudad),
		estado: texto(dir.estado),
		cp: texto(dir.cp),
		referencias: texto(dir.referencias) || null,
	};

	// Si no escribió nada, es que la quiso quitar.
	const vacia = !direccion.calle && !direccion.colonia && !direccion.ciudad;
	if (vacia) return null;

	// El CP sí se valida aunque sea un borrador: uno mal escrito viaja al
	// checkout, se manda con el pedido y ahí ya cuesta un paquete perdido.
	if (direccion.cp && !CP.test(direccion.cp)) {
		throw malaPeticion("El código postal va a cinco dígitos");
	}

	return direccion;
}
