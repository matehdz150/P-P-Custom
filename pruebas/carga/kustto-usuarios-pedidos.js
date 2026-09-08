import { check, fail, sleep } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

const API = (__ENV.KUSTTO_TEST_API ?? "").replace(/\/$/, "");
const ARCHIVO_USUARIOS = __ENV.KUSTTO_USERS_FILE ?? "./.usuarios.json";
const USUARIOS = JSON.parse(open(ARCHIVO_USUARIOS));
const RPS_USUARIOS = Number(__ENV.USERS_RPS ?? 10);
const RPS_PEDIDOS = Number(__ENV.ORDERS_RPS ?? 1);
const USUARIOS_CONCURRENTES = Number(__ENV.CONCURRENT_USERS ?? 0);
const PAUSA_USUARIO = Number(__ENV.THINK_TIME_SECONDS ?? 1);
const DURACION = __ENV.DURATION ?? "2m";
const CALENTAMIENTO = __ENV.WARMUP ?? "30s";
const PERFIL = __ENV.PROFILE ?? "load";
const HABILITADO = __ENV.KUSTTO_LOAD_TEST === "SI";
const ERROR_MAXIMO = Number(__ENV.MAX_ERROR_RATE ?? 0.01);
const P95_USUARIOS = Number(__ENV.USER_P95_MS ?? 1000);
const P95_PEDIDOS = Number(__ENV.ORDER_P95_MS ?? 2000);

if (!HABILITADO) {
	throw new Error("Define KUSTTO_LOAD_TEST=SI para confirmar la prueba.");
}
if (!API) throw new Error("Falta KUSTTO_TEST_API.");
if (API.includes("kd8ydpp2c6") || API.includes("kustto.com.mx")) {
	throw new Error("El runner se niega a ejecutar contra producción.");
}
if (!Array.isArray(USUARIOS) || USUARIOS.length === 0) {
	throw new Error(`No hay usuarios en ${ARCHIVO_USUARIOS}.`);
}
if (PERFIL !== "load" && PERFIL !== "spike") {
	throw new Error("PROFILE debe ser load o spike.");
}
for (const [nombre, valor] of [
	["USERS_RPS", RPS_USUARIOS],
	["ORDERS_RPS", RPS_PEDIDOS],
	["CONCURRENT_USERS", USUARIOS_CONCURRENTES],
]) {
	if (!Number.isFinite(valor) || valor < 0 || valor > 500) {
		throw new Error(`${nombre} debe estar entre 0 y 500.`);
	}
}
if (RPS_USUARIOS === 0 && RPS_PEDIDOS === 0 && USUARIOS_CONCURRENTES === 0) {
	throw new Error("Activa USERS_RPS, ORDERS_RPS o ambos.");
}
if (USUARIOS_CONCURRENTES > 0 && RPS_USUARIOS > 0) {
	throw new Error("Usa CONCURRENT_USERS o USERS_RPS, no ambos a la vez.");
}
if (USUARIOS_CONCURRENTES > USUARIOS.length) {
	throw new Error(
		`CONCURRENT_USERS pide ${USUARIOS_CONCURRENTES} identidades y sólo hay ${USUARIOS.length}.`,
	);
}
if (
	!Number.isFinite(PAUSA_USUARIO) ||
	PAUSA_USUARIO < 0 ||
	PAUSA_USUARIO > 60
) {
	throw new Error("THINK_TIME_SECONDS debe estar entre 0 y 60.");
}
if (!(ERROR_MAXIMO > 0 && ERROR_MAXIMO <= 0.1)) {
	throw new Error("MAX_ERROR_RATE debe ser mayor a 0 y máximo 0.1.");
}

const usuariosFallidos = new Rate("usuarios_fallidos");
const pedidosFallidos = new Rate("pedidos_fallidos");
const respuestas429 = new Rate("respuestas_429");
const respuestas5xx = new Rate("respuestas_5xx");

function escenario(exec, rps) {
	const capacidad = Math.min(Math.max(rps * 3, 20), 500);
	const comun = {
		exec,
		timeUnit: "1s",
		preAllocatedVUs: Math.min(Math.max(rps, 10), 200),
		maxVUs: capacidad,
	};

	return PERFIL === "spike"
		? {
				...comun,
				executor: "constant-arrival-rate",
				rate: rps,
				duration: DURACION,
			}
		: {
				...comun,
				executor: "ramping-arrival-rate",
				startRate: 1,
				stages: [
					{ target: rps, duration: CALENTAMIENTO },
					{ target: rps, duration: DURACION },
				],
			};
}

