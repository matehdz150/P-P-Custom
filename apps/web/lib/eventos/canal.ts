import { tokenVigente } from "@/lib/auth/cognito";

/**
 * El canal en vivo del panel del taller.
 *
 * Abre un WebSocket contra `kustto-eventos-ws` y llama a `alAviso` cada vez
 * que pasa algo. No trae datos: trae la noticia de que hay datos nuevos, y
 * quien escucha decide qué recargar.
 *
 * EL TOKEN VA EN LA URL porque `new WebSocket(url)` no admite cabeceras. Se
 * pide fresco en cada intento —no se guarda— para que al reconectar después
 * de una hora no se use uno ya caducado.
 */

const URL_WS = process.env.NEXT_PUBLIC_KUSTTO_WS ?? "";

export type AvisoDelTaller =
	| { tipo: "pedido-nuevo"; pedidoId: string; folio: string }
	| { tipo: "pedido-movido"; pedidoId: string; estado: string };

export type EstadoCanal = "conectando" | "conectado" | "desconectado";

/** Cortes de red, suspensiones del portátil, despliegues: reconectar es lo normal. */
const ESPERA_BASE_MS = 1_000;
const ESPERA_TOPE_MS = 30_000;

export type Canal = { cerrar: () => void };

/**
 * Abre el canal y devuelve cómo cerrarlo.
 *
 * Reconecta sola con espera creciente. El tope existe para que una caída
 * larga del servicio no acabe con cientos de pestañas intentándolo cada
 * segundo, que es como una caída pequeña se vuelve grande.
 */
export function abrirCanal(
	alAviso: (aviso: AvisoDelTaller) => void,
	alEstado?: (estado: EstadoCanal) => void,
): Canal {
	if (!URL_WS) {
		// Sin canal configurado el panel sigue funcionando: se ve lo que había
		// al abrirlo. Es peor callar que avisar en la consola.
		console.warn("Sin NEXT_PUBLIC_KUSTTO_WS: el panel no se actualizará solo.");
		return { cerrar: () => {} };
	}

	let socket: WebSocket | null = null;
	let intentos = 0;
	let cerrado = false;
	let reintento: ReturnType<typeof setTimeout> | null = null;

	const conectar = async () => {
		if (cerrado) return;

		alEstado?.("conectando");

		const token = await tokenVigente();

		// Sin sesión no hay a qué conectarse. No se reintenta en bucle: cuando
		// vuelva a haber sesión, el panel monta de nuevo y con él el canal.
		if (!token || cerrado) {
			alEstado?.("desconectado");
			return;
		}

		socket = new WebSocket(`${URL_WS}?token=${encodeURIComponent(token)}`);

		socket.onopen = () => {
			intentos = 0;
			alEstado?.("conectado");
		};

		socket.onmessage = (e) => {
			try {
				alAviso(JSON.parse(e.data));
			} catch {
				// Un mensaje que no entendemos no puede tumbar el canal.
			}
		};

		socket.onclose = () => {
			if (cerrado) return;
			alEstado?.("desconectado");

			// Espera creciente con un poco de azar: si se cae el servicio, mil
			// pestañas con el mismo reloj volverían todas a la vez.
			const espera = Math.min(ESPERA_BASE_MS * 2 ** intentos, ESPERA_TOPE_MS);
			intentos++;

			reintento = setTimeout(conectar, espera + Math.random() * 500);
		};

		// `onerror` siempre va seguido de `onclose`, así que reconectar se hace
		// en un solo sitio para no duplicar los intentos.
		socket.onerror = () => {};
	};

	void conectar();

	return {
		cerrar: () => {
			cerrado = true;
			if (reintento) clearTimeout(reintento);
			socket?.close();
		},
	};
}
