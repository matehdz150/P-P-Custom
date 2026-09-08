import { randomBytes, randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
	DeleteCommand,
	GetCommand,
	PutCommand,
	TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
	consultarTodo,
	dynamo,
	llaves,
	sinLlaves,
	TABLA,
} from "../lib/dynamo.js";
import { conflicto, malaPeticion, noEncontrado } from "../lib/http.js";
import { BUCKET_PUBLICO } from "../lib/medios.js";
import type { Identidad } from "./pedidos.js";

type Cuerpo = Record<string, any>;
const ID = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_ITEMS = 5;
const MAX_EVENTOS = 50;

const s3 = new S3Client({});

/**
 * La foto de portada del evento.
 *
 * SVG SE QUEDA FUERA por lo mismo que en la biblioteca de imágenes: un SVG
 * puede traer `<script>` y esto se sirve desde NUESTRO origen (`/medios/…`).
 */
const TIPOS_DE_FOTO: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

/** Una foto de teléfono ronda los 5 MB. */
const MAXIMO_FOTO = 10 * 1024 * 1024;

export async function listar(quien: Identidad) {
	const { pk, prefijo } = llaves.eventosDe(quien.sub);
	const items = await consultarTodo({
		TableName: TABLA,
		KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
		ExpressionAttributeValues: { ":pk": pk, ":sk": prefijo },
		ScanIndexForward: false,
	});
	return items.map(sinLlaves);
}

export async function obtener(quien: Identidad, id: string) {
	const evento = await suyoOFalla(quien, id);
	const { pk, prefijo } = llaves.participacionesDeEvento(id);
	const participaciones = await consultarTodo({
		TableName: TABLA,
		KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
		ExpressionAttributeValues: { ":pk": pk, ":sk": prefijo },
		ScanIndexForward: false,
	});
	return {
		...sinLlaves(evento),
		participaciones: participaciones.map(sinLlaves),
	};
}

export async function crear(quien: Identidad, cuerpo: unknown) {
	const existentes = await listar(quien);
	if (existentes.length >= MAX_EVENTOS) {
		throw conflicto(`No puedes tener más de ${MAX_EVENTOS} eventos.`);
	}

	const contenido = await leerContenido((cuerpo ?? {}) as Cuerpo, quien.sub);
	const fecha = new Date().toISOString();
	const orden = fecha.replace(/[-:.TZ]/g, "");
	const id = `${orden}-${randomUUID().slice(0, 8)}`;
	const item = {
		...llaves.evento(quien.sub, id),
		id,
		codigo: randomBytes(9).toString("base64url"),
		estado: "borrador",
		...contenido,
		creadoEn: fecha,
		actualizadoEn: fecha,
	};

	await dynamo.send(new PutCommand({ TableName: TABLA, Item: item }));
	return sinLlaves(item);
}

export async function actualizar(
	quien: Identidad,
	id: string,
	cuerpo: unknown,
) {
	const anterior = await suyoOFalla(quien, id);
	if (anterior.estado !== "borrador") {
		throw conflicto("Un evento publicado ya no puede cambiar sus reglas.");
	}
	const contenido = await leerContenido(
		(cuerpo ?? {}) as Cuerpo,
		quien.sub,
		(anterior.productos ?? []) as Cuerpo[],
	);
	const item = {
		...anterior,
		...contenido,
		actualizadoEn: new Date().toISOString(),
	};
	await dynamo.send(new PutCommand({ TableName: TABLA, Item: item }));
	return sinLlaves(item);
}

export async function publicar(quien: Identidad, id: string) {
	const anterior = await suyoOFalla(quien, id);
	if (anterior.estado !== "borrador") {
		throw conflicto("Ese evento ya fue publicado.");
	}
	const ahora = new Date().toISOString();
	if (String(anterior.cierraEn) <= ahora) {
		throw malaPeticion("La fecha de cierre tiene que estar en el futuro.");
	}
	const incompleto = (anterior.productos ?? []).find(
		(producto: Cuerpo) =>
			producto.personalizacion === "bloqueada" && !producto.disenoBase,
	);
	if (incompleto) {
		throw malaPeticion(
			`Crea el diseño base de ${String(incompleto.nombre ?? "uno de los productos")} antes de publicar.`,
		);
	}
	const codigo = String(anterior.codigo ?? "");
	const item = {
		...anterior,
		estado: "publicado",
		publicadoEn: ahora,
		actualizadoEn: ahora,
	};
	await dynamo.send(
		new TransactWriteCommand({
			TransactItems: [
				{ Put: { TableName: TABLA, Item: item } },
				{
					Put: {
						TableName: TABLA,
						Item: {
							...llaves.codigoDeEvento(codigo),
							eventoId: id,
							organizadorSub: quien.sub,
						},
						ConditionExpression: "attribute_not_exists(pk)",
					},
				},
			],
		}),
	);
	return sinLlaves(item);
}

