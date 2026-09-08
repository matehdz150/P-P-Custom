import assert from "node:assert/strict";
import test from "node:test";
import { extraPorLados, recargoDeLado } from "./index";

const PLAYERA = [
	{ sideKey: "front" },
	{ sideKey: "back" },
	{ sideKey: "sleeve_left", recargo: 20 },
	{ sideKey: "sleeve_right", recargo: 20 },
];
const PRECIOS = { perSidePrice: 60 };

test("ningún producto de hoy cambia de precio", () => {
	// Sin recargos propios, la regla vieja era (n - 1) * perSidePrice.
	const planos = [{ sideKey: "front" }, { sideKey: "back" }];
	assert.equal(extraPorLados(["front"], planos, PRECIOS), 0);
	assert.equal(extraPorLados(["front", "back"], planos, PRECIOS), 60);
	assert.equal(
		extraPorLados(["front", "back", "x"], planos, PRECIOS),
		120,
		"un lado sin declarar cae al global, como antes",
	);
});

test("una manga cuesta lo suyo, no lo que una espalda", () => {
	assert.equal(extraPorLados(["front", "sleeve_left"], PLAYERA, PRECIOS), 20);
	assert.equal(
		extraPorLados(["front", "sleeve_left", "sleeve_right"], PLAYERA, PRECIOS),
		40,
		"dos mangas sobre el frente son 20 + 20, no 2 x 60",
	);
	assert.equal(
		extraPorLados(["front", "back", "sleeve_left"], PLAYERA, PRECIOS),
		80,
		"espalda 60 + manga 20",
	);
});

test("el total NO depende del orden en que se eligieron los lados", () => {
	const a = extraPorLados(["sleeve_left", "front"], PLAYERA, PRECIOS);
	const b = extraPorLados(["front", "sleeve_left"], PLAYERA, PRECIOS);
	assert.equal(a, b, "si dependiera del orden se podría abaratar reordenando");
	assert.equal(a, 20);
});

test("el base absorbe el lado más caro", () => {
	/* Sólo mangas: se absorbe una y se cobra la otra. Si se absorbiera "la
	   primera de la lista del producto" —el frente, que no está elegido— se
	   cobrarían las dos. */
	assert.equal(
		extraPorLados(["sleeve_left", "sleeve_right"], PLAYERA, PRECIOS),
		20,
	);
});

test("un recargo de 0 es una decisión, no un hueco", () => {
	const conGratis = [{ sideKey: "front" }, { sideKey: "bolsillo", recargo: 0 }];
	assert.equal(
		recargoDeLado("bolsillo", conGratis, PRECIOS),
		0,
		"cero no puede caerse al global: el taller dijo que va incluido",
	);
	assert.equal(extraPorLados(["front", "bolsillo"], conGratis, PRECIOS), 0);
});

test("no se cuela basura de la tabla", () => {
	const raros = [
		{ sideKey: "a", recargo: Number.NaN },
		{ sideKey: "b", recargo: -50 },
	];
	assert.equal(recargoDeLado("a", raros, PRECIOS), 0);
	assert.equal(recargoDeLado("b", raros, PRECIOS), 0, "un recargo negativo no descuenta");
	assert.equal(extraPorLados(["a", "b"], raros, PRECIOS), 0);
});
