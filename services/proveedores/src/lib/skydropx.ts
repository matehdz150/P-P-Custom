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

import { malaPeticion } from "./http.js";

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

			/* Un 422 es un dato que falta o no cuadra, no un fallo nuestro:
			   sale como 400 con lo que Skydropx dijo. Con un 500 genérico el
			   taller no sabe si reintentar ni qué corregir — ya pasó, con un
			   pedido sin teléfono del cliente. */
			if (res.status === 422) {
				throw malaPeticion(mensajeDeSkydropx(dato));
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

/** Lo que hace falta para que la paquetería toque una puerta. */
export type Contacto = {
	nombre: string;
	telefono: string;
	email: string;
	calle: string;
	numero: string;
	referencias?: string | null;
};

export type Guia = {
	envioId: string;
	rastreo: string | null;
	paqueteria: string | null;
	etiquetaUrl: string | null;
	rastreoUrl: string | null;
	/** Lo que Skydropx nos cobró de verdad. Manda sobre la tarifa cotizada. */
	costo: number | null;
	/**
	 * En qué acabó el envío del lado de la paquetería.
	 *
	 * HACE FALTA PORQUE UN ENVÍO PUEDE MORIR, y sin esto no se distingue de uno
	 * que va lento: los dos se ven como "sin etiqueta". Pasó de verdad — dos
	 * envíos quedaron en `error` con `CREDENTIAL_SERVICE_PROVIDER_NOT_FOUND`
	 * (la cuenta no tenía dada de alta esa paquetería), el cobro se reembolsó,
	 * y el panel se quedó diciendo "la paquetería está tardando" para siempre.
	 */
	estado: string | null;
	/** El motivo, cuando `estado` es `error`. Es lo único accionable. */
	error: string | null;
};

/**
 * Compra la guía de una cotización ya hecha.
 *
 * IMPORTANTE: la cotización tiene que ser la del peso REAL, no la del
 * estimado que se le enseñó al comprador. Comprar sobre la vieja imprime una
 * etiqueta con un peso que no es, y la paquetería repesa y factura la
 * diferencia semanas después, cuando ya nadie se acuerda del pedido.
 */
export async function comprarGuia(
	cotizacionId: string,
	tarifaId: string,
	origen: Direccion & Contacto,
	destino: Direccion & Contacto,
	paquete: Paquete,
): Promise<Guia> {
	const dato = await llamar<any>("/api/v1/shipments", {
		metodo: "POST",
		cuerpo: {
			shipment: {
				quotation_id: cotizacionId,
				rate_id: tarifaId,
				address_from: aDireccionCompleta(origen),
				address_to: aDireccionCompleta(destino),
				/* `packages`, NO `parcels`.
				 *
				 * Costó encontrarlo: la cotización usa `parcel` en singular, el
				 * envío usa `packages` en plural, y mandándolo como `parcels` la
				 * API contesta "consignment_note es requerido en todos los
				 * paquetes" — como si faltara el dato, no como si la clave
				 * estuviera mal. Su documentación no trae el ejemplo.
				 *
				 * `package_number` tiene que coincidir con el de la cotización,
				 * que para un solo bulto es 1. Con 0 rechaza. */
				packages: [
					{
						package_number: 1,
						length: paquete.largo,
						width: paquete.ancho,
						height: paquete.alto,
						weight: paquete.peso,
						package_type: TIPO_EMPAQUE,
						// La clave del SAT de lo que va dentro: México la exige en la
						// carta porte y Skydropx rechaza el envío sin ella. 53102500
						// es "ropa". Si algún día se mandan termos o gorras habrá que
						// variarla por producto, y conviene confirmarla con el
						// contador antes de facturar en serio.
						consignment_note: CLAVE_SAT,
					},
				],
			},
		},
	});

	/* La etiqueta NO viene en la respuesta de creación, y esperarla aquí fue
	 * un error que costó descubrir: el envío nace en `in_progress` y cada
	 * paquetería tarda lo suyo. Con ampm seguía sin etiqueta minutos después,
	 * o sea que ninguna espera razonable dentro de la función la habría
	 * alcanzado — sólo habría gastado los 29 segundos y muerto por timeout
	 * DESPUÉS de que el envío ya se pagó.
	 *
	 * Así que se devuelve lo que haya y la etiqueta se consulta aparte, con
	 * `consultarEnvio`. Lo que importa guardar ya está: el id y el cobro. */
	return aGuia(String(dato?.data?.id ?? ""), dato);
}

/** Relee un envío ya creado. Es como aparece la etiqueta cuando esté lista. */
export async function consultarEnvio(envioId: string): Promise<Guia> {
	const r = await llamar<any>(`/api/v1/shipments/${envioId}`);
	return aGuia(envioId, r);
}

/**
 * Saca algo legible del 422.
 *
 * Su formato varía: a veces `errors` es un objeto de campo → mensajes, a veces
 * una lista. Se junta lo que haya; si no se entiende, se dice que no se
 * entendió en vez de inventar.
 */
function mensajeDeSkydropx(dato: any): string {
	const e = dato?.errors ?? dato?.error ?? null;

	if (typeof e === "string") return e;

	if (Array.isArray(e)) {
		const partes = e
			.map((x) => (typeof x === "string" ? x : (x?.detail ?? x?.title ?? "")))
			.filter(Boolean);
		if (partes.length > 0) return partes.join(". ");
	}

	if (e && typeof e === "object") {
		const partes = Object.entries(e).map(
			([campo, v]) =>
				`${campo}: ${Array.isArray(v) ? v.join(", ") : String(v)}`,
		);
		if (partes.length > 0) return partes.join(". ");
	}

	return "La paquetería rechazó los datos del envío";
}

/**
 * Traduce la respuesta de Skydropx a nuestra `Guia`.
 *
 * RECIBE EL DOCUMENTO ENTERO, NO `data.attributes`. Es la parte que costó
 * descubrir: la etiqueta, el número de rastreo y el enlace de la paquetería
 * **no están en el envío**, están en el PAQUETE, que viaja aparte en
 * `included[]` con `type: "package"`. Leyendo sólo `data.attributes`,
 * `label_url` sale `undefined` siempre y el panel se queda diciendo "la
 * paquetería está preparando la etiqueta" para un envío que ya está listo.
 *
 * Pasó exactamente eso: un envío de paquetexpress en `success` y `paid`, con
 * su etiqueta generada, que aquí se veía sin etiqueta.
 *
 * Del envío salen el estado, la paquetería y el cobro; del paquete, todo lo
 * que el taller necesita para producir el envío.
 */
function aGuia(envioId: string, doc: any): Guia {
	const a = doc?.data?.attributes ?? {};

	const paquete =
		(doc?.included ?? []).find((i: any) => i?.type === "package")?.attributes ??
		{};

	const detalle = a.error_detail ?? null;

	return {
		envioId,
		// El del paquete manda: el `master_tracking_number` del envío existe
		// antes que la guía y con varios bultos sería otro número.
		rastreo: paquete.tracking_number ?? a.master_tracking_number ?? null,
		paqueteria: a.carrier_name ?? null,
		etiquetaUrl: paquete.label_url ?? null,
		rastreoUrl: paquete.tracking_url_provider ?? null,
		estado: a.workflow_status ?? null,
		// El mensaje largo primero: el corto es "vuelve a intentarlo", que no
		// dice nada. El largo trae la causa real.
		error: detalle
			? (detalle.error_message_detail ??
				detalle.error_message ??
				detalle.error_code ??
				null)
			: null,
		// Lo que Skydropx nos cobró de verdad. No tiene por qué coincidir con
		// la tarifa cotizada, y es el número que manda para las cuentas.
		costo: a.total !== undefined ? Number(a.total) : null,
	};
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

/** La clave del SAT de lo que se manda. 53102500 = ropa. */
const CLAVE_SAT = process.env.KUSTTO_CLAVE_SAT ?? "53102500";
/** El tipo de empaque de la carta porte. 4G = caja de carton. */
const TIPO_EMPAQUE = process.env.KUSTTO_TIPO_EMPAQUE ?? "4G";

function aDireccionCompleta(d: Direccion & Contacto) {
	return {
		...aDireccion(d),
		name: d.nombre,
		phone: d.telefono,
		email: d.email,
		street1: `${d.calle} ${d.numero}`.trim(),
		// Skydropx rechaza una referencia vacía. Cuando no hay, se manda la
		// colonia: es verdad, ayuda al repartidor, y no inventa nada.
		reference: d.referencias?.trim() || d.colonia,
	};
}
