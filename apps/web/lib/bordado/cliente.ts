"use client";

import type {
	RespuestaDePreparacion,
	SolicitudDePreparacion,
} from "./protocolo";

/**
 * El lado del editor: manda a preparar y descarta lo que llega tarde.
 *
 * EL PROBLEMA QUE RESUELVE. El comprador mueve una letra mientras se prepara el
 * diseño anterior. Si esa respuesta se aplicara, en pantalla aparecería la vista
 * previa de un diseño que ya no existe, y peor: se crearía el trabajo remoto de
 * ESE diseño. Cada solicitud lleva una revisión y sólo se aplica la respuesta
 * cuya revisión es la vigente.
 *
 * DOS DEFENSAS, NO UNA:
 *
 *   1. `olvidar` sube el listón dentro del worker para que ni siquiera empiece
 *      lo que ya está obsoleto;
 *   2. al recibir se vuelve a comparar, porque el trabajo anterior pudo empezar
 *      antes de que llegara el aviso y no hay forma de interrumpirlo a media
 *      ejecución —el bucle es síncrono.
 *
 * `cancelar()` MATA EL WORKER de verdad. `terminate()` es lo único que detiene
 * un bucle síncrono ya empezado; sin él, "cancelar" sería sólo dejar de mirar
 * mientras la CPU sigue ocupada. El siguiente encargo levanta uno nuevo, que
 * cuesta unos milisegundos y es exactamente lo que hace falta para que el botón
 * de cancelar signifique algo.
 */

export type ClienteDeBordado = {
	preparar(
		solicitud: SolicitudDePreparacion,
		transferibles: ArrayBuffer[],
	): Promise<RespuestaDePreparacion | null>;
	cancelar(): void;
	destruir(): void;
};

export function crearClienteDeBordado(
	/* La ruta es un archivo estático precompilado por `scripts/construir-worker`,
	   NO un `new URL(..., import.meta.url)`. Con esa forma y `output: "export"`,
	   Next copia el `.ts` sin compilar y el navegador recibe TypeScript: el
	   worker no arranca y el panel se queda mudo al pulsar. */
	crearWorker: () => Worker = () => new Worker("/bordado/bordado.worker.js"),
): ClienteDeBordado {
	let worker: Worker | null = null;
	let revisionVigente = 0;
	let pendiente: ((r: RespuestaDePreparacion | null) => void) | null = null;

	const soltar = () => {
		const resolver = pendiente;
		pendiente = null;
		return resolver;
	};

	const asegurar = () => {
		if (worker) return worker;
		worker = crearWorker();
		worker.onmessage = (evento: MessageEvent<RespuestaDePreparacion>) => {
			const respuesta = evento.data;
			/* Se comprueba ANTES de tocar la promesa pendiente. Con el orden al revés
			   —soltar y luego comparar— una respuesta rezagada de A se llevaba por
			   delante la promesa de B, que es la vigente, y B se quedaba esperando
			   para siempre: el editor mostraba el spinner sin fin. */
			if (respuesta.revision !== revisionVigente) return;
			soltar()?.(respuesta);
		};
		worker.onerror = () => {
			/* Un `null` aquí dejaba al panel mudo: la promesa se resolvía sin
			   resultado, el componente devolvía temprano y el comprador veía que
			   pulsar no hacía nada. Si el worker no arranca hay que DECIRLO. */
			soltar()?.({
				revision: revisionVigente,
				estado: "error",
				mensaje: "No pudimos preparar el bordado en este navegador.",
			});
		};
		return worker;
	};

	return {
		preparar(solicitud, transferibles) {
			revisionVigente = solicitud.revision;
			// Lo anterior deja de importar: se avisa y se abandona su promesa.
			soltar()?.(null);
			const activo = asegurar();
			activo.postMessage({ tipo: "olvidar", revision: solicitud.revision });

			return new Promise((resolver) => {
				pendiente = resolver;
				activo.postMessage(
					{ tipo: "preparar", solicitud },
					{ transfer: transferibles },
				);
			});
		},
		cancelar() {
			soltar()?.(null);
			// Subir la revisión invalida cualquier respuesta que llegue después de
			// esto, incluida la del worker que se está matando.
			revisionVigente++;
			worker?.terminate();
			worker = null;
		},
		destruir() {
			soltar()?.(null);
			worker?.terminate();
			worker = null;
		},
	};
}
