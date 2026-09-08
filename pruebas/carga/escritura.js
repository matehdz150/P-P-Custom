import { sleep } from "k6";
import {
	clasificar,
	escalones,
	escrituraPermitida,
	get,
	latenciaCotizar,
	latenciaPedido,
	post,
} from "./comun.js";

/**
 * Escenarios 3 a 6: cotizar, crear pedido, pagar y procesar en el taller.
 *
 * ESTA SUITE NO SE PUEDE CORRER CONTRA PRODUCCIÓN, y el guardián de `comun.js`
 * lo impide antes de mandar una sola petición. Lo que hace cada una:
 *
 *   3. Cotizar  -> llama a Skydropx. Aunque hoy apunta al sandbox, mil
 *                  peticiones por segundo contra un tercero que admite DOS es
 *                  abuso de su servicio, no una prueba del nuestro.
 *   4/5. Pedir  -> `TransactWriteItems` real: crea la compra, crea un pedido por
 *                  taller, quema un folio que no se libera nunca y DESCUENTA
 *                  EXISTENCIAS. Además manda correo por SES y avisa por
 *                  WebSocket. Nada de eso se puede deshacer con un borrado.
 *   6. Taller   -> mueve pedidos de estado y manda más correos; comprar guía
 *                  pide una etiqueta de verdad a la paquetería.
 *
 * QUÉ HACE FALTA PARA CORRERLA: un stack de pruebas completo. Está enumerado en
 * el README de esta carpeta, y no es opcional ninguno de los puntos.
 */

export const options = {
	scenarios: {
		cotizar: {
			...escalones(20, 400),
			exec: "cotizarEnvio",
			tags: { escenario: "cotizar" },
		},
		/* El pedido va a una fracción de la tasa, no a la misma.
		   Nadie paga en cada visita: con la misma tasa que el catálogo se estaría
		   midiendo un embudo que no existe, y el resultado no diría nada del
		   sistema real. Uno de cada veinte es un embudo generoso para un
		   marketplace. */
		pedido: {
			executor: "ramping-arrival-rate",
			startRate: 1,
			timeUnit: "1s",
			preAllocatedVUs: 10,
			maxVUs: 100,
			exec: "crearPedido",
			startTime: "10s",
			tags: { escenario: "pedido" },
			stages: [
				{ target: 1, duration: "3m" },
				{ target: 3, duration: "3m" },
				{ target: 5, duration: "3m" },
				{ target: 13, duration: "3m" },
				{ target: 25, duration: "3m" },
				{ target: 50, duration: "4m" },
				{ target: 0, duration: "1m" },
			],
		},
		taller: {
			executor: "constant-arrival-rate",
			rate: 5,
			timeUnit: "1s",
			duration: "18m",
			preAllocatedVUs: 10,
			maxVUs: 50,
			exec: "procesarEnTaller",
			startTime: "30s",
			tags: { escenario: "taller" },
		},
	},

	thresholds: {
		/* Cotizar espera a un tercero: ~5 s está MEDIDO y documentado en
		   `ESTADO.md`. El umbral no mide a Skydropx, mide que nosotros no
		   añadamos cola encima; por eso el p50 se fija cerca de su latencia
		   propia y lo que se vigila es el p99. */
		"kustto_latencia_cotizar": ["p(50)<5500", "p(95)<8000", "p(99)<12000"],

		/* El pedido es la ruta que cobra: su cola es la que duele. */
		"kustto_latencia_pedido": ["p(50)<1500", "p(95)<3000", "p(99)<5000"],

		"kustto_tasa_error": ["rate<0.01"],
		"kustto_5xx": ["count==0"],
		"http_req_failed": ["rate<0.05"],
	},
};

export function setup() {
	// El guardián primero: antes de leer nada y antes de escribir nada.
	escrituraPermitida();

	const res = get("/publico/catalogo");
	if (res.status !== 200) {
		throw new Error(`El catálogo de pruebas contestó ${res.status}`);
	}

	const productos = res.json();
	if (productos.length === 0) {
		throw new Error(
			"El catálogo de pruebas está vacío. Siémbralo antes: sin productos\n" +
				"publicados no se puede ni cotizar ni pedir.",
		);
	}

	/* Se reparte el pedido entre TODOS los productos, no siempre el mismo.
	   Machacar uno solo mediría la partición caliente de ese producto —que es
	   un experimento válido, pero otro— en vez del comportamiento normal. Si lo
	   que se quiere es justo eso, se pone `PRODUCTO_FIJO`. */
	return { productos, fijo: __ENV.PRODUCTO_FIJO ?? null };
}

