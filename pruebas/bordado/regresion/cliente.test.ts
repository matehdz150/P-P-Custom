/**
 * La protección contra respuestas viejas.
 *
 * EL FALLO QUE EVITA. El comprador pide preparar el diseño A, lo cambia a B
 * mientras se calcula, y la respuesta de A llega después. Sin esta protección
 * en pantalla aparecería la vista previa de A —un diseño que ya no existe— y,
 * peor, se crearía el trabajo remoto de A. El comprador acabaría con una prenda
 * bordada con lo que borró.
 *
 * El worker se sustituye por uno de mentira: aquí se prueba el protocolo, no el
 * pipeline, y así la prueba corre en node en milisegundos.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { crearClienteDeBordado } from "@/lib/bordado/cliente";
import type {
	MensajeAlWorker,
	RespuestaDePreparacion,
	SolicitudDePreparacion,
} from "@/lib/bordado/protocolo";

/** Un worker que contesta cuando se le dice, no cuando quiere. */
function workerDeMentira() {
	const pendientes: SolicitudDePreparacion[] = [];
	const olvidos: number[] = [];
	let alRecibir: ((evento: { data: RespuestaDePreparacion }) => void) | null =
		null;
	let muerto = false;

	const worker = {
		postMessage(mensaje: MensajeAlWorker) {
			if (muerto) return;
			if (mensaje.tipo === "olvidar") olvidos.push(mensaje.revision);
			else pendientes.push(mensaje.solicitud);
		},
		terminate() {
			muerto = true;
		},
		set onmessage(fn: (evento: { data: RespuestaDePreparacion }) => void) {
			alRecibir = fn;
		},
		set onerror(_fn: unknown) {},
	} as unknown as Worker;

	return {
		worker,
		pendientes,
		olvidos,
		get muerto() {
			return muerto;
		},
		/** Contesta a la solicitud que se indique, en el orden que se quiera. */
		responder(indice: number) {
			const solicitud = pendientes[indice];
			if (!solicitud || muerto) return;
			alRecibir?.({
				data: {
					revision: solicitud.revision,
					estado: "rechazado",
					incidencias: [
						{
							code: `RESPUESTA_${solicitud.revision}`,
							message: `soy la revisión ${solicitud.revision}`,
							severity: "review",
						},
					],
					tiempos: {},
				},
			});
		},
	};
}

function solicitud(revision: number): SolicitudDePreparacion {
	return {
		revision,
		productId: "p",
		sideId: "front",
		widthMm: 70,
		heightMm: 50,
		sourceSnapshotHash: "a".repeat(64),
		fuentes: [],
	};
}

test("una respuesta de una revisión vieja no se aplica", async () => {
	const falso = workerDeMentira();
	const cliente = crearClienteDeBordado(() => falso.worker);

	// A empieza.
	const a = cliente.preparar(solicitud(1), []);
	// El comprador cambia el diseño: B toma el relevo.
	const b = cliente.preparar(solicitud(2), []);

	// A termina AHORA, tarde.
	falso.responder(0);
	assert.equal(await a, null, "la promesa de A no debe traer resultado");

	// Y B contesta después.
	falso.responder(1);
	const resultado = await b;
	assert.ok(resultado, "B sí debe traer resultado");
	assert.equal(resultado.revision, 2);
	assert.equal(
		resultado.estado === "rechazado" && resultado.incidencias[0].code,
		"RESPUESTA_2",
		"debe prevalecer B",
	);

	cliente.destruir();
});

test("el worker recibe el aviso de olvidar antes de la nueva solicitud", async () => {
	const falso = workerDeMentira();
	const cliente = crearClienteDeBordado(() => falso.worker);

	cliente.preparar(solicitud(1), []);
	cliente.preparar(solicitud(2), []);

	assert.deepEqual(
		falso.olvidos,
		[1, 2],
		"cada encargo sube el listón dentro del worker",
	);
	cliente.destruir();
});

test("cancelar mata el worker y suelta la promesa", async () => {
	const falso = workerDeMentira();
	const cliente = crearClienteDeBordado(() => falso.worker);

	const a = cliente.preparar(solicitud(1), []);
	cliente.cancelar();

	assert.equal(await a, null, "cancelar suelta la promesa sin resultado");
	assert.equal(
		falso.muerto,
		true,
		"terminate() es lo único que detiene un bucle síncrono ya empezado",
	);
	cliente.destruir();
});

test("después de cancelar, una respuesta rezagada tampoco se aplica", async () => {
	const falso = workerDeMentira();
	const cliente = crearClienteDeBordado(() => falso.worker);

	const a = cliente.preparar(solicitud(1), []);
	cliente.cancelar();
	// El worker muerto ya no contesta, pero aunque lo hiciera la revisión subió.
	falso.responder(0);

	assert.equal(await a, null);
	cliente.destruir();
});

test("tras cancelar se levanta un worker nuevo para el siguiente encargo", async () => {
	let creados = 0;
	const workers: ReturnType<typeof workerDeMentira>[] = [];
	const cliente = crearClienteDeBordado(() => {
		creados++;
		const nuevo = workerDeMentira();
		workers.push(nuevo);
		return nuevo.worker;
	});

	cliente.preparar(solicitud(1), []);
	cliente.cancelar();
	const b = cliente.preparar(solicitud(5), []);

	assert.equal(creados, 2, "el worker muerto no se reutiliza");
	workers[1].responder(0);
	const resultado = await b;
	assert.equal(resultado?.revision, 5);
	cliente.destruir();
});
