import { sleep } from "k6";
import {
	BASE,
	clasificar,
	comprobarEntorno,
	escalones,
	get,
	latenciaCatalogo,
	latenciaFicha,
} from "./comun.js";

/**
 * Escenarios 1 y 2: recorrer el catálogo y abrir una ficha.
 *
 * SON LOS ÚNICOS DOS QUE SE PUEDEN CORRER CONTRA PRODUCCIÓN, porque son las
 * únicas rutas que no escriben nada: `GET /publico/catalogo` y
 * `GET /publico/catalogo/:id`. Aun así, hacerlo consume la misma cuota de Lambda
 * que los compradores de verdad —hoy son 10 ejecuciones concurrentes para toda
 * la cuenta— así que contra producción sólo tiene sentido el primer escalón, y
 * fuera de horas.
 *
 * LA PROPORCIÓN ES 3 A 1 a propósito. Quien entra al catálogo abre unas pocas
 * fichas, no una por vista. Con 1 a 1 se mediría un patrón que nadie hace, y la
 * partición caliente de `gsi2` —que es lo que se quiere estresar— recibiría
 * menos carga de la real.
 */

export const options = {
	scenarios: {
		catalogo: {
			...escalones(),
			exec: "recorrerCatalogo",
			tags: { escenario: "catalogo" },
		},
		ficha: {
			...escalones(10, 300),
			exec: "abrirFicha",
			startTime: "5s",
			tags: { escenario: "ficha" },
		},
	},

	/* UMBRALES: la primera ejecución NO es un aprobado o suspenso.
	   Nada de esto se ha medido nunca, así que estos números son objetivos a
	   validar, no valores conocidos. La primera pasada establece la línea base;
	   a partir de ahí sí se pueden endurecer con fundamento. */
	thresholds: {
		// p50 / p95 / p99 del catálogo. Es un Query por llave sobre pocos ítems:
		// si el p99 se dispara, el sospechoso es la cola de concurrencia, no Dynamo.
		"kustto_latencia_catalogo": ["p(50)<150", "p(95)<400", "p(99)<800"],
		"kustto_latencia_ficha": ["p(50)<200", "p(95)<500", "p(99)<1000"],

		// Menos del 1 % de errores de aplicación. Los 429 NO cuentan aquí: se
		// miran aparte, porque significan otra cosa.
		"kustto_tasa_error": ["rate<0.01"],

		// Cero 5xx. Un 500 en una ruta de sólo lectura es un defecto, no falta de
		// capacidad.
		"kustto_5xx": ["count==0"],

		// Los 429 NO llevan umbral en la primera pasada, y es deliberado: con la
		// cuota en 10 van a salir a montones y abortar la prueba por eso
		// impediría medir DÓNDE empiezan. Se pone el umbral cuando la cuota esté
		// subida: entonces un 429 sí es una sorpresa.
		// "kustto_429": ["count==0"],

		"http_req_failed": ["rate<0.05"],
	},
};

export function setup() {
	comprobarEntorno();

	// Se piden los ids una vez y se reparten a los VU: pedirlos dentro del bucle
	// mediría dos veces la misma llamada y falsearía la proporción 3 a 1.
	const res = get("/publico/catalogo");
	if (res.status !== 200) {
		throw new Error(
			`El catálogo contestó ${res.status} en ${BASE}. Sin catálogo no hay prueba.`,
		);
	}

	const ids = res.json().map((p) => p.id);
	if (ids.length === 0) {
		throw new Error("El catálogo está vacío: no hay fichas que abrir.");
	}

	console.log(`Catálogo con ${ids.length} productos. Empezando.`);
	return { ids };
}

export function recorrerCatalogo() {
	clasificar(
		get("/publico/catalogo", { tags: { ruta: "catalogo" } }),
		"catalogo",
		latenciaCatalogo,
	);

	// Pausa corta: un usuario mira antes de pulsar. Sin ella se mediría un
	// bucle cerrado, que no es tráfico de nadie.
	sleep(Math.random() * 2);
}

export function abrirFicha(datos) {
	const id = datos.ids[Math.floor(Math.random() * datos.ids.length)];

	clasificar(
		get(`/publico/catalogo/${id}`, { tags: { ruta: "ficha" } }),
		"ficha",
		latenciaFicha,
	);

	sleep(Math.random() * 3);
}