/** Una dirección de destino que es válida para cotizar y evidentemente falsa. */
function destinoDePrueba() {
	return {
		calle: "Calle de Pruebas de Carga",
		numero: "0",
		colonia: "Centro",
		ciudad: "Guadalajara",
		estado: "Jalisco",
		cp: "44100",
		nombre: "PRUEBA DE CARGA k6",
		telefono: "3300000000",
	};
}

function unProducto(datos) {
	if (datos.fijo) {
		return datos.productos.find((p) => p.id === datos.fijo) ?? datos.productos[0];
	}
	return datos.productos[Math.floor(Math.random() * datos.productos.length)];
}

/** Escenario 3 — cotizar envío. Toca Skydropx. */
export function cotizarEnvio(datos) {
	const p = unProducto(datos);

	clasificar(
		post(
			"/publico/envios/cotizar",
			{
				destino: destinoDePrueba(),
				lineas: [
					{
						productoId: p.id,
						tallas: [{ size: p.sizes?.[0]?.size ?? "M", piezas: 1 }],
						lados: ["front"],
					},
				],
			},
			{ tags: { ruta: "cotizar" } },
		),
		"cotizar",
		latenciaCotizar,
	);

	sleep(1);
}

/**
 * Escenarios 4 y 5 — crear el pedido y "pagar".
 *
 * SON LA MISMA PETICIÓN hoy, y conviene saberlo: no hay pasarela todavía
 * (`ESTADO.md`: "`pagado` no está todavía"), así que `POST /publico/pedidos`
 * crea y da por bueno el pedido de una vez. No hay cargo real a una tarjeta —
 * pero sí hay descuento de existencias, folio quemado y correo enviado.
 * El día que entre la pasarela, este escenario hay que partirlo en dos y volver
 * a leer si sigue siendo seguro.
 */
export function crearPedido(datos) {
	const p = unProducto(datos);
	const marca = `k6-${__VU}-${__ITER}-${Date.now()}`;

	clasificar(
		post(
			"/publico/pedidos",
			{
				comprador: {
					// Marcado en el propio dato: si algo se cuela a una tabla que no
					// era, se encuentra con un solo `begins_with`.
					nombre: `PRUEBA DE CARGA ${marca}`,
					email: `carga+${marca}@ejemplo.invalid`,
					telefono: "3300000000",
				},
				entrega: { metodo: "recoger" },
				lineas: [
					{
						productoId: p.id,
						tallas: [{ size: p.sizes?.[0]?.size ?? "M", piezas: 1 }],
						lados: ["front"],
						colorPrenda: p.colors?.[0]?.name ?? null,
					},
				],
			},
			{ tags: { ruta: "pedido" } },
		),
		"pedido",
		latenciaPedido,
	);

	sleep(2);
}

/**
 * Escenario 6 — el taller procesa.
 *
 * SÓLO LEE. Mover de estado y comprar guía quedan fuera a propósito: lo primero
 * manda correos y lo segundo pide una etiqueta real. Lo que aquí interesa medir
 * es la bandeja del taller bajo carga —el `Query` a `gsi1`, que es el patrón
 * caliente del panel— y eso se mide leyendo.
 *
 * Necesita un token de Cognito del pool de pruebas en `TOKEN_TALLER`. Sin él el
 * escenario se salta en vez de llenar el resultado de 401 que no dicen nada.
 */
export function procesarEnTaller() {
	const token = __ENV.TOKEN_TALLER;
	if (!token) return;

	const cabeceras = { authorization: `Bearer ${token}` };

	clasificar(
		get("/proveedores/pedidos", {
			headers: cabeceras,
			tags: { ruta: "bandeja-taller" },
		}),
		"bandeja del taller",
	);

	sleep(3);
}
