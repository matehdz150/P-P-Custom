import { randomUUID } from "node:crypto";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, llaves, sinLlaves, TABLA } from "../lib/dynamo.js";
import { conflicto, malaPeticion, noEncontrado } from "../lib/http.js";
import { firmarSubidas as prepararSubidas } from "./carrito.js";

type Cuerpo = Record<string, any>;
const CODIGO = /^[a-zA-Z0-9_-]{8,32}$/;
const ID = /^[a-zA-Z0-9_-]{8,80}$/;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const s3 = new S3Client({});
const BUCKET_PUBLICO =
	process.env.KUSTTO_BUCKET_PUBLICO ?? "kustto-publico-prod";

export async function obtener(codigo: string) {
	const evento = await porCodigo(codigo);
	const ahora = new Date().toISOString();
	const estadoPublico =
		evento.estado !== "publicado"
			? String(evento.estado)
			: ahora < String(evento.abreEn)
				? "proximamente"
				: ahora >= String(evento.cierraEn)
					? "cerrado"
					: "abierto";
	return {
		id: evento.id,
		codigo: evento.codigo,
		nombre: evento.nombre,
		descripcion: evento.descripcion ?? null,
		imagen: evento.imagen ?? null,
		estado: estadoPublico,
		abreEn: evento.abreEn,
		cierraEn: evento.cierraEn,
		entrega: {
			ciudad: evento.direccion?.ciudad ?? "",
			estado: evento.direccion?.estado ?? "",
		},
		productos: evento.productos ?? [],
	};
}

export async function participar(codigo: string, cuerpo: unknown) {
	const evento = await porCodigo(codigo);
	const ahora = new Date().toISOString();
	if (
		evento.estado !== "publicado" ||
		ahora < String(evento.abreEn) ||
		ahora >= String(evento.cierraEn)
	) {
		throw conflicto("Este evento no está recibiendo participaciones.");
	}
	const c = (cuerpo ?? {}) as Cuerpo;
	const intentoId = String(c.intentoId ?? "");
	if (!ID.test(intentoId))
		throw malaPeticion("Falta identificar este intento.");
	const participante = {
		nombre: String(c.participante?.nombre ?? "").trim(),
		email: String(c.participante?.email ?? "")
			.trim()
			.toLowerCase(),
		whatsapp:
			String(c.participante?.whatsapp ?? "")
				.replace(/[^\d+]/g, "")
				.slice(0, 18) || null,
	};
	if (!participante.nombre || !CORREO.test(participante.email)) {
		throw malaPeticion("Escribe tu nombre y un correo válido.");
	}

	const permitidos = new Map<string, Cuerpo>(
		(evento.productos ?? []).map((p: Cuerpo) => [String(p.id), p]),
	);
	const crudas = Array.isArray(c.lineas) ? c.lineas : [];
	if (!crudas.length || crudas.length > 10)
		throw malaPeticion("Elige al menos un producto.");
	const lineas = [];
	let subtotal = 0;
	for (const linea of crudas) {
		const permitido = permitidos.get(String(linea.eventoItemId));
		if (!permitido) throw malaPeticion("Ese producto no pertenece al evento.");
		const piezas = Math.trunc(Number(linea.piezas ?? 0));
		if (piezas < 1 || piezas > 50)
			throw malaPeticion("La cantidad debe estar entre 1 y 50.");
		const talla = String(linea.talla ?? "");
		const color = String(linea.color ?? "");
		if (!(permitido.tallas ?? []).includes(talla))
			throw malaPeticion("Esa talla no está disponible.");
		if (
			color &&
			!(permitido.colores ?? []).some((v: Cuerpo) => v.nombre === color)
		) {
			throw malaPeticion("Ese color no está disponible.");
		}

		const { Item: producto } = await dynamo.send(
			new GetCommand({
				TableName: TABLA,
				Key: { pk: `PRODUCT#${permitido.productoId}`, sk: "META" },
			}),
		);
		if (!producto || producto.estado !== "activo")
			throw conflicto("Uno de los productos ya no está disponible.");
		const unitario = Number(producto.pricing?.basePrice ?? 0);
		const total = Math.round(unitario * piezas * 100) / 100;
		subtotal += total;
		lineas.push({
			id: randomUUID(),
			eventoItemId: permitido.id,
			productoId: permitido.productoId,
			producto: permitido.nombre,
			talla,
			color: color || null,
			piezas,
			unitario,
			total,
			diseno: await leerDiseno(evento, permitido, linea.diseno),
		});
	}

	const id = intentoId;
	const item = {
		...llaves.participacionDeEvento(String(evento.id), id),
		id,
		eventoId: evento.id,
		participante,
		lineas,
		subtotal: Math.round(subtotal * 100) / 100,
		estadoPago: "pendiente",
		creadaEn: ahora,
	};
	try {
		await dynamo.send(
			new PutCommand({
				TableName: TABLA,
				Item: item,
				ConditionExpression: "attribute_not_exists(pk)",
			}),
		);
	} catch (error: any) {
		if (error?.name !== "ConditionalCheckFailedException") throw error;
		const { Item } = await dynamo.send(
			new GetCommand({
				TableName: TABLA,
				Key: llaves.participacionDeEvento(String(evento.id), id),
			}),
		);
		return Item ? sinLlaves(Item) : sinLlaves(item);
	}
	return sinLlaves(item);
}

