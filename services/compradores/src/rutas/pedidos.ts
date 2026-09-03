import { randomUUID } from "node:crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

import {
	consultarTodo,
	dynamo,
	llaves,
	sinLlaves,
	TABLA,
	variante,
} from "../lib/dynamo.js";
import { malaPeticion, noAutorizado, noEncontrado } from "../lib/http.js";
import { copiar } from "../lib/medios.js";

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

/* ─── Repetir ───────────────────────────────────────────────────────────── */

/**
 * Lo que haría falta para volver a pedir lo mismo, comparado con hoy.
 *
 * NO CREA NADA. Es una lectura y una diferencia: el front la usa para armar el
 * carrito y enseñar lo que cambió, y el pedido se crea después por el camino
 * de siempre. Así repetir no abre una segunda forma de escribir pedidos, que
 * es donde acaban divergiendo las reglas de precio.
 *
 * POR QUÉ HAY QUE COMPARAR. La línea del pedido CONGELA precio, medidas y
 * plazo —esa es la regla de la casa— y el catálogo es de hoy. Entre un mes y
 * otro sube un precio, se archiva un producto o se acaban los blancos.
 * Copiarlo en silencio y cobrar otra cifra es como se pierde a la empresa que
 * pide cada mes.
 */
export async function repetir(quien: Identidad, id: string) {
	const pedido = await obtener(quien, id);
	const lineas = (pedido.lineas ?? []) as Record<string, any>[];

	const partes = await Promise.all(lineas.map((l) => compararLinea(l)));

	const disponibles = partes.filter((p) => p.estado !== "no_disponible");

	return {
		pedidoId: id,
		folio: pedido.folio ?? null,
		hechoEn: pedido.createdAt ?? null,
		/** Lo que costaron los productos entonces. El envío no entra: se recotiza. */
		totalAntes: lineas.reduce((n, l) => n + (Number(l.importe) || 0), 0),
		totalAhora: disponibles.reduce((n, p) => n + p.importe, 0),
		/** Cuántos talleres, para poder decir cuántos pedidos van a salir. */
		talleres: [
			...new Set(disponibles.map((p) => p.proveedorId).filter(Boolean)),
		].length,
		lineas: partes,
	};
}

/**
 * Una línea del pedido viejo contra el producto de hoy.
 *
 * `estado` es lo que el front pinta, y son cuatro casos porque cada uno se
 * resuelve distinto: `igual` sigue, `precio` avisa, `plazo` avisa, y
 * `no_disponible` OBLIGA a decidir — es el único que no puede pasar callando.
 */
async function compararLinea(l: Record<string, any>) {
	const productoId = String(l.productoId ?? "");
	const tallas = (l.tallas ?? []) as { size: string; piezas: number }[];
	const piezas = tallas.reduce((n, t) => n + (Number(t.piezas) || 0), 0);

	const comun = {
		lineaId: String(l.id ?? ""),
		productoId,
		producto: String(l.producto ?? ""),
		colorPrenda: l.colorPrenda ?? null,
		lados: (l.lados ?? []) as string[],
		tallas,
		piezas,
		diseno: l.diseno ?? null,
		miniatura: (l.arte ?? [])[0]?.colocacion ?? l.imagen ?? null,
		importeAntes: Number(l.importe) || 0,
		diasAntes: Number(l.diasPrometidos) || null,
	};

	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.producto(productoId) }),
	);

	// Un producto archivado o rechazado no se puede pedir. Se devuelve igual,
	// con su nombre, para poder decir CUÁL se cayó en vez de que desaparezca.
	if (!Item || Item.estado !== "activo") {
		return {
			...comun,
			estado: "no_disponible" as const,
			porque: "Ya no está en el catálogo",
			proveedorId: null,
			importe: 0,
			dias: null,
		};
	}

	const precios = (Item.pricing ?? {}) as Record<string, number | undefined>;
	const base = Number(precios.basePrice ?? 0);
	// Mismo cálculo que `aLinea` en services/admin: el primer lado va en el
	// precio base y cada lado extra se cobra aparte. Si los dos se separan, el
	// total que se enseña aquí no es el que se cobra al pedir.
	const porLados =
		comun.lados.length > 1
			? (comun.lados.length - 1) * Number(precios.perSidePrice ?? 0)
			: 0;

	const unitario = base + porLados;
	const importe = unitario * piezas;
	const dias = diasDeHoy(Item, comun.colorPrenda, tallas);

	const unitarioAntes = piezas > 0 ? comun.importeAntes / piezas : 0;
	const subioElPrecio = Math.round(unitario) !== Math.round(unitarioAntes);
	const cambioElPlazo = comun.diasAntes !== null && dias !== comun.diasAntes;

	return {
		...comun,
		estado: subioElPrecio
			? ("precio" as const)
			: cambioElPlazo
				? ("plazo" as const)
				: ("igual" as const),
		porque: null,
		proveedorId: String(Item.proveedorId ?? ""),
		importe,
		unitario,
		unitarioAntes: Math.round(unitarioAntes),
		dias,
	};
}

/**
 * Los días que se prometerían HOY.
 *
 * Espejo de `compromiso()` en services/admin: si no coinciden, el aviso que ve
 * el comprador aquí no es el que acaba congelado en su pedido.
 */
