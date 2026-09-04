import { randomBytes, randomUUID } from "node:crypto";
import {
	DeleteCommand,
	GetCommand,
	QueryCommand,
	TransactWriteCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import {
	consultarTodo,
	dynamo,
	type Estado,
	esConflicto,
	llaves,
	sinLlaves,
	TABLA,
} from "../lib/dynamo.js";
import { conflicto, malaPeticion, noEncontrado } from "../lib/http.js";

/**
 * Los productos de un taller.
 *
 * El vocabulario de los campos se queda en inglés (`name`, `printSides`,
 * `pricing`…) porque es el que ya habla el asistente de alta del front. Lo
 * que agregamos nosotros va en español (`estado`, `proveedorId`,
 * `notaRevision`); traducir el payload a medias sería peor que la mezcla.
 */

/** Lo que el taller puede guardar. Todo lo que no esté aquí se ignora. */
const CAMPOS = [
	"name",
	"internalName",
	"sku",
	"description",
	"categoryIds",
	"templateId",
	"isCustomizable",
	"images",
	"printSides",
	"templateSides",
	"customizationRules",
	"sizes",
	"colors",
	"pricing",
	"production",
	/* ─── Existencias ───────────────────────────────────────────────────────
	   Todo producto lleva cuenta. El que compra el blanco por trabajo también:
	   sus existencias son cero y `faltantes` es su lista de compras. Lo que ese
	   taller no tiene son días extra, y para eso está `diasExtraSinStock`. */
	"existencias",
	"minimoAlerta",
	"diasExtraSinStock",
	/* ─── Envío ─────────────────────────────────────────────────────────────
	   Lo que hace falta para cotizar con la paquetería. El peso va POR TALLA
	   y no por variante: el color no cambia lo que pesa una prenda, la talla
	   sí. Por variante serían sesenta casillas para obtener el mismo dato. */
	"pesoPorTalla",
	"caja",
	/* ─── La prenda de verdad ───────────────────────────────────────────────
	   Fotos reales con el cuadro donde cae lo impreso, para poder enseñar el
	   diseño sobre la prenda y no sobre el mockup. Ver `validarFotosReales`. */
	"fotosReales",
] as const;

type Cuerpo = Record<string, unknown>;

export async function listar(proveedorId: string) {
	const items = await consultarTodo({
		TableName: TABLA,
		IndexName: "gsi1",
		KeyConditionExpression: "gsi1pk = :pk",
		ExpressionAttributeValues: {
			":pk": llaves.productoDeProveedor(proveedorId, "", "").gsi1pk,
		},
		// Del más nuevo al más viejo: la fecha va en la llave de orden.
		ScanIndexForward: false,
	});

	return items.map(sinLlaves);
}

export async function obtener(proveedorId: string, id: string) {
	return sinLlaves(await suyoOFalla(proveedorId, id));
}

export async function crear(proveedorId: string, cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;
	const datos = validar(c);

	const id = randomUUID();
	const ahora = new Date().toISOString();

	// El taller decide si lo manda a revisar o lo deja a medias; lo que no
	// puede es publicarlo. `activo` sólo lo pone el admin.
	const estado: Estado = c.enviar === true ? "en_revision" : "borrador";

	const item = {
		...llaves.producto(id),
		...llaves.productoDeProveedor(proveedorId, id, ahora),
		...llaves.productoPorEstado(estado, ahora),
		id,
		...datos,
		slug: "", // lo pone escribirConSlug, que es quien sabe cuál quedó libre
		estado,
		notaRevision: null,
		proveedorId,
		createdAt: ahora,
		updatedAt: ahora,
	};

	const slug = await escribirConSlug(item, aSlug(String(datos.name)), id);

	return { id, slug, estado };
}

/**
 * Guarda los cambios del taller.
 *
 * Un producto ya aprobado vuelve a `en_revision` en cuanto se toca: si no,
 * bastaría con publicar algo inocuo, esperar el visto bueno y cambiarle el
 * contenido después. La aprobación es del producto, no del momento.
 *
 * El slug NO se recalcula aunque cambie el nombre. Es la URL pública: si se
 * mueve, los enlaces que ya circulan dejan de existir.
 */
export async function actualizar(
	proveedorId: string,
	id: string,
	cuerpo: unknown,
) {
	const previo = await suyoOFalla(proveedorId, id);
	const c = (cuerpo ?? {}) as Cuerpo;

	const datos = validar({ ...previo, ...c });
	const ahora = new Date().toISOString();

	const estado: Estado =
		previo.estado === "activo" || c.enviar === true
			? "en_revision"
			: (previo.estado as Estado);

	const asigna: string[] = ["#updatedAt = :updatedAt", "#estado = :estado"];
	const nombres: Record<string, string> = {
		"#updatedAt": "updatedAt",
		"#estado": "estado",
	};
	const valores: Record<string, unknown> = {
		":updatedAt": ahora,
		":estado": estado,
	};

	for (const campo of CAMPOS) {
		if (datos[campo] === undefined) continue;
		asigna.push(`#${campo} = :${campo}`);
		nombres[`#${campo}`] = campo;
		valores[`:${campo}`] = datos[campo];
	}

	// El índice de estados vive en el ítem: si no se reescribe, la bandeja del
	// admin sigue enseñando el producto en el estado viejo.
	const indice = llaves.productoPorEstado(estado, ahora);
	asigna.push("gsi2pk = :gsi2pk", "gsi2sk = :gsi2sk");
	valores[":gsi2pk"] = indice.gsi2pk;
	valores[":gsi2sk"] = indice.gsi2sk;

	const { Attributes } = await dynamo.send(
		new UpdateCommand({
			TableName: TABLA,
			Key: llaves.producto(id),
			UpdateExpression: `SET ${asigna.join(", ")}`,
			ExpressionAttributeNames: nombres,
			ExpressionAttributeValues: valores,
			ConditionExpression: "attribute_exists(pk)",
			ReturnValues: "ALL_NEW",
		}),
	);

	return sinLlaves(Attributes ?? {});
}

/**
 * Quitar un producto. Son DOS cosas distintas según dónde esté.
 *
 * UN BORRADOR SE BORRA DE VERDAD. Nunca estuvo en el catálogo, así que no
 * puede haber un pedido, un carrito, un favorito ni una plantilla apuntándole
 * —lo público filtra por `activo` y el checkout lo vuelve a comprobar antes de
 * cobrar—. Y no se llega a `borrador` de vuelta: `actualizar` conserva el
 * estado previo o manda a revisión, y el admin sólo pone `activo`,
 * `rechazado` o `archivado`. O sea que "está en borrador" es exactamente
 * "nunca se publicó", y por eso alcanza para decidir sin ir a buscar pedidos.
 *
 * TODO LO DEMÁS SE ARCHIVA. Sale del catálogo igual y desaparece de la lista
 * del taller, pero la fila se queda. El pedido guarda el nombre y la foto de
 * cuando se hizo, así que el histórico no depende de esto; lo que sí lee el
 * producto de hoy es "volver a pedir", para poder decir CUÁL de las líneas se
 * cayó. Sin la fila, esa pantalla pierde el nombre y enseña un hueco.
 *
 * LAS FOTOS NO SE TOCAN. Viven en `medios/productos/<taller>/` y las referencia
 * el histórico de pedidos: un objeto huérfano cuesta céntimos, y una miniatura
 * rota en un pedido de hace tres meses no se puede deshacer.
 */
export async function borrar(proveedorId: string, id: string) {
	const previo = await suyoOFalla(proveedorId, id);

	if (previo.estado !== "borrador") {
		return archivar(id);
	}

	await dynamo.send(
		new DeleteCommand({
			TableName: TABLA,
			Key: llaves.producto(id),
			ConditionExpression: "attribute_exists(pk)",
		}),
	);

	/* El candado del slug se suelta DESPUÉS y por separado, no en una
	   transacción con el borrado de arriba. Los dos fallos posibles no cuestan
	   lo mismo: un candado que sobra sólo hace que `escribirConSlug` reintente
	   con sufijo la próxima vez que alguien use ese nombre —nadie se entera—,
	   mientras que meterlos juntos significa que un candado raro deja al taller
	   sin poder borrar su propio borrador. */
	const slug = String(previo.slug ?? "");
	if (slug) {
		try {
			await dynamo.send(
				new DeleteCommand({
					TableName: TABLA,
					Key: llaves.slugDeProducto(slug),
					// Sólo si el candado es de ESTE producto. Sin la condición, un
					// slug reaprovechado por otro se quedaría sin defensa.
					ConditionExpression: "productId = :id",
					ExpressionAttributeValues: { ":id": id },
				}),
			);
		} catch (error) {
			if (!esConflicto(error)) throw error;
		}
	}

	return { id, estado: "borrado" as const };
}

/**
 * Fuera del catálogo, pero la fila se queda.
 *
 * El índice de estados vive en el ítem: si no se reescribe aquí, la bandeja
 * del admin sigue enseñando el producto donde estaba. Es la misma razón por la
 * que `actualizar` lo reescribe, y por la que las dos se tienen que mover
 * juntas.
 */
async function archivar(id: string) {
	const ahora = new Date().toISOString();
	const indice = llaves.productoPorEstado("archivado", ahora);

	await dynamo.send(
		new UpdateCommand({
			TableName: TABLA,
			Key: llaves.producto(id),
			UpdateExpression:
				"SET #estado = :estado, #updatedAt = :ahora, gsi2pk = :gsi2pk, gsi2sk = :gsi2sk",
			ExpressionAttributeNames: {
				"#estado": "estado",
				"#updatedAt": "updatedAt",
			},
			ExpressionAttributeValues: {
				":estado": "archivado" satisfies Estado,
				":ahora": ahora,
				":gsi2pk": indice.gsi2pk,
				":gsi2sk": indice.gsi2sk,
			},
			ConditionExpression: "attribute_exists(pk)",
		}),
	);

	return { id, estado: "archivado" as const };
}

/* ─── Lo que sostiene todo lo de arriba ─────────────────────────────────── */

/**
 * Trae el producto sólo si es de quien lo pide.
 *
 * Responde 404 y no 403 a propósito: un 403 le confirmaría a un taller que
 * cierto id existe y es de otro.
 */
/**
 * Mueve las existencias de UNA variante. Nada más.
 *
 * Endpoint aparte de `actualizar` por dos razones, y las dos importan:
 *
 * 1. `actualizar` devuelve a `en_revision` cualquier producto activo. Es
 *    correcto para el contenido —si no, se publica algo inocuo, se espera el
 *    visto bueno y luego se cambia—, pero un blanco más en la bodega no es
 *    contenido: nadie tiene que aprobar cuántas playeras negras hay. Pasando
 *    el inventario por ahí, el taller se despublica al corregir su conteo.
 *
 * 2. El delta lo aplica DynamoDB, no el navegador. Si el cliente leyera,
 *    sumara y reescribiera el mapa entero, un pedido que descuente en ese
 *    hueco se pierde: el mapa que llega pisa el descuento. Aquí la suma es
 *    atómica sobre la hoja, así que el pedido y el ajuste se respetan pase lo
 *    que pase con el orden.
 *
 * `corregir` sí es una escritura absoluta, y ahí la carrera es inevitable:
 * es lo que significa "cuéntalos otra vez, hay 14". El último que cuenta
 * manda, que es justo lo que espera quien acaba de contar.
 */
export async function moverExistencias(
	proveedorId: string,
	id: string,
	cuerpo: unknown,
) {
	const previo = await suyoOFalla(proveedorId, id);
	const c = (cuerpo ?? {}) as Cuerpo;

	const clave = String(c.clave ?? "").trim();
	if (!clave) throw malaPeticion("Falta la variante");

	// Sólo variantes que existen hoy. Sin esto, un color borrado ayer podría
	// resucitar como entrada suelta del mapa que nadie ve ni vuelve a tocar.
	if (!(clave in ((previo.existencias ?? {}) as Record<string, unknown>))) {
		throw noEncontrado(`La variante "${clave}" no está en este producto`);
	}

	const operacion = String(c.operacion ?? "");
	if (!["agregar", "quitar", "corregir"].includes(operacion)) {
		throw malaPeticion("La operación tiene que ser agregar, quitar o corregir");
	}

	const cantidad = Math.trunc(Number(c.cantidad));
	if (!Number.isFinite(cantidad)) {
		throw malaPeticion("La cantidad no es un número");
	}
	// Agregar y quitar llevan el signo en la operación: un "agregar -5" sería
	// un "quitar 5" disfrazado, y el toast diría lo contrario de lo que pasó.
	if (operacion !== "corregir" && cantidad <= 0) {
		throw malaPeticion("La cantidad tiene que ser mayor que cero");
	}

	const absoluta = operacion === "corregir";

	const expresion = absoluta
		? "SET existencias.#v = :n, #updatedAt = :updatedAt"
		: "SET existencias.#v = if_not_exists(existencias.#v, :cero) + :n, #updatedAt = :updatedAt";

	// `:cero` sólo se declara si la expresión lo usa: DynamoDB rechaza con un
	// 400 cualquier valor declarado que no aparezca, y desde fuera eso se ve
	// como un 500 sin pista.
	const valores: Record<string, unknown> = {
		":n": operacion === "quitar" ? -cantidad : cantidad,
		":updatedAt": new Date().toISOString(),
	};
	if (!absoluta) valores[":cero"] = 0;

	const { Attributes } = await dynamo.send(
		new UpdateCommand({
			TableName: TABLA,
			Key: llaves.producto(id),
			UpdateExpression: expresion,
			ExpressionAttributeNames: { "#v": clave, "#updatedAt": "updatedAt" },
			ExpressionAttributeValues: valores,
			// El mapa tiene que existir: escribir dentro de uno que no está
			// revienta con ValidationException.
			ConditionExpression: "attribute_exists(existencias)",
			ReturnValues: "ALL_NEW",
		}),
	);

	// Se devuelve el producto entero para que la pantalla repinte con lo que
	// quedó de verdad, no con lo que el navegador creía que iba a quedar.
	return sinLlaves(Attributes ?? {});
}

async function suyoOFalla(proveedorId: string, id: string) {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.producto(id) }),
	);

	if (!Item || Item.proveedorId !== proveedorId) {
		throw noEncontrado("Ese producto no existe o no es tuyo");
	}

	return Item;
}

