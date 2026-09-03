/**
 * El cliente de Skydropx: cotizar envíos y comprar guías.
 *
 * A mano y sin SDK, como el resto. Son tres llamadas HTTP.
 *
 * COTIZAR ES ASÍNCRONO, Y ESO MANDA EN EL DISEÑO
 *
 * Crear una cotización NO devuelve precios: devuelve un id y una lista de
 * paqueterías en `pending`. Los precios aparecen después, consultando esa
 * cotización. Por eso hay dos funciones y no una, y por eso el checkout
 * consulta desde el navegador en vez de tener a una Lambda esperando: pagar
 * ocho segundos de función por cada cotización, con lo lento que puede ser
 * un carrier, sale caro y encima se topa con el tiempo máximo.
 *
 * EL LÍMITE ES DE 2 PETICIONES POR SEGUNDO
 *
 * Poquísimo. Un solo cliente tecleando su código postal lo revienta si se
 * cotiza en cada tecla. De ahí dos decisiones: el token se guarda mientras
 * la función esté viva —caduca a las 2 horas— y quien llame tiene que
 * cotizar sólo con el CP completo, nunca mientras se escribe.
 */

const HOST = process.env.SKYDROPX_HOST ?? "https://sb-pro.skydropx.com";
const CLIENT_ID = process.env.SKYDROPX_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.SKYDROPX_CLIENT_SECRET ?? "";

export type Direccion = {
	/** Código postal. Es lo único que de verdad decide el precio. */
	cp: string;
	estado: string;
	ciudad: string;
	/** La colonia. Skydropx la EXIGE: sin ella rechaza, no la adivina. */
	colonia: string;
};

export type Paquete = {
	/** Centímetros. */
	largo: number;
	ancho: number;
	alto: number;
	/** Kilos. */
	peso: number;
};

export type Tarifa = {
	id: string;
	paqueteria: string;
	servicio: string;
	/** Pesos mexicanos. */
	precio: number;
	dias: number | null;
};

/* ─── El token ────────────────────────────────────────────────────────────
   Vive en el ámbito del módulo a propósito: Lambda reutiliza el contenedor
   entre invocaciones, así que varias peticiones seguidas comparten el mismo
   token en vez de pedir uno nuevo cada vez y comerse el límite de 2/s.

   Se renueva un minuto antes de caducar, no al caducar: si se apura hasta el
   final, una petición lenta puede salir con el token ya muerto. */
let token: { valor: string; expira: number } | null = null;
let pidiendo: Promise<string> | null = null;

async function autenticar(): Promise<string> {
	if (token && Date.now() < token.expira) return token.valor;

	// Compartir la promesa evita que cinco llamadas concurrentes pidan cinco
	// tokens y se pisen entre ellas.
	pidiendo ??= (async () => {
		try {
			if (!CLIENT_ID || !CLIENT_SECRET) {
				throw new Error("Falta SKYDROPX_CLIENT_ID o SKYDROPX_CLIENT_SECRET");
			}

			const res = await fetch(`${HOST}/api/v1/oauth/token`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					client_id: CLIENT_ID,
					client_secret: CLIENT_SECRET,
					grant_type: "client_credentials",
				}),
			});

			const dato = (await res.json()) as {
				access_token?: string;
				expires_in?: number;
				error_description?: string;
			};

			if (!res.ok || !dato.access_token) {
				throw new Error(
					`Skydropx no dio token: ${dato.error_description ?? res.status}`,
				);
			}

			token = {
				valor: dato.access_token,
				expira: Date.now() + ((dato.expires_in ?? 7200) - 60) * 1000,
			};

			return token.valor;
		} finally {
			pidiendo = null;
		}
	})();

	return pidiendo;
}

/**
 * Skydropx está saturado o nos pasamos de su límite.
 *
 * Se distingue del resto a propósito: no es un fallo nuestro ni del dato que
 * mandaron, es "vuelve a intentar". Devolverlo como 500 hace que el navegador
 * se rinda y que en el log parezca un bug donde sólo había prisa.
 */
