import assert from "node:assert/strict";
import test from "node:test";
import { ErrorHttp } from "../lib/http.js";
import { leerDiseno } from "./eventos.js";

const EVENTO = { id: "evento-1" };
const PRODUCTO = {
	id: "item-1",
	personalizacion: "bloqueada",
	disenoBase: { arteId: "base-1", ruta: "/medios/base/diseno.json" },
};
const ID = "1a709cca-f952-4f81-95d8-7a6f3bd3418c";

const dependencias = (registro?: Record<string, unknown>) => ({
	buscar: async () => registro,
	comprobarArchivo: async () => undefined,
});

test("sin personalización propia conserva el diseño base congelado", async () => {
	assert.deepEqual(
		await leerDiseno(EVENTO, PRODUCTO, null, dependencias()),
		PRODUCTO.disenoBase,
	);
});

test("acepta sólo el diseño emitido para el mismo producto y comprueba S3", async () => {
	let comprobada = "";
	const resultado = await leerDiseno(
		EVENTO,
		PRODUCTO,
		{ carritoId: ID },
		{
			buscar: async (eventoId, disenoId) => {
				assert.equal(eventoId, EVENTO.id);
				assert.equal(disenoId, ID);
				return {
					eventoItemId: PRODUCTO.id,
					ruta: `/eventos/${EVENTO.id}/${PRODUCTO.id}/${ID}/diseno.json`,
				};
			},
			comprobarArchivo: async (ruta) => {
				comprobada = ruta;
			},
		},
	);
	assert.equal(comprobada, resultado?.ruta);
	assert.deepEqual(resultado, { carritoId: ID, ruta: comprobada });
});

for (const [nombre, producto, registro, archivo] of [
	[
		"otro producto",
		PRODUCTO,
		{ eventoItemId: "item-2", ruta: "/eventos/x/diseno.json" },
		true,
	],
	["referencia inexistente", PRODUCTO, undefined, true],
	[
		"ruta fuera de eventos",
		PRODUCTO,
		{ eventoItemId: PRODUCTO.id, ruta: "/medios/ajeno.json" },
		true,
	],
	[
		"ruta de otro evento",
		PRODUCTO,
		{
			eventoItemId: PRODUCTO.id,
			ruta: `/eventos/otro-evento/${PRODUCTO.id}/${ID}/diseno.json`,
		},
		true,
	],
	[
		"archivo que no terminó de subir",
		PRODUCTO,
		{
			eventoItemId: PRODUCTO.id,
			ruta: `/eventos/${EVENTO.id}/${PRODUCTO.id}/${ID}/diseno.json`,
		},
		false,
	],
	[
		"producto sin personalización",
		{ ...PRODUCTO, personalizacion: "sin_personalizacion" },
		undefined,
		true,
	],
] as const) {
	test(`rechaza ${nombre}`, async () => {
		await assert.rejects(
			leerDiseno(
				EVENTO,
				producto,
				{ carritoId: ID },
				{
					buscar: async () => registro,
					comprobarArchivo: async () => {
						if (!archivo) throw new Error("NoSuchKey");
					},
				},
			),
			(error) => error instanceof ErrorHttp && error.status === 400,
		);
	});
}