/**
 * Escribe el producto y su candado de slug en la misma transacción.
 *
 * Dos talleres pueden llamarle igual a su playera negra, y rechazar el alta
 * por eso sería absurdo: si el slug está tomado, se reintenta con un sufijo
 * corto. Sólo si también choca —que ya es mala suerte— se rinde.
 */
async function escribirConSlug(
	item: Record<string, unknown>,
	base: string,
	id: string,
) {
	const candidatos = [
		base,
		`${base}-${randomBytes(2).toString("hex")}`,
		`${base}-${randomBytes(3).toString("hex")}`,
	];

	for (const slug of candidatos) {
		try {
			await dynamo.send(
				new TransactWriteCommand({
					TransactItems: [
						{
							Put: {
								TableName: TABLA,
								Item: { ...item, slug },
								ConditionExpression: "attribute_not_exists(pk)",
							},
						},
						{
							Put: {
								TableName: TABLA,
								Item: { ...llaves.slugDeProducto(slug), productId: id },
								ConditionExpression: "attribute_not_exists(pk)",
							},
						},
					],
				}),
			);

			return slug;
		} catch (error) {
			if (!esConflicto(error)) throw error;
		}
	}

	throw conflicto("No pudimos generarle una dirección única a este producto");
}

/**
 * Valida lo que rompe el producto, no lo que lo deja incompleto.
 *
 * El asistente del front ya valida por pasos, pero eso es cortesía para el
 * taller, no seguridad: aquí llega lo que llegue.
 */
