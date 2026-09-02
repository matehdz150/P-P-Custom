import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo, llaves, sinLlaves, TABLA } from "../lib/dynamo.js";
import { conflicto, malaPeticion, noEncontrado } from "../lib/http.js";
import {
	comprarGuia,
	consultarCotizacion,
	consultarEnvio,
	cotizar,
	type Direccion,
	type Tarifa,
} from "../lib/skydropx.js";

type Cuerpo = Record<string, any>;

/**
 * Comprar la guía con el peso REAL.
 *
 * POR QUÉ SE VUELVE A COTIZAR EN VEZ DE USAR LA DEL CHECKOUT
 *
 * La cotización que vio el comprador salió de un peso estimado: la suma de lo
 * que pesa cada talla y una caja apilada a ojo. El paquete de verdad pesa
 * otra cosa. Comprar sobre la cotización vieja imprime una etiqueta con un
 * peso que no es, y la paquetería repesa y factura la diferencia semanas
 * después, cuando ya nadie se acuerda del pedido.
 *
 * Así que se cotiza otra vez con lo que el taller acaba de medir, se busca la
 * MISMA paquetería y servicio que eligió el comprador —cambiarle la
 * paquetería a alguien que ya pagó es cambiarle el trato— y se compra ésa.
 *
 * LA DIFERENCIA SE ANOTA, NO SE COBRA
 *
 * Se decidió que la paga el taller, pero hoy no existen pagos al taller: no
 * hay de dónde descontar. Se guarda como cargo pendiente en el pedido y en la
 * cuenta del proveedor. Si no se registrara desde ahora, cuando existan las
 * liquidaciones no habría nada que cobrar hacia atrás.
 */
export async function comprar(
	proveedorId: string,
	pedidoId: string,
	cuerpo: unknown,
) {
	const pedido = await suyoOFalla(proveedorId, pedidoId);

	if (pedido.entrega?.metodo !== "envio") {
		throw malaPeticion("Este pedido lo recoge el cliente contigo");
	}
	if (pedido.guia?.envioId) {
		throw conflicto("Este pedido ya tiene guía");
	}
	if (!pedido.envio?.tarifaId) {
		throw malaPeticion("Este pedido no trae envío cotizado");
	}

	const paquete = leerPaquete(cuerpo);
	const taller = await leerTaller(proveedorId);

	// 1 · Recotizar con lo que se midió de verdad.
	const destino = comoDireccion(pedido.entrega.direccion);
	const cotizacionId = await cotizar(taller.direccion, destino, paquete);
	const tarifa = await esperarTarifa(cotizacionId, pedido.envio);

	// 2 · Comprar la etiqueta.
	const guia = await comprarGuia(
		cotizacionId,
		tarifa.id,
		{
			...taller.direccion,
			nombre: taller.nombre,
			telefono: taller.telefono,
			email: taller.email,
			calle: taller.calle,
			numero: taller.numero,
			referencias: taller.referencias,
		},
		{
			...destino,
			nombre: pedido.comprador?.nombre ?? "",
			telefono: pedido.comprador?.whatsapp ?? "",
			email: pedido.comprador?.email ?? "",
			calle: pedido.entrega.direccion?.calle ?? "",
			numero: pedido.entrega.direccion?.numero ?? "",
			referencias: pedido.entrega.direccion?.referencias ?? null,
		},
		paquete,
	);

	/* 3 · Lo que costó de más (o de menos) frente a lo que pagó el comprador.
	 *
	 * Manda lo que Skydropx nos COBRÓ, no la tarifa que había cotizado: son
	 * dos números distintos y el que sale de la cuenta es el primero. Si por
	 * lo que sea no lo devuelve, se cae a la tarifa. */
	const costoReal = guia.costo ?? tarifa.precio;
	const cobrado = Number(pedido.envio.precio ?? 0);
	const diferencia = Math.round((costoReal - cobrado) * 100) / 100;

	const ahora = new Date().toISOString();

	const { Attributes } = await dynamo.send(
		new UpdateCommand({
			TableName: TABLA,
			Key: llaves.pedido(pedidoId),
			UpdateExpression:
				"SET #guia = :guia, #envio.#real = :real, #updatedAt = :ahora",
			ExpressionAttributeNames: {
				"#guia": "guia",
				"#envio": "envio",
				"#real": "real",
				"#updatedAt": "updatedAt",
			},
			ExpressionAttributeValues: {
				":guia": { ...guia, compradaEn: ahora },
				":real": {
					...paquete,
					cotizacionId,
					tarifaId: tarifa.id,
					paqueteria: tarifa.paqueteria,
					servicio: tarifa.servicio,
					costo: costoReal,
					tarifaCotizada: tarifa.precio,
					// Positivo = costó más de lo cobrado y lo debe el taller.
					// Negativo = costó menos; sobró a favor de Kustto.
					diferencia,
				},
				":ahora": ahora,
			},
			// Sin esto, dos clics seguidos compran dos guías y se pagan las dos.
			ConditionExpression: "attribute_not_exists(#guia)",
			ReturnValues: "ALL_NEW",
		}),
	);

	if (diferencia !== 0) await anotarCargo(proveedorId, pedidoId, diferencia);

	return sinLlaves(Attributes ?? {});
}

