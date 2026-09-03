import { GetCommand } from "@aws-sdk/lib-dynamodb";

import { dynamo, llaves, TABLA } from "../lib/dynamo.js";
import { malaPeticion, muyRapido, noEncontrado } from "../lib/http.js";
import {
	consultarCotizacion,
	cotizar,
	DemasiadasPeticiones,
	type Direccion,
} from "../lib/skydropx.js";

/**
 * Cotizar el envío de un pedido que todavía no existe.
 *
 * EL PAQUETE LO ARMA EL SERVIDOR, SIEMPRE.
 *
 * De aquí sólo se acepta qué se pide y a dónde va. El peso, las medidas y el
 * origen salen de la base. Si el navegador pudiera mandar el peso, mandaría
 * el precio del envío — es exactamente el mismo motivo por el que el precio
 * del producto tampoco viene del cuerpo.
 *
 * COTIZAR ES ASÍNCRONO, Y POR ESO SON DOS FUNCIONES.
 *
 * `crear` arranca la cotización y devuelve un id; `consultar` la lee. Se
 * probó contra el sandbox: la cotización tarda unos cinco segundos en
 * completarse y las tarifas van llegando de a poco. Tener una Lambda
 * esperando eso en cada checkout se paga en tiempo de función y roza el
 * máximo, así que espera el navegador, que además puede ir pintando.
 */

type Cuerpo = Record<string, any>;

/** Lo que el taller no puede enviar todavía. El checkout ofrece recoger. */
const SIN_ENVIO = "Este taller todavía no tiene envíos configurados";

export async function crear(cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;

	const lineas = Array.isArray(c.lineas) ? c.lineas : [];
	if (lineas.length === 0) throw malaPeticion("No dijiste qué vas a pedir");

	const destino = leerDestino(c.destino);

	const productos = await Promise.all(
		lineas.map((l: Cuerpo) => leerProducto(String(l.productoId ?? ""))),
	);

	// Misma regla que al pedir: un pedido sale de un solo taller, así que el
	// envío también. Con dos orígenes no hay una cotización, hay dos.
	const talleres = new Set(productos.map((p) => String(p.proveedorId)));
	if (talleres.size > 1) {
		throw malaPeticion("Un envío sale de un solo taller");
	}

	const origen = await leerOrigen([...talleres][0]);
	const paquete = armarPaquete(lineas, productos);

	try {
		return { id: await cotizar(origen, destino, paquete) };
	} catch (error) {
		// 429 y no 500: pasarse del límite de Skydropx no es un fallo del
		// pedido ni del dato. El navegador puede volver a intentar, y con un
		// 500 se rendiría creyendo que algo se rompió.
		if (error instanceof DemasiadasPeticiones) {
			throw muyRapido(
				"Estamos cotizando muchos envíos. Inténtalo en un momento.",
			);
		}
		throw error;
	}
}

/**
 * Cotiza una COMPRA: una por taller.
 *
 * Cada taller manda desde SU dirección, así que no hay un envío sino uno por
 * parte, con su precio y su plazo. El checkout los enseña por separado porque
 * es lo que de verdad va a pasar: llegarán en paquetes distintos.
 *
 * POR QUÉ SE ESPACIAN LAS LLAMADAS. Skydropx admite **2 peticiones por
 * segundo** y ya tumbó el checkout una vez (siete clics en "+1"). Lanzar tres
 * cotizaciones en paralelo lo repetiría, y el espaciado se hace AQUÍ y no en
 * el navegador: si dependiera del cliente, bastaría con que alguien abriera
 * dos pestañas.
 *
 * UN TALLER QUE NO PUEDE NO TUMBA LA COMPRA. Si le falta la dirección de
 * recolección, esa parte vuelve con su `error` y las demás con sus tarifas.
 * El cliente decide: quitarla o recogerla con el taller. Fallar entero por uno
 * mal configurado sería perder la venta completa.
 */
