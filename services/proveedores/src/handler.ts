import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo, llaves, sinLlaves, TABLA } from "./lib/dynamo.js";
import {
	crearRouter,
	json,
	malaPeticion,
	noAutorizado,
	noEncontrado,
	respuestaDeError,
} from "./lib/http.js";
import * as catalogo from "./rutas/catalogo.js";
import * as guias from "./rutas/guias.js";
import * as pedidos from "./rutas/pedidos.js";
import * as productos from "./rutas/productos.js";
import * as subidas from "./rutas/subidas.js";

/**
 * La API del panel del proveedor.
 *
 * Aquí NO se verifica ningún token: eso lo hace el autorizador JWT de API
 * Gateway antes de invocar la función. Si la petición llega hasta acá, el
 * token ya fue validado contra Cognito — firma, caducidad y audiencia.
 *
 * Lo que sí hay que hacer es leer QUIÉN es, y eso viene en las claims. El
 * `sub` del token es el mismo id con el que el proveedor está en DynamoDB,
 * así que no hay traducción de por medio.
 */

type Claims = { sub?: string; email?: string; name?: string };

function quienEs(evento: any): Claims {
	const claims =
		evento?.requestContext?.authorizer?.jwt?.claims ??
		evento?.requestContext?.authorizer?.claims;

	if (!claims?.sub) {
		// No debería pasar nunca: significaría que la ruta quedó sin autorizador.
		throw noAutorizado("El token no trae identidad");
	}

	return claims as Claims;
}

const router = crearRouter();

/**
 * Quién hace la petición. El `sub` lo pone el handler desde las claims del
 * token, así que aquí siempre está: si faltara, `quienEs` ya habría cortado.
 */
const quien = (p: { headers: Record<string, string | undefined> }) =>
	p.headers["x-sub"]!;

/** El perfil del proveedor que trae el token. Nunca el de otro. */
router.get("/proveedores/yo", async (p) => {
	const { Item } = await dynamo.send(
		new GetCommand({
			TableName: TABLA,
			Key: llaves.proveedor(p.headers["x-sub"]!),
		}),
	);

	if (!Item) {
		// El usuario existe en Cognito pero no en la tabla: pasa si el alta se
		// quedó a medias. Vale decirlo claro en vez de devolver un 404 mudo.
		throw noEncontrado(
			"Tu usuario existe pero no tiene perfil de proveedor. Avísale al admin.",
		);
	}

	return sinLlaves(Item);
});

/** El taller edita su propia ficha pública. */
router.patch("/proveedores/yo", async (p) => {
	const c = (p.cuerpo ?? {}) as Record<string, unknown>;

	const asigna: string[] = [];
	const nombres: Record<string, string> = {};
	const valores: Record<string, unknown> = {};

	// Lista blanca: el proveedor no puede cambiarse el id, el correo ni el
	// slug desde aquí. Sin esto, un PATCH podría reescribir su identidad.
	for (const campo of [
		"displayName",
		"bio",
		"avatarUrl",
		"bannerUrl",
		// La paquetería lo EXIGE para recoger el paquete: sin teléfono del
		// remitente rechaza el envío con un 422. No es dato decorativo.
		"whatsapp",
	] as const) {
		if (c[campo] === undefined) continue;
		asigna.push(`#${campo} = :${campo}`);
		nombres[`#${campo}`] = campo;
		valores[`:${campo}`] = c[campo];
	}

	// La dirección de recolección va aparte porque no es perfil público: es de
	// dónde sale el paquete. El CP decide el precio del envío y la dirección
	// entera se imprime en la guía, así que se valida como bloque —o está
	// completa o no está— en vez de campo por campo.
	if (c.recoleccion !== undefined) {
		asigna.push("#recoleccion = :recoleccion");
		nombres["#recoleccion"] = "recoleccion";
		valores[":recoleccion"] = leerRecoleccion(c.recoleccion);
	}

	if (asigna.length === 0) throw malaPeticion("Nada que actualizar");

	const { Attributes } = await dynamo.send(
		new UpdateCommand({
			TableName: TABLA,
			Key: llaves.proveedor(p.headers["x-sub"]!),
			UpdateExpression: `SET ${asigna.join(", ")}`,
			ExpressionAttributeNames: nombres,
			ExpressionAttributeValues: valores,
			ConditionExpression: "attribute_exists(pk)",
			ReturnValues: "ALL_NEW",
		}),
	);

	return sinLlaves(Attributes ?? {});
});

/**
 * La dirección de donde sale el paquete.
 *
 * `null` la borra: un taller puede dejar de ofrecer envío y sólo entregar en
 * mano, y sin esto no habría forma de quitarla una vez puesta.
 *
 * El CP se comprueba de verdad —cinco dígitos— porque es el único campo del
 * que depende el precio del envío: mal escrito, la cotización sale de otra
 * ciudad y el error no se ve hasta que llega la factura de la paquetería.
 *
 * La colonia es obligatoria aunque parezca prescindible: Skydropx la exige
 * (`area_level3`) y rechaza la cotización sin ella en vez de adivinarla.
 */