function validar(c: Cuerpo) {
	const datos: Cuerpo = {};
	for (const campo of CAMPOS) {
		if (c[campo] !== undefined) datos[campo] = c[campo];
	}

	const name = String(datos.name ?? "").trim();
	if (!name) throw malaPeticion("Falta el nombre del producto");
	datos.name = name;

	if (!String(datos.templateId ?? "").trim()) {
		throw malaPeticion(
			"Falta la plantilla: de ahí salen los lados imprimibles",
		);
	}

	const precio = Number((datos.pricing as Cuerpo | undefined)?.basePrice ?? 0);
	if (!(precio > 0))
		throw malaPeticion("El precio base tiene que ser mayor a 0");

	// Sin lados no hay nada que personalizar, y el editor se queda sin lienzo.
	if (!Array.isArray(datos.printSides) || datos.printSides.length === 0) {
		throw malaPeticion("Marca al menos un lado que puedas imprimir");
	}

	validarExistencias(datos);
	validarEnvio(datos);
	validarFotosReales(datos);

	return datos;
}

/**
 * Las fotos de la prenda de verdad, con el cuadro donde cae lo impreso.
 *
 * PARA QUÉ. Hasta ahora el diseño se veía sobre el mockup —un dibujo plano de
 * la prenda— y eso no contesta la pregunta con la que alguien paga: cómo va a
 * quedar. Con una foto real y el cuadro marcado, el arte se puede proyectar
 * encima y verse sobre la tela.
 *
 * UNA FOTO POR LADO **Y POR COLOR**, y no una sola tintable. Al mockup se le
 * puede cambiar el color porque es una prenda clara sobre fondo blanco que se
 * recorta y se multiplica; una foto con modelo, con contexto o de una prenda
 * ya oscura no admite ese tratamiento —teñiría también la cara—. Así que la
 * llave es el par, y un color sin foto sencillamente no tiene vista realista.
 *
 * LAS ESQUINAS VAN EN FRACCIONES DE 0 A 1, nunca en píxeles. La misma foto se
 * pinta a 700 px en el editor, a 120 en una miniatura y a lo que mida la
 * pantalla del teléfono; guardar píxeles ataría el cuadro a la resolución con
 * la que se marcó y bastaría recomprimir la foto para descuadrarlo.
 *
 * SON CUATRO Y EN ORDEN —arriba-izquierda, arriba-derecha, abajo-derecha,
 * abajo-izquierda—, no un rectángulo: sobre una prenda de verdad la tela cae y
 * el torso va en ángulo, y un rectángulo recto se lee como calcomanía pegada.
 * Cuatro puntos permiten la perspectiva y marcarlos cuesta lo mismo.
 *
 * LA RUTA TIENE QUE SER NUESTRA (`/medios/…`). Es la misma regla que los
 * mockups: la composición se hace en un lienzo del navegador, y una imagen de
 * otro origen lo contamina —`getImageData` revienta y la vista se apaga sin
 * decir nada—. Además evita que un cuerpo manipulado cuelgue una imagen ajena
 * dentro de la ficha pública.
 */