export async function crearPorTaller(cuerpo: unknown) {
	const c = (cuerpo ?? {}) as Cuerpo;

	const lineas = Array.isArray(c.lineas) ? c.lineas : [];
	if (lineas.length === 0) throw malaPeticion("No dijiste qué vas a pedir");

	const destino = leerDestino(c.destino);

	const productos = await Promise.all(
		lineas.map((l: Cuerpo) => leerProducto(String(l.productoId ?? ""))),
	);

	const grupos = new Map<string, number[]>();
	productos.forEach((producto, i) => {
		const taller = String(producto.proveedorId);
		grupos.set(taller, [...(grupos.get(taller) ?? []), i]);
	});

	const partes: {
		proveedorId: string;
		taller: string | null;
		cotizacionId?: string;
		error?: string;
	}[] = [];

	let primera = true;

	for (const [proveedorId, indices] of grupos) {
		// 600 ms entre llamadas: por debajo de las 2 por segundo que admite
		// Skydropx, con margen para lo que ya esté cotizando otra pestaña.
		if (!primera) await new Promise((r) => setTimeout(r, 600));
		primera = false;

		const taller = await nombreDelTaller(proveedorId);

		try {
			const origen = await leerOrigen(proveedorId);
			const paquete = armarPaquete(
				indices.map((i) => lineas[i]),
				indices.map((i) => productos[i]),
			);

			partes.push({
				proveedorId,
				taller,
				cotizacionId: await cotizar(origen, destino, paquete),
			});
		} catch (error) {
			if (error instanceof DemasiadasPeticiones) {
				throw muyRapido(
					"Estamos cotizando muchos envíos. Inténtalo en un momento.",
				);
			}

			// Lo que sabemos decir se dice; lo demás no se filtra al cliente.
			partes.push({
				proveedorId,
				taller,
				error:
					error instanceof Error && error.message === SIN_ENVIO
						? SIN_ENVIO
						: "No pudimos cotizar el envío de este taller",
			});
		}
	}

	return { partes };
}

async function nombreDelTaller(proveedorId: string): Promise<string | null> {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.proveedor(proveedorId) }),
	);

	return (Item?.displayName as string) ?? (Item?.name as string) ?? null;
}

/**
 * El envío que se guarda en el pedido, verificado contra Skydropx.
 *
 * NO se acepta el precio del navegador. Se recibe la cotización y qué tarifa
 * se eligió, y el precio se lee de Skydropx: si viniera del cuerpo, cualquiera
 * pediría envío gratis cambiando un número, igual que pediría la playera a un
 * peso. Es la misma regla que el precio del producto.
 *
 * Devuelve `null` cuando el pedido es para recoger.
 */
export async function envioDelPedido(valor: unknown) {
	const e = (valor ?? {}) as Cuerpo;
	const cotizacionId = String(e.cotizacionId ?? "").trim();
	const tarifaId = String(e.tarifaId ?? "").trim();

	if (!cotizacionId || !tarifaId) {
		throw malaPeticion("Falta elegir cómo se envía");
	}

	const { tarifas } = await consultarCotizacion(cotizacionId);
	const tarifa = tarifas.find((t) => t.id === tarifaId);

	// La cotización caduca del lado de Skydropx. Si ya no está, hay que volver
	// a cotizar: cobrar un precio que ya no existe es peor que pedir un clic.
	if (!tarifa) {
		throw malaPeticion(
			"Esa opción de envío ya no está disponible. Vuelve a elegirla.",
		);
	}

	return {
		cotizacionId,
		tarifaId,
		paqueteria: tarifa.paqueteria,
		servicio: tarifa.servicio,
		precio: tarifa.precio,
		diasEstimados: tarifa.dias,
	};
}

export async function consultar(id: string) {
	if (!id) throw malaPeticion("Falta la cotización");

	try {
		return await consultarCotizacion(id);
	} catch (error) {
		if (error instanceof DemasiadasPeticiones) {
			throw muyRapido(
				"Estamos cotizando muchos envíos. Inténtalo en un momento.",
			);
		}
		throw error;
	}
}

/**
 * De dónde sale el paquete.
 *
 * Sin dirección de recolección no hay envío posible, y decirlo claro importa:
 * el checkout usa este error para ofrecer recoger con el taller en vez de
 * enseñar una pantalla rota.
 */
async function leerOrigen(proveedorId: string): Promise<Direccion> {
	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.proveedor(proveedorId) }),
	);

	const r = Item?.recoleccion as Cuerpo | undefined;
	if (!r?.cp) throw malaPeticion(SIN_ENVIO);

	return {
		cp: String(r.cp),
		estado: String(r.estado ?? ""),
		ciudad: String(r.ciudad ?? ""),
		colonia: String(r.colonia ?? ""),
	};
}

