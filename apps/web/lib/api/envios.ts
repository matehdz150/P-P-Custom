/**
 * Cotización de envío para el checkout.
 *
 * Va directo a API Gateway y sin credenciales, como el catálogo: cotizar
 * pasa antes de pagar y antes de que exista un pedido.
 *
 * Aquí NO se manda el peso ni las medidas. Sólo qué se pide y a dónde; el
 * paquete lo arma la Lambda con los datos del producto. Si el navegador
 * pudiera mandar el peso, mandaría el precio del envío.
 */

const API = process.env.NEXT_PUBLIC_KUSTTO_API ?? "";

export type Tarifa = {
	id: string;
	paqueteria: string;
	servicio: string;
	precio: number;
	dias: number | null;
};

export type DestinoEnvio = {
	cp: string;
	estado: string;
	ciudad: string;
	colonia: string;
};

export type LineaACotizar = {
	productoId: string;
	tallas: { size: string; piezas: number }[];
};

/** El taller no tiene envíos configurados: sólo queda recoger con él. */
export class SinEnvio extends Error {}

async function pedir<T>(ruta: string, opciones?: RequestInit): Promise<T> {
	// Dos reintentos ante un 429. El límite de Skydropx se mide por cuenta, no
	// por usuario: dos personas cotizando a la vez pueden chocar aunque
	// ninguna esté haciendo nada raro. Rendirse al primer 429 les rompería el
	// checkout a las dos.
	for (let intento = 0; ; intento++) {
		const res = await fetch(`${API}${ruta}`, {
			headers: { "content-type": "application/json" },
			...opciones,
		});

		if (res.ok) return res.json();

		if (res.status === 429 && intento < 2) {
			await new Promise((r) => setTimeout(r, 900 * (intento + 1)));
			continue;
		}

		const cuerpo = await res.json().catch(() => null);
		const mensaje = cuerpo?.message ?? `La API respondió ${res.status}`;
		// El checkout necesita distinguir "este taller no envía" de "algo
		// falló": lo primero se resuelve ofreciendo recoger, lo segundo no.
		if (mensaje.includes("no tiene envíos")) throw new SinEnvio(mensaje);
		throw new Error(mensaje);
	}
}

/**
 * Arranca la cotización y espera a que Skydropx termine de preguntar.
 *
 * Es asíncrona del lado de ellos: crear la cotización devuelve un id y las
 * tarifas van llegando durante unos cinco segundos. Se consulta cada segundo
 * y se devuelve lo que haya al completarse o al agotar los intentos — con
 * tarifas parciales se puede cotizar igual, y es mejor eso que una pantalla
 * que no termina nunca.
 *
 * `onParcial` permite ir pintando lo que llega en vez de esperar al final.
 */
export async function cotizarEnvio(
	lineas: LineaACotizar[],
	destino: DestinoEnvio,
	opciones?: { senal?: AbortSignal; onParcial?: (t: Tarifa[]) => void },
): Promise<{ cotizacionId: string; tarifas: Tarifa[] }> {
	const { id } = await pedir<{ id: string }>("/publico/envios/cotizar", {
		method: "POST",
		body: JSON.stringify({ lineas, destino }),
		signal: opciones?.senal,
	});

	let ultimas: Tarifa[] = [];

	for (let intento = 0; intento < 12; intento++) {
		await new Promise((r) => setTimeout(r, 1000));
		if (opciones?.senal?.aborted) break;

		const { lista, tarifas } = await pedir<{
			lista: boolean;
			tarifas: Tarifa[];
		}>(`/publico/envios/cotizacion/${id}`, { signal: opciones?.senal });

		ultimas = tarifas;
		if (tarifas.length > 0) opciones?.onParcial?.(tarifas);
		if (lista) break;
	}

	// El id se devuelve porque el pedido lo necesita: al crearlo se manda esta
	// cotización y la tarifa elegida, y la Lambda le pregunta el precio a
	// Skydropx en vez de creerle al navegador.
	return { cotizacionId: id, tarifas: ultimas };
}

/**
 * Las dos que de verdad se eligen: la más barata y la más rápida.
 *
 * Skydropx devuelve hasta ocho paqueterías y entre la primera y la última hay
 * catorce veces de diferencia. Enseñarlas todas convierte una decisión de dos
 * ejes —cuánto cuesta y cuánto tarda— en una tabla que nadie lee. Si la más
 * barata resulta ser también la más rápida, es una sola opción y no hay nada
 * que elegir.
 */
export function destacadas(tarifas: Tarifa[]) {
	if (tarifas.length === 0) return [];

	const porPrecio = [...tarifas].sort((a, b) => a.precio - b.precio);
	const barata = porPrecio[0];

	const conDias = tarifas.filter((t) => t.dias !== null);
	const rapida = [...conDias].sort(
		(a, b) => (a.dias ?? 99) - (b.dias ?? 99) || a.precio - b.precio,
	)[0];

	if (!rapida || rapida.id === barata.id) return [barata];
	// Si la más rápida además cuesta menos, la de "más barata" sobra.
	if (rapida.precio <= barata.precio) return [rapida];

	return [barata, rapida];
}