function validarFotosReales(datos: Cuerpo) {
	if (datos.fotosReales === undefined) return;

	const crudas = datos.fotosReales;
	if (!Array.isArray(crudas)) {
		throw malaPeticion("Las fotos de la prenda tienen que venir en una lista");
	}

	// Lados por colores: un catálogo razonable no pasa de aquí ni de lejos, y
	// el tope evita que un cuerpo enorme se guarde entero en el ítem.
	if (crudas.length > 60) {
		throw malaPeticion("Demasiadas fotos de prenda en un solo producto");
	}

	const vistas = new Set<string>();
	const limpias = crudas.map((cruda) => {
		const f = (cruda ?? {}) as Cuerpo;

		const lado = String(f.lado ?? "").trim();
		const color = String(f.color ?? "").trim();
		const url = String(f.url ?? "").trim();

		if (!lado) throw malaPeticion("Una foto de prenda no dice de qué lado es");
		if (!color) {
			throw malaPeticion(`La foto del lado "${lado}" no dice de qué color es`);
		}
		if (!url.startsWith("/medios/")) {
			throw malaPeticion(
				`La foto de "${color}" no está en nuestro almacén: sólo se admiten rutas /medios/`,
			);
		}

		const llave = `${lado}|${color}`;
		if (vistas.has(llave)) {
			throw malaPeticion(`Hay dos fotos para "${color}" en el mismo lado`);
		}
		vistas.add(llave);

		/* DOS GEOMETRÍAS, UNA POR FOTO, y nunca las dos.
		
		   Cuatro esquinas definen un PLANO y sirven para una playera; una taza
		   es un cilindro y sólo enseña 180° de su envoltura, comprimidos hacia
		   los bordes. No son variantes de lo mismo, y aceptar las dos a la vez
		   dejaría que la foto dijera una cosa y el preview pintara la otra.
		
		   Cuál toca lo decide la FORMA de la plantilla, y eso lo sabe el alta.
		   Aquí sólo se comprueba que venga exactamente una. */
		const banda = f.banda as Cuerpo | undefined;
		const esquinas = Array.isArray(f.esquinas) ? f.esquinas : [];

		if (banda) {
			if (esquinas.length > 0) {
				throw malaPeticion(
					`La foto de "${color}" trae banda y esquinas a la vez: es una cosa o la otra`,
				);
			}

			return { lado, color, url, banda: validarBanda(banda, color) };
		}

		if (esquinas.length !== 4) {
			throw malaPeticion(
				`El cuadro de impresión de "${color}" tiene que llevar cuatro esquinas`,
			);
		}

		return {
			lado,
			color,
			url,
			esquinas: esquinas.map((punto, i) => {
				const p = (punto ?? {}) as Cuerpo;
				const x = Number(p.x);
				const y = Number(p.y);

				// Fuera del [0,1] el cuadro se sale de la foto: o se marcó sobre otra
				// imagen, o llegó en píxeles. Las dos son un cuadro que no sirve.
				if (!Number.isFinite(x) || !Number.isFinite(y)) {
					throw malaPeticion(
						`La esquina ${i + 1} del cuadro de "${color}" no es un punto`,
					);
				}
				if (x < 0 || x > 1 || y < 0 || y > 1) {
					throw malaPeticion(
						`La esquina ${i + 1} del cuadro de "${color}" cae fuera de la foto`,
					);
				}

				return { x, y };
			}),
		};
	});

	datos.fotosReales = limpias;
}