export async function cerrar(quien: Identidad, id: string) {
	const anterior = await suyoOFalla(quien, id);
	if (anterior.estado !== "publicado")
		throw conflicto("Sólo se puede cerrar un evento publicado.");
	const ahora = new Date().toISOString();
	const item = {
		...anterior,
		estado: "cerrado",
		cerradoEn: ahora,
		actualizadoEn: ahora,
	};
	await dynamo.send(new PutCommand({ TableName: TABLA, Item: item }));
	return sinLlaves(item);
}

export async function configurarProducto(
	quien: Identidad,
	id: string,
	itemId: string,
	cuerpo: unknown,
) {
	const anterior = await suyoOFalla(quien, id);
	if (anterior.estado !== "borrador") {
		throw conflicto(
			"Las reglas de personalización se fijan antes de publicar.",
		);
	}
	const c = (cuerpo ?? {}) as Cuerpo;
	const personalizacion = String(c.personalizacion ?? "");
	if (
		!["libre", "bloqueada", "sin_personalizacion"].includes(personalizacion)
	) {
		throw malaPeticion("Elige una regla de personalización válida.");
	}
	const arteId = c.arteId === null ? null : String(c.arteId ?? "");
	if (arteId && !/^[0-9a-f-]{36}$/i.test(arteId)) {
		throw malaPeticion("La referencia del diseño base no es válida.");
	}

	let encontrado = false;
	const productos = (anterior.productos ?? []).map((producto: Cuerpo) => {
		if (String(producto.id) !== itemId) return producto;
		encontrado = true;
		const disenoBase = arteId
			? {
					arteId,
					ruta: `/medios/plantillas/${quien.sub}/${arteId}/diseno.json`,
				}
			: c.arteId === null
				? null
				: (producto.disenoBase ?? null);
		return { ...producto, personalizacion, disenoBase };
	});
	if (!encontrado) throw noEncontrado("Ese producto no pertenece al evento.");

	const item = {
		...anterior,
		productos,
		actualizadoEn: new Date().toISOString(),
	};
	await dynamo.send(new PutCommand({ TableName: TABLA, Item: item }));
	return sinLlaves(item);
}

export async function borrar(quien: Identidad, id: string) {
	const evento = await suyoOFalla(quien, id);
	if (evento.estado !== "borrador")
		throw conflicto("Sólo se puede borrar un borrador.");
	await dynamo.send(
		new DeleteCommand({ TableName: TABLA, Key: llaves.evento(quien.sub, id) }),
	);
	return { ok: true };
}

async function suyoOFalla(quien: Identidad, id: string) {
	if (!ID.test(id)) throw noEncontrado("Ese evento no existe.");
	const { Item } = await dynamo.send(
		new GetCommand({
			TableName: TABLA,
			Key: llaves.evento(quien.sub, id),
		}),
	);
	if (!Item) throw noEncontrado("Ese evento no existe.");
	return Item;
}

/**
 * Firma la subida de la portada y devuelve dónde va a quedar.
 *
 * EL DESTINO LO DECIDE EL SERVIDOR: la carpeta lleva el `sub` del token, así
 * que nadie escribe en la de otro por muy bien que arme la petición. Misma
 * regla que la biblioteca de imágenes y que el arte del carrito.
 *
 * NO TOCA EL EVENTO. La ruta se guarda cuando el organizador manda el
 * formulario; si abandona a mitad, en S3 queda un archivo suelto y el evento
 * no apunta a una imagen que nunca terminó de subir.
 */
export async function firmarFoto(quien: Identidad, cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;

	const tipo = String(c.tipo ?? "");
	const extension = TIPOS_DE_FOTO[tipo];
	if (!extension) {
		throw malaPeticion(
			`Ese tipo de imagen no se puede usar (${tipo || "sin tipo"}). Usa PNG, JPG o WebP.`,
		);
	}

	const bytes = Number(c.bytes ?? 0);
	if (!Number.isFinite(bytes) || bytes <= 0) {
		throw malaPeticion("Falta el tamaño de la imagen.");
	}
	if (bytes > MAXIMO_FOTO) {
		throw malaPeticion(
			`Esa imagen pesa demasiado. El máximo son ${Math.round(MAXIMO_FOTO / 1024 / 1024)} MB.`,
		);
	}

	const llave = `medios/eventos/${quien.sub}/${randomUUID()}.${extension}`;
	const uploadUrl = await getSignedUrl(
		s3,
		new PutObjectCommand({
			Bucket: BUCKET_PUBLICO,
			Key: llave,
			ContentType: tipo,
			/* El tope va DENTRO de la firma para que lo aplique S3. Fuera sería
			   una promesa de la que no se encarga nadie. */
			ContentLength: bytes,
		}),
		{ expiresIn: 300 },
	);

	return { uploadUrl, url: `/${llave}` };
}