function diasDeHoy(
	producto: Record<string, any>,
	color: string | null,
	tallas: { size: string; piezas: number }[],
) {
	const meta = producto.production?.meta ?? {};
	const dias = Math.trunc(Number(meta.diasProduccion ?? 0)) || 0;

	const existencias = (producto.existencias ?? {}) as Record<string, number>;
	const falta = tallas.some((t) => {
		const hay = Number(existencias[variante(color, t.size)] ?? 0);
		return Number(t.piezas) > Math.max(0, hay);
	});

	const extra = Math.trunc(Number(producto.diasExtraSinStock ?? 0)) || 0;
	return falta ? dias + extra : dias;
}

/* ─── Repetir: de la comparación al carrito ─────────────────────────────── */

/**
 * Deja en el carrito las líneas elegidas de un pedido viejo.
 *
 * POR QUÉ ESTO EXISTE Y NO LO HACE EL NAVEGADOR. El arte de una línea son
 * varios MB y ya está en S3. Que el navegador lo baje para volver a subirlo
 * dobla el tráfico de algo que está a un metro de distancia, y con cinco
 * líneas es la diferencia entre un clic y un minuto mirando una barra. Aquí la
 * copia es de servidor a servidor, igual que al comprar.
 *
 * NO CREA EL PEDIDO. Devuelve artículos de carrito y ahí se acaba: el pedido
 * se sigue creando por el camino de siempre, con sus precios recalculados
 * desde la tabla. Repetir NO es una segunda forma de escribir pedidos.
 */
export async function alCarrito(quien: Identidad, id: string, cuerpo: unknown) {
	const pedidas = (cuerpo as Record<string, any>)?.lineas;
	if (!Array.isArray(pedidas) || pedidas.length === 0) {
		throw malaPeticion("Elige al menos una línea para repetir");
	}

	const quiere = new Set(pedidas.map(String));

	const { Item } = await dynamo.send(
		new GetCommand({ TableName: TABLA, Key: llaves.pedido(id) }),
	);

	if (!Item || String(Item.comprador?.email ?? "").toLowerCase() !== correoDe(quien)) {
		throw noEncontrado("No encontramos ese pedido");
	}

	const lineas = ((Item.lineas ?? []) as Record<string, any>[]).filter((l) =>
		quiere.has(String(l.id)),
	);

	if (lineas.length === 0) throw noEncontrado("Ese pedido no tiene esas líneas");

	/* Se vuelve a comparar contra el catálogo AQUÍ, aunque el front ya lo hizo
	   al enseñar la pantalla. Entre que se miró y se pulsó pudo archivarse un
	   producto, y meter en el carrito algo que ya no se puede producir sólo
	   mueve el error al final del checkout, que es el peor sitio. */
	const comparadas = await Promise.all(lineas.map((l) => compararLinea(l)));

	const articulos = [];
	const descartadas = [];

	for (const linea of comparadas) {
		if (linea.estado === "no_disponible") {
			descartadas.push({ producto: linea.producto, porque: linea.porque });
			continue;
		}

		const original = lineas.find((l) => String(l.id) === linea.lineaId);
		const arte = (original?.arte ?? []) as Record<string, any>[];

		/* Un id nuevo por artículo, no el del pedido viejo: si dos repeticiones
		   compartieran carpeta, borrar el carrito de una borraría el arte de la
		   otra, y `carritos/` caduca a los 30 días. */
		const carritoId = randomUUID();

		const lados = [];

		for (const a of arte) {
			const lado = String(a.lado ?? "");
			if (!lado) continue;

			/* El arte de producción es lo único que bloquea: sin él no hay nada
			   que imprimir. La colocación es una referencia para el taller y el
			   diseño editable sólo sirve para volver a abrirlo, así que si
			   faltan se sigue — es la misma regla que al subir desde el editor. */
			const hayArte = await copiar(
				`medios/pedidos/${id}/${linea.lineaId}-${lado}.png`,
				`carritos/${carritoId}/${lado}-arte.png`,
			);

			if (!hayArte) continue;

			await copiar(
				`medios/pedidos/${id}/${linea.lineaId}-${lado}-colocacion.png`,
				`carritos/${carritoId}/${lado}-colocacion.png`,
			);

			lados.push({
				lado,
				/* Los píxeles del archivo, no los centímetros del área. El área
				   se relee del producto al pedir —puede haber cambiado—, pero el
				   tamaño real impreso sale de cuántos píxeles tiene el arte que
				   se copió, y ése es exactamente el de entonces. */
				anchoPx: Math.trunc(Number(a.anchoPx ?? 0)),
				altoPx: Math.trunc(Number(a.altoPx ?? 0)),
				dpi: Math.trunc(Number(a.dpi ?? 0)) || 300,
			});
		}

		if (lados.length === 0) {
			descartadas.push({
				producto: linea.producto,
				porque: "Ya no conservamos los archivos de ese diseño",
			});
			continue;
		}

		await copiar(
			`medios/pedidos/${id}/${linea.lineaId}-diseno.json`,
			`carritos/${carritoId}/diseno.json`,
		);

		articulos.push({
			carritoId,
			productoId: linea.productoId,
			nombre: linea.producto,
			proveedorId: linea.proveedorId,
			colorPrenda: linea.colorPrenda,
			lados,
			tallas: linea.tallas,
			/* Para el resumen mientras decide, y es el precio de HOY: enseñar el
			   de entonces haría que el total del carrito no cuadre con el cobro. */
			precioUnitario: linea.unitario ?? 0,
			miniatura: linea.miniatura,
		});
	}

	if (articulos.length === 0) {
		throw malaPeticion("Ninguna de esas líneas se puede volver a pedir");
	}

	return { articulos, descartadas };
}