const scenarios = {};
if (USUARIOS_CONCURRENTES > 0) {
	scenarios.usuarios = {
		exec: "flujoUsuario",
		executor: "constant-vus",
		vus: USUARIOS_CONCURRENTES,
		duration: DURACION,
	};
} else if (RPS_USUARIOS > 0) {
	scenarios.usuarios = escenario("flujoUsuario", RPS_USUARIOS);
}
if (RPS_PEDIDOS > 0) scenarios.pedidos = escenario("flujoPedido", RPS_PEDIDOS);

export const options = {
	discardResponseBodies: true,
	scenarios,
	thresholds: {
		usuarios_fallidos: [`rate<${ERROR_MAXIMO}`],
		pedidos_fallidos: [`rate<${ERROR_MAXIMO}`],
		"http_req_duration{flujo:usuario}": [`p(95)<${P95_USUARIOS}`],
		"http_req_duration{flujo:pedido}": [`p(95)<${P95_PEDIDOS}`],
	},
};

export function setup() {
	const respuesta = http.get(`${API}/publico/catalogo`, {
		responseType: "text",
	});
	if (respuesta.status !== 200)
		fail(`El catálogo respondió ${respuesta.status}.`);

	const productos = respuesta.json();
	const utilizables = Array.isArray(productos)
		? productos.filter((p) => p?.id && p?.sizes?.[0]?.size)
		: [];
	if (utilizables.length === 0)
		fail("El catálogo no tiene productos utilizables.");

	return {
		productos: utilizables.map((p) => ({
			id: p.id,
			talla: p.sizes[0].size,
			color: p.colors?.[0]?.name ?? null,
		})),
	};
}

function usuarioActual() {
	return USUARIOS[(__VU + __ITER) % USUARIOS.length];
}

function registrarEstado(respuesta) {
	respuestas429.add(respuesta.status === 429);
	respuestas5xx.add(respuesta.status >= 500 || respuesta.status === 0);
}

export function flujoUsuario() {
	const usuario = usuarioActual();
	const rutas = ["/cuenta/perfil", "/cuenta/carrito", "/cuenta/pedidos"];
	const ruta = rutas[__ITER % rutas.length];
	const respuesta = http.get(`${API}${ruta}`, {
		headers: { Authorization: `Bearer ${usuario.idToken}` },
		tags: { flujo: "usuario", endpoint: ruta },
	});
	const fallo = respuesta.status < 200 || respuesta.status >= 300;

	registrarEstado(respuesta);
	usuariosFallidos.add(fallo);
	check(respuesta, {
		"usuario autenticado responde 2xx": (r) =>
			r.status >= 200 && r.status < 300,
	});
	if (USUARIOS_CONCURRENTES > 0 && PAUSA_USUARIO > 0) sleep(PAUSA_USUARIO);
}

export function flujoPedido(datos) {
	const usuario = usuarioActual();
	const producto = datos.productos[(__VU + __ITER) % datos.productos.length];
	const cuerpo = {
		comprador: {
			nombre: "Prueba de carga",
			email: usuario.email,
			whatsapp: "5512345678",
			notas: "Pedido sintético; entorno kustto-test",
		},
		entrega: { metodo: "recoger" },
		lineas: [
			{
				productoId: producto.id,
				colorPrenda: producto.color,
				tallas: [{ size: producto.talla, piezas: 1 }],
				lados: [],
			},
		],
	};
	const respuesta = http.post(
		`${API}/publico/pedidos`,
		JSON.stringify(cuerpo),
		{
			headers: { "content-type": "application/json" },
			responseType: "text",
			tags: { flujo: "pedido", endpoint: "/publico/pedidos" },
		},
	);
	let valido = false;
	if (respuesta.status >= 200 && respuesta.status < 300) {
		try {
			const pedido = respuesta.json();
			valido = Boolean(pedido?.id && pedido?.folio && pedido?.token);
		} catch {
			valido = false;
		}
	}
	const fallo = !valido;

	registrarEstado(respuesta);
	pedidosFallidos.add(fallo);
	check(respuesta, { "pedido real creado": () => !fallo });
}