/**
 * La banda visible de un cilindro.
 *
 * TODO EN FRACCIONES DE 0 A 1, igual que las esquinas y por lo mismo: la misma
 * foto se pinta a 700 px en el editor y a 120 en una miniatura, así que en
 * píxeles bastaría recomprimirla para descuadrar el estampado. Fuera del rango
 * también es como se detecta que llegaron en píxeles.
 *
 * `bombeo` es la excepción y se admite negativo: la foto puede estar tomada
 * desde abajo, y entonces el filo se comba al revés. Se acota igual para que un
 * valor absurdo no mande la banda fuera de la imagen.
 *
 * SE EXIGE QUE LA BANDA TENGA ÁREA. Con `izquierda >= derecha` o
 * `arriba >= abajo` el rasterizador devuelve la foto sola sin decir nada, y el
 * taller creería que subió mal la imagen.
 */
function validarBanda(b: Cuerpo, color: string) {
	const fraccion = (nombre: string, min = 0, max = 1) => {
		const v = Number(b[nombre]);

		if (!Number.isFinite(v)) {
			throw malaPeticion(`A la banda de "${color}" le falta ${nombre}`);
		}
		if (v < min || v > max) {
			throw malaPeticion(
				`El valor de ${nombre} en la banda de "${color}" cae fuera de la foto`,
			);
		}

		return v;
	};

	const izquierda = fraccion("izquierda");
	const derecha = fraccion("derecha");
	const arriba = fraccion("arriba");
	const abajo = fraccion("abajo");

	if (!(derecha > izquierda)) {
		throw malaPeticion(
			`La banda de "${color}" no tiene ancho: el borde derecho va después del izquierdo`,
		);
	}
	if (!(abajo > arriba)) {
		throw malaPeticion(
			`La banda de "${color}" no tiene alto: el borde de abajo va después del de arriba`,
		);
	}

	return {
		izquierda,
		derecha,
		arriba,
		abajo,
		bombeo: fraccion("bombeo", -0.5, 0.5),
		centro: fraccion("centro"),
	};
}