export async function firmarSubidas(codigo: string, cuerpo: unknown) {
	const evento = await porCodigo(codigo);
	const ahora = new Date().toISOString();
	if (
		evento.estado !== "publicado" ||
		ahora < String(evento.abreEn) ||
		ahora >= String(evento.cierraEn)
	) {
		throw conflicto("Este evento no está recibiendo diseños.");
	}
	const c = (cuerpo ?? {}) as Cuerpo;
	const eventoItemId = String(c.eventoItemId ?? "");
	const producto = (evento.productos ?? []).find(
		(p: Cuerpo) => String(p.id) === eventoItemId,
	);
	if (!producto) throw malaPeticion("Ese producto no pertenece al evento.");
	if (producto.personalizacion === "sin_personalizacion") {
		throw conflicto("Este producto no admite personalización.");
	}

	const resultado = await prepararSubidas(
		cuerpo,
		`eventos/${evento.id}/${eventoItemId}`,
	);
	const diseno = resultado.subidas.find((s) => s.tipo === "diseno");
	if (!diseno) throw malaPeticion("Falta el archivo editable del diseño.");

	await dynamo.send(
		new PutCommand({
			TableName: TABLA,
			Item: {
				...llaves.disenoDeEvento(String(evento.id), resultado.itemId),
				id: resultado.itemId,
				eventoItemId,
				ruta: diseno.ruta,
				creadoEn: ahora,
				// El bucket elimina el arte a los 90 días; el apunte caduca igual.
				expiraEn: Math.floor(Date.now() / 1000) + 90 * 24 * 3600,
			},
			ConditionExpression: "attribute_not_exists(pk)",
		}),
	);
	return resultado;
}

type DependenciasDeDiseno = {
	buscar: (eventoId: string, disenoId: string) => Promise<Cuerpo | undefined>;
	comprobarArchivo: (ruta: string) => Promise<void>;
};

const dependenciasDeDiseno: DependenciasDeDiseno = {
	buscar: async (eventoId, disenoId) => {
		const { Item } = await dynamo.send(
			new GetCommand({
				TableName: TABLA,
				Key: llaves.disenoDeEvento(eventoId, disenoId),
			}),
		);
		return Item;
	},
	comprobarArchivo: async (ruta) => {
		await s3.send(
			new HeadObjectCommand({
				Bucket: BUCKET_PUBLICO,
				Key: ruta.slice(1),
			}),
		);
	},
};

/** Frontera de confianza entre una referencia del navegador y el arte emitido
 * por este evento. Las dependencias son inyectables para probar todos los
 * rechazos sin hablar con DynamoDB ni S3. */
export async function leerDiseno(
	evento: Cuerpo,
	producto: Cuerpo,
	valor: unknown,
	dependencias: DependenciasDeDiseno = dependenciasDeDiseno,
) {
	if (valor === null || valor === undefined) {
		return producto.disenoBase ?? null;
	}
	if (producto.personalizacion === "sin_personalizacion") {
		throw malaPeticion("Ese producto no admite un diseño de invitado.");
	}
	const d = valor as Cuerpo;
	const carritoId = String(d.carritoId ?? "");
	if (!/^[0-9a-f-]{36}$/i.test(carritoId)) {
		throw malaPeticion("La referencia del diseño no es válida.");
	}
	const Item = await dependencias.buscar(String(evento.id), carritoId);
	if (!Item || String(Item.eventoItemId) !== String(producto.id)) {
		throw malaPeticion("Ese diseño no pertenece a este producto del evento.");
	}
	const ruta = String(Item.ruta ?? "");
	const rutaEsperada = `/eventos/${evento.id}/${producto.id}/${carritoId}/diseno.json`;
	if (ruta !== rutaEsperada) {
		throw malaPeticion("La referencia del diseño no es válida.");
	}
	try {
		await dependencias.comprobarArchivo(ruta);
	} catch {
		throw malaPeticion(
			"El diseño todavía no terminó de subir. Inténtalo otra vez.",
		);
	}
	return { carritoId, ruta };
}

async function porCodigo(codigo: string) {
	if (!CODIGO.test(codigo)) throw noEncontrado("Ese evento no existe.");
	const { Item: enlace } = await dynamo.send(
		new GetCommand({
			TableName: TABLA,
			Key: llaves.codigoDeEvento(codigo),
		}),
	);
	if (!enlace) throw noEncontrado("Ese evento no existe.");
	const { Item } = await dynamo.send(
		new GetCommand({
			TableName: TABLA,
			Key: llaves.evento(
				String(enlace.organizadorSub),
				String(enlace.eventoId),
			),
		}),
	);
	if (!Item) throw noEncontrado("Ese evento no existe.");
	return Item;
}