/**
 * Vuelve a preguntar por la etiqueta.
 *
 * Existe porque la etiqueta no está lista cuando el envío se crea: cada
 * paquetería tarda lo suyo en devolverla, y con ampm pasaron minutos. El
 * panel llama a esto hasta que aparece, en vez de tener a la Lambda esperando
 * algo que puede no llegar en 29 segundos.
 *
 * Sólo escribe si hay novedad, para no reescribir el pedido en cada sondeo.
 */
export async function refrescar(proveedorId: string, pedidoId: string) {
	const pedido = await suyoOFalla(proveedorId, pedidoId);
	const guiaVieja = pedido.guia as Cuerpo | undefined;

	if (!guiaVieja?.envioId) throw noEncontrado("Este pedido no tiene guía");
	if (guiaVieja.etiquetaUrl) return { guia: guiaVieja, lista: true };

	const guia = await consultarEnvio(String(guiaVieja.envioId));
	if (!guia.etiquetaUrl) return { guia: guiaVieja, lista: false };

	const { Attributes } = await dynamo.send(
		new UpdateCommand({
			TableName: TABLA,
			Key: llaves.pedido(pedidoId),
			UpdateExpression: "SET #guia = :guia, #updatedAt = :ahora",
			ExpressionAttributeNames: { "#guia": "guia", "#updatedAt": "updatedAt" },
			ExpressionAttributeValues: {
				// El costo y la fecha de compra son los de la compra, no los de
				// ahora: reescribirlos con lo que devuelva una consulta posterior
				// borraría el número con el que se calculó la diferencia.
				":guia": {
					...guiaVieja,
					rastreo: guia.rastreo,
					rastreoUrl: guia.rastreoUrl,
					etiquetaUrl: guia.etiquetaUrl,
				},
				":ahora": new Date().toISOString(),
			},
			ReturnValues: "ALL_NEW",
		}),
	);

	return { guia: (Attributes as Cuerpo)?.guia, lista: true };
}

/**
 * Espera a que la cotización traiga la paquetería que eligió el comprador.
 *
 * Se busca por paquetería Y servicio, no por id: los ids son de cada
 * cotización y ésta es nueva. Si ya no está —cambió la zona con el peso, o la
 * paquetería dejó de cubrir— se cae a la más barata que no tarde más de lo
 * prometido, porque llegar tarde es peor que llegar por otra empresa.
 */
async function esperarTarifa(
	cotizacionId: string,
	elegido: Cuerpo,
): Promise<Tarifa> {
	let tarifas: Tarifa[] = [];

	// Ocho intentos, no diez: la funcion tiene 29 segundos y aqui solo cabe
	// una parte. En la practica las tarifas llegan completas antes de 6.
	for (let intento = 0; intento < 8; intento++) {
		await new Promise((r) => setTimeout(r, 800));
		const r = await consultarCotizacion(cotizacionId);
		tarifas = r.tarifas;
		if (r.lista) break;
	}

	if (tarifas.length === 0) {
		throw malaPeticion(
			"La paquetería no cotizó este paquete. Revisa el peso y las medidas.",
		);
	}

	const misma = tarifas.find(
		(t) =>
			t.paqueteria === elegido.paqueteria && t.servicio === elegido.servicio,
	);
	if (misma) return misma;

	const prometidos = Number(elegido.diasEstimados ?? 99);
	const aTiempo = tarifas
		.filter((t) => (t.dias ?? 99) <= prometidos)
		.sort((a, b) => a.precio - b.precio)[0];

	return aTiempo ?? tarifas[0];
}

