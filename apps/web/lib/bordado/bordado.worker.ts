/// <reference lib="webworker" />

import { BordadoRechazado, preparar } from "./preparar";
import type { MensajeAlWorker, RespuestaDePreparacion } from "./protocolo";

/**
 * El worker de bordado.
 *
 * ESTO EXISTE PORQUE LA PREPARACIÓN TARDA SEGUNDOS. Medido sobre el corpus: 1 s
 * de mediana, casi 10 en el peor caso admitido. En el hilo principal eso son
 * segundos sin scroll, sin spinner girando y sin poder cancelar; el editor
 * parece colgado y el comprador recarga la página.
 *
 * DESCARTA LO VIEJO ÉL MISMO. El cliente ya comprueba la revisión al recibir,
 * pero comprobarla también aquí evita gastar diez segundos de CPU en un diseño
 * que el comprador cambió hace rato. Es el único momento en que se puede: una
 * vez dentro de `preparar`, el bucle es síncrono y no hay forma de interrumpirlo
 * —de eso se encargan los presupuestos del perfil, no un mensaje.
 */

const worker = self as unknown as DedicatedWorkerGlobalScope;

let minimaRevision = 0;

worker.onmessage = (evento: MessageEvent<MensajeAlWorker>) => {
	const mensaje = evento.data;

	if (mensaje.tipo === "olvidar") {
		minimaRevision = Math.max(minimaRevision, mensaje.revision);
		return;
	}

	const { solicitud } = mensaje;
	if (solicitud.revision < minimaRevision) return;
	minimaRevision = solicitud.revision;

	const responder = (respuesta: RespuestaDePreparacion) => {
		worker.postMessage(respuesta);
	};

	try {
		const { design, tiempos } = preparar(solicitud);
		responder({
			revision: solicitud.revision,
			estado: "listo",
			design,
			// `preparation` va suelto además de dentro del diseño para que la UI no
			// tenga que abrir el diseño entero sólo para saber qué avisar.
			preparation: design.preparation ?? {
				profileVersion: design.profileVersion,
				issues: [],
			},
			metrics: design.metrics,
			tiempos,
		});
	} catch (error) {
		if (error instanceof BordadoRechazado) {
			responder({
				revision: solicitud.revision,
				estado: "rechazado",
				incidencias: error.incidencias,
				tiempos: {},
			});
			return;
		}
		responder({
			revision: solicitud.revision,
			estado: "error",
			mensaje:
				error instanceof Error
					? error.message
					: "No pudimos preparar el bordado",
		});
	}
};
