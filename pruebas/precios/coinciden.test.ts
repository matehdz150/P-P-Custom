/**
 * Que lo que se ENSEÑA y lo que se COBRA sean el mismo número.
 *
 * Es el fallo que este cambio podía introducir: seis pantallas y dos Lambdas
 * calculando el recargo, y basta con que una se quede atrás.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { extraPorLados } from "../../packages/precios/src/index.ts";
import { precioDeHoy } from "../../services/compradores/src/rutas/pedidos.ts";

const PRODUCTO = {
	pricing: { basePrice: 150, perSidePrice: 60 },
	printSides: [
		{ sideKey: "front" },
		{ sideKey: "back" },
		{ sideKey: "sleeve_left", recargo: 20 },
		{ sideKey: "sleeve_right", recargo: 20 },
	],
};

/** Réplica de la línea de `aLinea`, para comparar contra la otra ruta. */
const comoALinea = (lados: string[]) =>
	Number(PRODUCTO.pricing.basePrice) +
	extraPorLados(lados, PRODUCTO.printSides, PRODUCTO.pricing);

const CASOS: string[][] = [
	["front"],
	["front", "back"],
	["front", "sleeve_left"],
	["front", "sleeve_left", "sleeve_right"],
	["front", "back", "sleeve_left", "sleeve_right"],
	["sleeve_left", "sleeve_right"],
	["sleeve_right", "front"],
];

test("aLinea y precioDeHoy cobran lo mismo en todos los casos", () => {
	for (const lados of CASOS) {
		assert.equal(
			precioDeHoy(PRODUCTO, lados),
			comoALinea(lados),
			`difieren en [${lados.join(", ")}]`,
		);
	}
});

test("los números concretos son los esperados", () => {
	assert.equal(comoALinea(["front"]), 150, "un lado: sólo la base");
	assert.equal(comoALinea(["front", "back"]), 210, "base + 60");
	assert.equal(comoALinea(["front", "sleeve_left"]), 170, "base + 20, no + 60");
	assert.equal(
		comoALinea(["front", "back", "sleeve_left", "sleeve_right"]),
		250,
		"base + espalda 60 + dos mangas 20 = 250, no 150 + 3x60 = 330",
	);
});

test("sin recargos propios, el precio es EXACTAMENTE el de antes", () => {
	const viejo = { pricing: { basePrice: 150, perSidePrice: 60 }, printSides: [{ sideKey: "front" }, { sideKey: "back" }] };
	for (let n = 1; n <= 4; n++) {
		const lados = ["front", "back", "c", "d"].slice(0, n);
		const antes = 150 + (n - 1) * 60;
		assert.equal(precioDeHoy(viejo, lados), antes, `con ${n} lados`);
	}
});