function leerDestino(valor: unknown): Direccion {
	const d = (valor ?? {}) as Cuerpo;
	const texto = (v: unknown) => String(v ?? "").trim();

	const destino = {
		cp: texto(d.cp),
		estado: texto(d.estado),
		ciudad: texto(d.ciudad),
		colonia: texto(d.colonia),
	};

	// La colonia es tan obligatoria como el resto: Skydropx la exige y sin
	// ella rechaza la cotización entera en vez de adivinarla.
	for (const [campo, comoSeLlama] of [
		["cp", "el código postal"],
		["estado", "el estado"],
		["ciudad", "la ciudad"],
		["colonia", "la colonia"],
	] as const) {
		if (!destino[campo]) throw malaPeticion(`Falta ${comoSeLlama} de destino`);
	}

	if (!/^\d{5}$/.test(destino.cp)) {
		throw malaPeticion("El código postal son cinco dígitos");
	}

	return destino;
}

/**
 * El paquete que se va a cotizar.
 *
 * EL PESO ES EXACTO; LA CAJA ES UNA APROXIMACIÓN, y conviene saber cuál es
 * cuál. El peso sale de sumar lo que pesa cada talla por las piezas que se
 * piden, y eso no tiene margen de error. La caja no: se apilan las piezas a
 * lo alto y se conserva el largo y el ancho mayores, que es como se
 * acomodan unas prendas dobladas, pero la tela cede y la caja real casi
 * siempre sale más chica. Por eso el taller confirma las medidas de verdad
 * al terminar, y ésas son las que compran la guía.
 */
function armarPaquete(lineas: Cuerpo[], productos: Cuerpo[]) {
	let gramos = 0;
	let piezas = 0;
	let largo = 0;
	let ancho = 0;
	let alto = 0;

	lineas.forEach((l, i) => {
		const p = productos[i];
		const pesos = (p.pesoPorTalla ?? {}) as Record<string, number>;
		const caja = p.caja as Cuerpo | undefined;

		if (!caja?.largo) throw malaPeticion(SIN_ENVIO);

		const tallas = Array.isArray(l.tallas) ? l.tallas : [];
		if (tallas.length === 0) {
			throw malaPeticion("Una línea no dice cuántas piezas ni de qué talla");
		}

		for (const t of tallas) {
			const talla = String(t?.size ?? "");
			const cuantas = Math.trunc(Number(t?.piezas ?? 0));

			if (!Number.isFinite(cuantas) || cuantas <= 0) {
				throw malaPeticion(`La cantidad de la talla "${talla}" no es válida`);
			}

			const g = Number(pesos[talla] ?? 0);
			// Una talla sin peso no se puede cotizar, y adivinarla sería peor:
			// un envío mal cotizado lo paga alguien.
			if (!g) throw malaPeticion(SIN_ENVIO);

			gramos += g * cuantas;
			piezas += cuantas;
		}

		largo = Math.max(largo, Number(caja.largo));
		ancho = Math.max(ancho, Number(caja.ancho));
		alto += Number(caja.alto) * piezasDeLinea(l);
	});

	if (piezas > 500) {
		throw malaPeticion("Para más de 500 piezas escríbenos y lo cotizamos");
	}

	return {
		largo,
		ancho,
		alto,
		// Skydropx quiere kilos. Los gramos son nuestros porque es como piensa
		// el peso quien captura una prenda.
		peso: Math.max(0.1, Math.round((gramos / 1000) * 100) / 100),
	};
}

function piezasDeLinea(l: Cuerpo) {
	return (Array.isArray(l.tallas) ? l.tallas : []).reduce(
		(n: number, t: Cuerpo) => n + (Math.trunc(Number(t?.piezas ?? 0)) || 0),
		0,
	);
}

async function leerProducto(productoId: string) {
	if (!productoId) throw malaPeticion("Una línea no dice qué producto es");

	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.producto(productoId) }),
	);

	// Sólo lo que está en el catálogo: cotizar un borrador o algo rechazado
	// filtraría que existe.
	if (!Item || Item.estado !== "activo") {
		throw noEncontrado("Ese producto no está disponible");
	}

	return Item;
}
