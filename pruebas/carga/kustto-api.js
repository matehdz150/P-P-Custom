import { check, fail } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

const API = (__ENV.KUSTTO_TEST_API ?? "").replace(/\/$/, "");
const RPS = Number(__ENV.RPS ?? 10);
const DURACION = __ENV.DURATION ?? "2m";
const CALENTAMIENTO = __ENV.WARMUP ?? "30s";
const PERFIL = __ENV.PROFILE ?? "load";
const HABILITADO = __ENV.KUSTTO_LOAD_TEST === "SI";

if (!HABILITADO) {
	throw new Error("Define KUSTTO_LOAD_TEST=SI para confirmar la prueba.");
}
if (!API) throw new Error("Falta KUSTTO_TEST_API.");
if (API.includes("kd8ydpp2c6") || API.includes("kustto.com.mx")) {
	throw new Error("El runner se niega a ejecutar contra producción.");
}
if (!Number.isFinite(RPS) || RPS < 1 || RPS > 500) {
	throw new Error("RPS debe estar entre 1 y 500.");
}
if (PERFIL !== "load" && PERFIL !== "spike") {
	throw new Error("PROFILE debe ser load o spike.");
}

const erroresInesperados = new Rate("errores_inesperados");
const erroresRed = new Rate("errores_red");
const limitadas = new Rate("respuestas_429");
const respuestas5xx = new Rate("respuestas_5xx");

export const options = {
	discardResponseBodies: true,
	scenarios: {
		api:
			PERFIL === "spike"
				? {
						executor: "constant-arrival-rate",
						rate: RPS,
						timeUnit: "1s",
						duration: DURACION,
						preAllocatedVUs: Math.min(Math.max(RPS, 10), 200),
						maxVUs: Math.min(Math.max(RPS * 3, 30), 500),
					}
				: {
						executor: "ramping-arrival-rate",
						startRate: 1,
						timeUnit: "1s",
						preAllocatedVUs: Math.min(Math.max(RPS, 10), 200),
						maxVUs: Math.min(Math.max(RPS * 3, 30), 500),
						stages: [
							{ target: RPS, duration: CALENTAMIENTO },
							{ target: RPS, duration: DURACION },
						],
					},
	},
	thresholds: {
		errores_inesperados: ["rate==0"],
		http_req_duration: ["p(95)<1500"],
	},
};

export function setup() {
	const respuesta = http.get(`${API}/publico/catalogo`, {
		responseType: "text",
	});
	if (respuesta.status !== 200) {
		fail(`El catálogo de prueba respondió ${respuesta.status}.`);
	}
	let productos = [];
	try {
		productos = respuesta.json();
	} catch {
		fail("El catálogo de prueba no devolvió JSON.");
	}
	return {
		productoId: Array.isArray(productos) ? productos[0]?.id : undefined,
	};
}

export default function (datos) {
	const rutas = ["/publico/catalogo", "/publico/categorias"];
	if (datos.productoId) rutas.push(`/publico/catalogo/${datos.productoId}`);

	const respuesta = http.get(`${API}${rutas[__ITER % rutas.length]}`, {
		tags: { endpoint: rutas[__ITER % rutas.length] },
	});
	const limitada = respuesta.status === 429;
	const errorRed = respuesta.status === 0;
	const errorServidor = respuesta.status >= 500;
	const inesperado = errorRed || errorServidor;

	limitadas.add(limitada);
	erroresRed.add(errorRed);
	respuestas5xx.add(errorServidor);
	erroresInesperados.add(inesperado);
	check(respuesta, {
		"responde 2xx o aplica el límite esperado": (r) =>
			(r.status >= 200 && r.status < 300) || r.status === 429,
	});
}