function leerRecoleccion(valor: unknown) {
	if (valor === null) return null;

	const d = (valor ?? {}) as Record<string, unknown>;
	const texto = (v: unknown) => String(v ?? "").trim();

	const direccion = {
		calle: texto(d.calle),
		numero: texto(d.numero),
		interior: texto(d.interior) || null,
		colonia: texto(d.colonia),
		ciudad: texto(d.ciudad),
		estado: texto(d.estado),
		cp: texto(d.cp),
		referencias: texto(d.referencias) || null,
	};

	// Uno por uno y con el nombre del campo, como en el checkout del comprador:
	// "faltan datos" obliga a adivinar cuál.
	const obligatorios: [keyof typeof direccion, string][] = [
		["calle", "la calle"],
		["numero", "el número"],
		["colonia", "la colonia"],
		["ciudad", "la ciudad"],
		["estado", "el estado"],
		["cp", "el código postal"],
	];

	for (const [campo, comoSeLlama] of obligatorios) {
		if (!direccion[campo]) {
			throw malaPeticion(`Falta ${comoSeLlama} de tu dirección de recolección`);
		}
	}

	if (!/^\d{5}$/.test(direccion.cp)) {
		throw malaPeticion("El código postal son cinco dígitos");
	}

	return direccion;
}

/* ─── El catálogo del taller ────────────────────────────────────────────── */

/** Las prendas base y las categorías, para el asistente de alta. Sólo leer. */
router.get("/proveedores/plantillas", () => catalogo.plantillas());
router.get("/proveedores/categorias", () => catalogo.categorias());

/** El permiso para subir una foto. La carpeta la decide el token, no el cuerpo. */
router.post("/proveedores/subidas/foto", (p) =>
	subidas.urlParaFoto(quien(p), p.cuerpo),
);

router.get("/proveedores/productos", (p) => productos.listar(quien(p)));
router.post("/proveedores/productos", (p) =>
	productos.crear(quien(p), p.cuerpo),
);
router.get("/proveedores/productos/:id", (p) =>
	productos.obtener(quien(p), p.params.id),
);
router.patch("/proveedores/productos/:id", (p) =>
	productos.actualizar(quien(p), p.params.id, p.cuerpo),
);
// Aparte del PATCH de arriba a propósito: mover existencias NO devuelve el
// producto a revisión. Ver el comentario de `moverExistencias`.
router.patch("/proveedores/productos/:id/existencias", (p) =>
	productos.moverExistencias(quien(p), p.params.id, p.cuerpo),
);
// Borra el borrador y archiva todo lo demás; la respuesta dice cuál de las dos
// pasó. Ver el comentario de `borrar`.
router.delete("/proveedores/productos/:id", (p) =>
	productos.borrar(quien(p), p.params.id),
);

/* Los pedidos los escribe el cliente por la ruta pública; el taller sólo ve
   los suyos y los mueve de estado. */
router.get("/proveedores/pedidos", (p) => pedidos.listar(quien(p)));
router.get("/proveedores/pedidos/:id", (p) =>
	pedidos.obtener(quien(p), p.params.id),
);
router.post("/proveedores/pedidos/:id/guia", (p) =>
	guias.comprar(quien(p), p.params.id, p.cuerpo),
);
// La etiqueta no esta lista al comprar: el panel consulta aqui hasta que sale.
router.get("/proveedores/pedidos/:id/guia", (p) =>
	guias.refrescar(quien(p), p.params.id),
);
router.patch("/proveedores/pedidos/:id/estado", (p) =>
	pedidos.cambiarEstado(quien(p), p.params.id, p.cuerpo),
);

export async function handler(evento: any) {
	const metodo: string = evento?.requestContext?.http?.method ?? "GET";
	const ruta: string = evento?.requestContext?.http?.path ?? "/";

	if (metodo === "OPTIONS") return json(204, null);

	try {
		const claims = quienEs(evento);

		const headers: Record<string, string | undefined> = Object.fromEntries(
			Object.entries(evento?.headers ?? {}).map(([k, v]) => [
				k.toLowerCase(),
				v as string,
			]),
		);

		// La identidad viaja por aquí para que los handlers no tengan que
		// conocer la forma del evento de API Gateway.
		headers["x-sub"] = claims.sub;
		headers["x-email"] = claims.email;

		const cuerpoCrudo = evento?.isBase64Encoded
			? Buffer.from(evento.body ?? "", "base64").toString("utf8")
			: evento?.body;

		return await router.resolver({
			metodo,
			ruta,
			query: evento?.queryStringParameters ?? {},
			cuerpo: cuerpoCrudo ? JSON.parse(cuerpoCrudo) : undefined,
			headers,
		});
	} catch (error) {
		return respuestaDeError(error);
	}
}
