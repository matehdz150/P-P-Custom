import assert from "node:assert/strict";
import test from "node:test";
import {
	construirSatinManual,
	EMBROIDERY_PROFILE_V3,
	recortarRamaEnJunctions,
	type Rama,
} from "./index";

function rama(overrides: Partial<Rama> = {}): Rama {
	return {
		puntos: [
			[10, 20],
			[25, 10],
			[40, 20],
			[55, 10],
		],
		anchosMm: [4, 4, 4, 4],
		pixeles: Array.from({ length: 500 }, (_, i) => i),
		largoMm: 54,
		grosorMedianoMm: 4,
		grosorMinimoMm: 4,
		grosorMaximoMm: 4,
		uniformidad: 1,
		cerrada: false,
		junctionInicio: false,
		junctionFin: false,
		...overrides,
	};
}

test("v3 emite dos rails y al menos tres rungs por segmento", () => {
	const segmentos = construirSatinManual(rama(), EMBROIDERY_PROFILE_V3);
	assert.ok(segmentos.length >= 2, "una curva larga se subdivide");
	for (const segmento of segmentos) {
		assert.ok((segmento.d.match(/M/g) ?? []).length >= 5);
		assert.ok(segmento.quality.maxAngleDeltaDeg <= 55);
	}
});

test("los endpoints libres terminan con taper gradual", () => {
	const [primero] = construirSatinManual(
		rama({
			puntos: [
				[10, 20],
				[30, 20],
			],
			anchosMm: [4, 4],
			largoMm: 20,
		}),
		EMBROIDERY_PROFILE_V3,
	);
	assert.ok(primero.quality.minWidthMm < primero.quality.maxWidthMm);
	assert.ok(primero.quality.minWidthMm >= 0.65);
});

test("un junction se recorta también de la cobertura", () => {
	const original = rama({ junctionInicio: true });
	const recortada = recortarRamaEnJunctions(original, EMBROIDERY_PROFILE_V3);
	assert.ok(
		recortada.puntos.length < original.puntos.length ||
			recortada.largoMm < original.largoMm,
	);
	assert.ok(recortada.pixeles.length < original.pixeles.length);
	assert.equal(recortada.junctionInicio, true);
});