/**
 * Lo que hace falta para cotizar el envío.
 *
 * EL PESO VA POR TALLA, NO POR VARIANTE. El color no cambia lo que pesa una
 * prenda; la talla sí. Por variante serían diez colores × seis tallas para
 * obtener seis números distintos, y lo que se consigue pidiendo sesenta
 * casillas es que se rellenen a ojo.
 *
 * EN GRAMOS, enteros. Una playera pesa 150 g, no 0.15 kg: pedirlo en kilos
 * invita a decimales mal puestos, y un 1.5 donde iba 0.15 multiplica por diez
 * el costo del envío sin que nadie lo note hasta la factura. A Skydropx se le
 * manda en kilos, que es lo que espera, pero la conversión la hacemos
 * nosotros.
 *
 * LA CAJA ES LA DE UNA PIEZA. Sirve para cotizar antes de que el paquete
 * exista; el taller confirma las medidas reales al terminar, y ésas son las
 * que se usan para comprar la guía.
 */
function validarEnvio(datos: Cuerpo) {
	if (datos.pesoPorTalla !== undefined) {
		const crudo = (datos.pesoPorTalla ?? {}) as Record<string, unknown>;
		const limpio: Record<string, number> = {};

		for (const [talla, valor] of Object.entries(crudo)) {
			const g = Math.trunc(Number(valor));
			if (!Number.isFinite(g) || g <= 0) {
				throw malaPeticion(`El peso de la talla "${talla}" no es válido`);
			}
			// Treinta kilos es más que cualquier prenda y menos que el límite de
			// las paqueterías: quien escriba 15000 quiso decir 1500.
			if (g > 30000) {
				throw malaPeticion(
					`El peso de la talla "${talla}" parece equivocado: ${g} gramos`,
				);
			}
			limpio[talla] = g;
		}

		datos.pesoPorTalla = limpio;
	}

	if (datos.caja !== undefined && datos.caja !== null) {
		const c = (datos.caja ?? {}) as Record<string, unknown>;
		const medidas: Record<string, number> = {};

		for (const lado of ["largo", "ancho", "alto"] as const) {
			const cm = Number(c[lado]);
			if (!Number.isFinite(cm) || cm <= 0) {
				throw malaPeticion(`Falta el ${lado} de tu caja, en centímetros`);
			}
			if (cm > 200) {
				throw malaPeticion(`El ${lado} de la caja parece equivocado: ${cm} cm`);
			}
			medidas[lado] = cm;
		}

		datos.caja = medidas;
	}
}