export class DemasiadasPeticiones extends Error {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function llamar<T>(
	ruta: string,
	opciones?: { metodo?: string; cuerpo?: unknown },
): Promise<T> {
	// Hasta tres intentos con espera creciente. El límite es de 2 peticiones
	// por segundo y se mide por sede, o sea entre TODAS las Lambdas a la vez:
	// no hay forma de respetarlo contando en memoria, porque cada invocación
	// vive en su propio contenedor. Reintentar es lo único que funciona.
	for (let intento = 0; ; intento++) {
		const jwt = await autenticar();

		const res = await fetch(`${HOST}${ruta}`, {
			method: opciones?.metodo ?? "GET",
			headers: {
				authorization: `Bearer ${jwt}`,
				"content-type": "application/json",
			},
			body: opciones?.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
		});

		if (res.status === 429 && intento < 2) {
			await esperar(600 * (intento + 1));
			continue;
		}

		const dato = await res.json().catch(() => null);

		if (!res.ok) {
			// El cuerpo de error trae el detalle por campo y es lo único que dice
			// qué falta de verdad; al log entero, hacia fuera nada.
			console.error(`Skydropx ${res.status} en ${ruta}:`, JSON.stringify(dato));

			if (res.status === 429) {
				throw new DemasiadasPeticiones("Skydropx está saturado ahora mismo");
			}
			throw new Error(`Skydropx respondió ${res.status}`);
		}

		return dato as T;
	}
}

/** Arranca la cotización. Devuelve el id con el que se consulta después. */
export async function cotizar(
	origen: Direccion,
	destino: Direccion,
	paquete: Paquete,
): Promise<string> {
	const dato = await llamar<{ id: string }>("/api/v1/quotations", {
		metodo: "POST",
		cuerpo: {
			quotation: {
				address_from: aDireccion(origen),
				address_to: aDireccion(destino),
				parcel: {
					length: paquete.largo,
					width: paquete.ancho,
					height: paquete.alto,
					weight: paquete.peso,
				},
			},
		},
	});

	return dato.id;
}

type RespuestaCotizacion = {
	is_completed: boolean;
	rates: {
		id: string;
		status: string;
		provider_display_name: string | null;
		provider_service_name: string | null;
		total: string | null;
		days: number | null;
	}[];
};

/* ─── Qué paqueterías se pueden ofrecer ──────────────────────────────────

   Cotizar no es lo mismo que poder despachar. Skydropx cotiza con todas las
   paqueterías de la cuenta, pero si la credencial de una no está dada de alta,
   la guía se compra y muere con "Credential ... was not found in cache". Para
   entonces el cliente YA eligió y pagó ese envío, y el taller se queda sin
   forma de mandarlo: el pedido se atasca con el dinero dentro.

   Pasó de verdad con ampm y con tresguerras; sólo Paquetexpress generó
   etiqueta. Por eso se puede acotar lo que se ofrece.

   Con la variable vacía se ofrecen todas, que es como estaba. Con
   `SKYDROPX_PAQUETERIAS=paquetexpress` sólo se ofrece esa. Es una lista
   separada por comas.

   Se compara sin acentos, espacios ni mayúsculas porque el nombre llega como
   lo escribe Skydropx: "Paquetexpress", "ampm", "Tres Guerras". */
const PERMITIDAS = (process.env.SKYDROPX_PAQUETERIAS ?? "")
	.split(",")
	.map((n) => nombreLlano(n))
	.filter(Boolean);

/**
 * El rango de diacríticos se arma en tiempo de ejecución a propósito: escrito
 * literal, Biome y las herramientas de edición lo convierten en el carácter
 * combinante de verdad y el reemplazo deja de funcionar sin avisar.
 */
const DIACRITICOS = new RegExp(
	`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
	"g",
);

function nombreLlano(s: string) {
	return s
		.normalize("NFD")
		.replace(DIACRITICOS, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

/** Si la lista está vacía pasan todas: no filtrar es el comportamiento viejo. */
export function paqueteriaPermitida(nombre: string | null | undefined) {
	if (PERMITIDAS.length === 0) return true;
	return PERMITIDAS.includes(nombreLlano(String(nombre ?? "")));
}

/**
 * Consulta una cotización ya creada.
 *
 * `lista` dice si Skydropx terminó de preguntarle a todas las paqueterías.
 * Mientras sea `false` hay que volver a consultar; las tarifas que ya estén
 * se devuelven igual, para poder ir pintando.
 */
export async function consultarCotizacion(id: string): Promise<{
	lista: boolean;
	tarifas: Tarifa[];
}> {
	const dato = await llamar<RespuestaCotizacion>(`/api/v1/quotations/${id}`);

	const tarifas = (dato.rates ?? [])
		// Skydropx devuelve TODAS las paqueterías, incluidas las que no cubren
		// la ruta o no aplican, con el precio en null. Enseñar eso sería
		// enseñar ruido: sólo pasan las que traen precio de verdad.
		.filter((r) => r.total !== null && Number(r.total) > 0)
		// Y de esas, sólo las que de verdad pueden despachar. Ver arriba.
		.filter((r) => paqueteriaPermitida(r.provider_display_name))
		.map((r) => ({
			id: r.id,
			paqueteria: r.provider_display_name ?? "—",
			servicio: r.provider_service_name ?? "—",
			precio: Number(r.total),
			dias: r.days,
		}))
		.sort((a, b) => a.precio - b.precio);

	return { lista: dato.is_completed === true, tarifas };
}

function aDireccion(d: Direccion) {
	return {
		country_code: "MX",
		postal_code: d.cp,
		area_level1: d.estado,
		area_level2: d.ciudad,
		area_level3: d.colonia,
	};
}