/**
 * Comprueba que la portada esté en la carpeta de quien la manda.
 *
 * El cuerpo llega del navegador, así que sin esto un organizador podría
 * apuntar la portada de su evento a cualquier ruta del bucket.
 */
function leerFoto(valor: unknown, sub: string) {
	if (valor === null || valor === undefined || valor === "") return null;
	const ruta = String(valor);
	const permitida = new RegExp(
		`^/medios/eventos/${sub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[0-9a-f-]{36}\\.(png|jpg|webp)$`,
	);
	if (!permitida.test(ruta)) {
		throw malaPeticion("Esa foto no es válida. Vuelve a subirla.");
	}
	return ruta;
}

async function leerContenido(
	c: Cuerpo,
	sub: string,
	productosAnteriores: Cuerpo[] = [],
) {
	const nombre = String(c.nombre ?? "").trim();
	const descripcion = String(c.descripcion ?? "").trim();
	if (!nombre || nombre.length > 80)
		throw malaPeticion("Pon un nombre de hasta 80 caracteres.");
	if (descripcion.length > 500)
		throw malaPeticion("La descripción no puede pasar de 500 caracteres.");

	const abreEn = fechaValida(c.abreEn, "apertura");
	const cierraEn = fechaValida(c.cierraEn, "cierre");
	if (cierraEn <= abreEn)
		throw malaPeticion("El cierre debe ser posterior a la apertura.");
	const direccion = leerDireccion(c.direccion);
	const ids = [
		...new Set((Array.isArray(c.productos) ? c.productos : []).map(String)),
	];
	if (!ids.length || ids.length > MAX_ITEMS || ids.some((id) => !ID.test(id))) {
		throw malaPeticion(`Elige entre 1 y ${MAX_ITEMS} productos válidos.`);
	}

	const productos = [];
	for (const id of ids) {
		const anterior = productosAnteriores.find(
			(producto) => String(producto.productoId) === id,
		);
		const personalizacionAnterior = String(anterior?.personalizacion ?? "");
		const { Item } = await dynamo.send(
			new GetCommand({ TableName: TABLA, Key: llaves.producto(id) }),
		);
		if (!Item || Item.estado !== "activo")
			throw malaPeticion("Uno de los productos ya no está publicado.");
		const tallas = (Item.sizes ?? [])
			.map((v: Cuerpo) => String(v.size ?? ""))
			.filter(Boolean);
		productos.push({
			/* El id del renglón es parte del contrato público: diseños base y
			   participaciones apuntan a él. Editar fechas o dirección no puede
			   regenerarlo y desprender el arte que ya configuró el organizador. */
			id: anterior?.id ?? randomUUID(),
			productoId: id,
			nombre: String(Item.name ?? "Producto"),
			imagen: Item.images?.[0]?.url ?? null,
			proveedorId: String(Item.proveedorId ?? ""),
			precioDesde: Number(Item.pricing?.basePrice ?? 0),
			colores: (Item.colors ?? []).map((v: Cuerpo) => ({
				nombre: String(v.name ?? ""),
				hex: v.hex ?? null,
			})),
			tallas: tallas.length ? tallas : ["Única"],
			disenoBase: anterior?.disenoBase ?? null,
			personalizacion: ["libre", "bloqueada", "sin_personalizacion"].includes(
				personalizacionAnterior,
			)
				? personalizacionAnterior
				: "libre",
		});
	}
	const proveedores = new Set(productos.map((p) => p.proveedorId));
	if (proveedores.size !== 1 || proveedores.has("")) {
		throw malaPeticion(
			"Por ahora, todos los productos del evento deben ser del mismo taller.",
		);
	}

	return {
		nombre,
		descripcion: descripcion || null,
		imagen: leerFoto(c.imagen, sub),
		abreEn,
		cierraEn,
		direccion,
		productos,
	};
}

function fechaValida(valor: unknown, nombre: string) {
	const fecha = new Date(String(valor ?? ""));
	if (Number.isNaN(fecha.valueOf()))
		throw malaPeticion(`Falta una fecha de ${nombre} válida.`);
	return fecha.toISOString();
}

function leerDireccion(valor: unknown) {
	const d = (valor ?? {}) as Cuerpo;
	const direccion = {
		calle: String(d.calle ?? "").trim(),
		numero: String(d.numero ?? "").trim(),
		interior: String(d.interior ?? "").trim() || null,
		colonia: String(d.colonia ?? "").trim(),
		ciudad: String(d.ciudad ?? "").trim(),
		estado: String(d.estado ?? "").trim(),
		cp: String(d.cp ?? "")
			.replace(/\D/g, "")
			.slice(0, 5),
		referencias: String(d.referencias ?? "").trim() || null,
	};
	if (
		!direccion.calle ||
		!direccion.numero ||
		!direccion.colonia ||
		!direccion.ciudad ||
		!direccion.estado ||
		direccion.cp.length !== 5
	) {
		throw malaPeticion("Completa la dirección donde se entregará el evento.");
	}
	return direccion;
}