/**
 * Las existencias. Todo producto las lleva — no hay interruptor.
 *
 * Antes era opcional, con la idea de que el taller que compra el blanco por
 * trabajo "no tiene nada que contar". Es falso: sí cuenta, siempre es cero, y
 * entonces `faltantes` le sale como lista de compras. Lo que ese taller no
 * tiene son DÍAS EXTRA, porque sus días de producción ya incluyen ir a
 * comprar. Por eso lo configurable es `diasExtraSinStock` —que arranca en 0—
 * y no el conteo: al revés se le cotizaría al cliente la compra dos veces.
 *
 * `existencias` SIEMPRE queda escrito, aunque sea vacío. DynamoDB no puede
 * escribir dentro de un mapa que no existe: un `SET existencias.#v = ...`
 * sobre un producto sin ese atributo revienta con `ValidationException`, y eso
 * pasaría en mitad de un pedido, no aquí.
 */
function validarExistencias(datos: Cuerpo) {
	const crudas = (datos.existencias ?? {}) as Record<string, unknown>;
	const limpias: Record<string, number> = {};

	for (const [clave, valor] of Object.entries(crudas)) {
		const n = Math.trunc(Number(valor));
		// Se admite negativo: es lo que el taller debe comprar para cumplir lo
		// que ya vendió. Lo que no se admite es basura.
		if (!Number.isFinite(n)) {
			throw malaPeticion(`La cantidad de "${clave}" no es un número`);
		}
		limpias[clave] = n;
	}

	datos.existencias = limpias;

	// El aviso de existencias bajas sí sigue siendo opcional, y 0 lo apaga.
	// Con el conteo universal hace falta: un producto que siempre está en cero
	// —el del taller que compra por trabajo— dispararía la alerta en cada
	// carga del panel, y una alerta que salta siempre no es una alerta.
	const minimo = Math.trunc(Number(datos.minimoAlerta ?? 0));
	if (!Number.isFinite(minimo) || minimo < 0) {
		throw malaPeticion("El mínimo para avisarte no puede ser negativo");
	}
	datos.minimoAlerta = minimo;

	const extra = Math.trunc(Number(datos.diasExtraSinStock ?? 0));
	if (!Number.isFinite(extra) || extra < 0) {
		throw malaPeticion(
			"Los días extra sin existencias no pueden ser negativos",
		);
	}
	datos.diasExtraSinStock = extra;
}

/**
 * El rango de diacríticos va con secuencias de escape y NUNCA con los
 * caracteres dentro: escritos ahí, la línea deja de ser ASCII y el slug pasa a
 * depender de cómo se guarde el archivo. Si se estropea, sale mal y nadie se
 * entera. Cuidado al editarlo: hay herramientas que convierten la secuencia de
 * escape en el carácter sin avisar. Si dudas, copia la forma de
 * `apps/web/lib/texto.ts`, que lo arma en tiempo de ejecución justo por esto.
 */
const DIACRITICOS = /[\u0300-\u036f]/g;

function aSlug(s: string) {
	const limpio = s
		.normalize("NFD")
		.replace(DIACRITICOS, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);

	// Un nombre entero de emojis dejaría el slug vacío y el candado sería `SLUG#`.
	return limpio || "producto";
}
