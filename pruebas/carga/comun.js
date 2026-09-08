import { check } from "k6";
import http from "k6/http";
import { Counter, Rate, Trend } from "k6/metrics";

/**
 * Lo que comparten las dos suites de carga.
 *
 * EL GUARDIÁN ES LA PIEZA IMPORTANTE de este archivo, no los umbrales. Cuatro de
 * los seis escenarios que se quieren medir —cotizar, crear pedido, pagar y
 * procesar en el taller— ESCRIBEN: descuentan existencias reales, mandan correos
 * reales por SES y piden guías reales a la paquetería. Contra producción no son
 * una prueba, son un incidente. Así que `escrituraPermitida()` falla cerrado: si
 * no puede demostrar que apunta a un entorno de pruebas, aborta.
 *
 * NO SE MIDE TODO DESDE AQUÍ. k6 ve latencia y códigos de respuesta; la
 * concurrencia de Lambda, los throttles y los reintentos de DynamoDB viven en
 * CloudWatch y se recogen aparte con `recoger-metricas.sh`. Un umbral de k6
 * sobre una métrica que k6 no puede ver sería un umbral que nunca salta.
 */

/** La API contra la que se dispara. Sin valor por defecto: obliga a decirlo. */
export const BASE = __ENV.KUSTTO_API;

/** `prod` | `staging` | `local`. Sin valor por defecto, y por la misma razón. */
export const ENTORNO = __ENV.KUSTTO_ENV;

/**
 * Los hosts de producción, por nombre.
 *
 * Se comprueban por separado del `KUSTTO_ENV` a propósito: escribir
 * `KUSTTO_ENV=staging` apuntando a la API de producción es exactamente el error
 * que esto tiene que atrapar, y confiar sólo en la etiqueta que escribió una
 * persona cansada a las once de la noche no lo atrapa.
 */
const HOSTS_DE_PRODUCCION = [
	"kd8ydpp2c6.execute-api.us-east-1.amazonaws.com",
	"kustto.com.mx",
];

export function aborta(motivo) {
	throw new Error(`\n\n  PRUEBA ABORTADA\n  ${motivo}\n`);
}

/** Comprueba lo mínimo para que cualquier suite pueda arrancar. */
export function comprobarEntorno() {
	if (!BASE) {
		aborta("Falta KUSTTO_API. Ejemplo: -e KUSTTO_API=https://staging.ejemplo/api");
	}
	if (!ENTORNO) {
		aborta("Falta KUSTTO_ENV. Valores: prod | staging | local");
	}
}

/**
 * Deja pasar las escrituras, o aborta explicando por qué no.
 *
 * TRES CANDADOS, y hacen falta los tres: la etiqueta del entorno, el host de
 * destino, y una confirmación explícita. Con dos, un copiar y pegar de una línea
 * de comando de staging con la URL de producción pasaría.
 */
export function escrituraPermitida() {
	comprobarEntorno();

	if (ENTORNO === "prod") {
		aborta(
			"KUSTTO_ENV=prod. Los escenarios de escritura descuentan existencias\n" +
				"  reales, mandan correos por SES y piden guías a la paquetería.\n" +
				"  Apunta a un entorno de pruebas.",
		);
	}

	const host = BASE.replace(/^https?:\/\//, "").split("/")[0];
	if (HOSTS_DE_PRODUCCION.includes(host)) {
		aborta(
			`KUSTTO_API apunta a ${host}, que es producción, aunque\n` +
				`  KUSTTO_ENV diga "${ENTORNO}". Se aborta por el host, no por la etiqueta.`,
		);
	}

	if (__ENV.CONFIRMO_ENTORNO_DE_PRUEBAS !== "si") {
		aborta(
			"Falta -e CONFIRMO_ENTORNO_DE_PRUEBAS=si\n" +
				"  Es deliberado: escribir exige decirlo a mano, no heredarlo de un alias.",
		);
	}
}

/* ─── Métricas propias ────────────────────────────────────────────────────
   k6 ya cuenta fallos, pero mezcla todos los códigos. Estas separan lo que
   significa cosas distintas: un 429 dice "me pasé de la cuota" y un 5xx dice
   "algo se rompió". Confundirlos haría ilegible el resultado, que es justo la
   pregunta que esta prueba viene a contestar. */
export const throttled429 = new Counter("kustto_429");
export const errores5xx = new Counter("kustto_5xx");
export const tasaDeError = new Rate("kustto_tasa_error");
export const latenciaCatalogo = new Trend("kustto_latencia_catalogo", true);
export const latenciaFicha = new Trend("kustto_latencia_ficha", true);
export const latenciaCotizar = new Trend("kustto_latencia_cotizar", true);
export const latenciaPedido = new Trend("kustto_latencia_pedido", true);

/**
 * Clasifica una respuesta y alimenta las métricas.
 *
 * UN 429 NO CUENTA COMO ERROR de la aplicación. Es la respuesta correcta a
 * haberse pasado de la cuota, y es justo lo que se quiere medir: sumarlo a la
 * tasa de error escondería el dato detrás del síntoma.
 */
export function clasificar(res, nombre, tendencia) {
	if (tendencia) tendencia.add(res.timings.duration);

	const es429 = res.status === 429;
	const es5xx = res.status >= 500;

	if (es429) throttled429.add(1);
	if (es5xx) errores5xx.add(1);
	tasaDeError.add(es5xx || (res.status >= 400 && !es429));

	check(res, {
		[`${nombre}: no es 5xx`]: (r) => r.status < 500,
	});

	return res;
}

export function get(ruta, params = {}) {
	return http.get(`${BASE}${ruta}`, {
		...params,
		tags: { ...(params.tags ?? {}) },
	});
}

export function post(ruta, cuerpo, params = {}) {
	return http.post(`${BASE}${ruta}`, JSON.stringify(cuerpo), {
		...params,
		headers: { "content-type": "application/json", ...(params.headers ?? {}) },
	});
}

/**
 * Los seis escalones que se piden, como etapas de una sola ejecución.
 *
 * `ramping-arrival-rate` y NO `ramping-vus`: lo que se quiere fijar es la tasa
 * de PETICIONES, no el número de usuarios simulados. Con usuarios, si el sistema
 * se ralentiza el tráfico baja solo y la prueba se vuelve más suave justo cuando
 * empieza lo interesante — que es como se llega a la conclusión falsa de que
 * todo aguanta.
 *
 * Cada escalón sostiene dos minutos: menos no deja que el escalado automático
 * reaccione, y lo que se mediría es el arranque en frío en vez del régimen.
 */
export function escalones(startVUs = 20, maxVUs = 800) {
	return {
		executor: "ramping-arrival-rate",
		startRate: 10,
		timeUnit: "1s",
		preAllocatedVUs: startVUs,
		maxVUs,
		stages: [
			{ target: 10, duration: "2m" },
			{ target: 50, duration: "1m" },
			{ target: 50, duration: "2m" },
			{ target: 100, duration: "1m" },
			{ target: 100, duration: "2m" },
			{ target: 250, duration: "1m" },
			{ target: 250, duration: "2m" },
			{ target: 500, duration: "1m" },
			{ target: 500, duration: "2m" },
			{ target: 1000, duration: "1m" },
			{ target: 1000, duration: "3m" },
			{ target: 0, duration: "1m" },
		],
	};
}