/**
 * El cargo pendiente del taller.
 *
 * Se acumula en su ítem y se detalla por pedido, para poder explicarle de
 * dónde sale cada peso cuando llegue el día de liquidar. Un total sin
 * desglose no se puede defender ante quien lo va a pagar.
 */
async function anotarCargo(
	proveedorId: string,
	pedidoId: string,
	diferencia: number,
) {
	await dynamo
		.send(
			new UpdateCommand({
				TableName: TABLA,
				Key: llaves.proveedor(proveedorId),
				UpdateExpression:
					"SET saldoEnvios = if_not_exists(saldoEnvios, :cero) + :d, cargosEnvio = list_append(if_not_exists(cargosEnvio, :vacia), :cargo)",
				ExpressionAttributeValues: {
					":cero": 0,
					":d": diferencia,
					":vacia": [],
					":cargo": [
						{ pedidoId, diferencia, en: new Date().toISOString() },
					],
				},
			}),
		)
		// La guía YA se compró. Si esto falla, el pedido está bien y lo que se
		// pierde es un apunte contable: se grita, no se tira el envío.
		.catch((error) =>
			console.error(`No pude anotar el cargo de ${pedidoId}:`, error),
		);
}

function leerPaquete(cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;

	const numero = (v: unknown, nombre: string, tope: number) => {
		const n = Number(v);
		if (!Number.isFinite(n) || n <= 0) {
			throw malaPeticion(`Falta ${nombre} del paquete`);
		}
		if (n > tope) throw malaPeticion(`${nombre} parece equivocado: ${n}`);
		return Math.round(n * 100) / 100;
	};

	return {
		peso: numero(c.peso, "el peso en kilos", 70),
		largo: numero(c.largo, "el largo en centímetros", 200),
		ancho: numero(c.ancho, "el ancho en centímetros", 200),
		alto: numero(c.alto, "el alto en centímetros", 200),
	};
}

function comoDireccion(d: Cuerpo | null): Direccion {
	return {
		cp: String(d?.cp ?? ""),
		estado: String(d?.estado ?? ""),
		ciudad: String(d?.ciudad ?? ""),
		colonia: String(d?.colonia ?? ""),
	};
}

async function leerTaller(proveedorId: string) {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.proveedor(proveedorId) }),
	);

	const r = Item?.recoleccion as Cuerpo | undefined;
	if (!r?.cp) {
		throw malaPeticion(
			"Pon tu dirección de recolección en tu perfil antes de generar guías",
		);
	}

	// La paquetería lo exige para poder recoger. Se avisa aquí y no se deja
	// llegar al 422 de Skydropx, que dice "phone no puede estar en blanco" sin
	// explicar de quién ni dónde ponerlo.
	const telefono = String(Item?.whatsapp ?? "").trim();
	if (!telefono) {
		throw malaPeticion(
			"Pon tu teléfono en el perfil: la paquetería lo necesita para recoger",
		);
	}

	return {
		direccion: comoDireccion(r),
		nombre: String(Item?.displayName ?? Item?.name ?? "Taller"),
		telefono,
		email: String(Item?.email ?? ""),
		calle: String(r.calle ?? ""),
		numero: String(r.numero ?? ""),
		referencias: (r.referencias as string | null) ?? null,
	};
}

async function suyoOFalla(proveedorId: string, id: string) {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.pedido(id) }),
	);

	if (!Item || Item.proveedorId !== proveedorId) {
		throw noEncontrado("Ese pedido no existe o no es tuyo");
	}

	return Item as Cuerpo;
}
