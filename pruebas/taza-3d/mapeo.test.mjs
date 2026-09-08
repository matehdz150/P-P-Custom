// node --experimental-strip-types --test pruebas/taza-3d/mapeo.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { mapeoTaza } from "../../apps/web/lib/prenda/mapeoTaza.ts";

const cerca = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test("sin foto: área completa sin contain, preservando proporción del raster", () => {
	for (const proporcion of [1, 21 / 8, 4, 8]) {
		const m = mapeoTaza({ proporcion });
		cerca(2 * Math.PI * m.radio / m.altoBanda, proporcion);
		cerca(m.escalaVertical * 0.077, m.altoBanda);
		assert.equal(m.calibrado, false);
	}
});

test("el centro de cada foto queda delante; derecha e izquierda no se invierten", () => {
	for (const centro of [0, 0.25, 0.5, 0.8, 1]) {
		const m = mapeoTaza({ proporcion: 21 / 8, centro });
		cerca(Math.sin(2 * Math.PI * centro + m.giro), 0);
		cerca(Math.cos(2 * Math.PI * centro + m.giro), 1);
		assert.ok(Math.sin(2 * Math.PI * (centro + 0.1) + m.giro) > 0);
		assert.ok(Math.sin(2 * Math.PI * (centro - 0.1) + m.giro) < 0);
	}
});

test("posición y tamaño proyectados coinciden con componerCilindro, incluido bombeo", () => {
	for (const centro of [0.05, 0.5, 0.85]) {
		for (const bombeo of [-0.12, 0, 0.15]) {
			const banda = { izquierda: 0.2, derecha: 0.8, arriba: 0.15, abajo: 0.85, centro, bombeo };
			const referencia = { anchoFoto: 1000, altoFoto: 800, banda };
			const m = mapeoTaza({ proporcion: 21 / 8, centro, referencia });
			assert.equal(m.calibrado, true);
			const anchoPx = 600;
			const altoPx = 560;
			const pixelsPorMetro = anchoPx / (2 * m.radio);
			for (const offset of [-0.24, -0.1, 0, 0.1, 0.24]) {
				for (const v of [0, 0.2, 0.5, 0.8, 1]) {
					const theta = 2 * Math.PI * offset;
					const x = m.radio * Math.sin(theta);
					const z = m.radio * Math.cos(theta);
					const y = (0.5 - v) * m.altoBanda;
					const fotoX = anchoPx * (Math.sin(theta) + 1) / 2;
					const fotoY = v * altoPx + bombeo * altoPx * Math.cos(theta);
					cerca(x * pixelsPorMetro + anchoPx / 2, fotoX);
					cerca((-y * Math.cos(m.elevacion) + z * Math.sin(m.elevacion)) * pixelsPorMetro + altoPx / 2, fotoY);
				}
			}
		}
	}
});

test("calibración inválida cae a la proporción del arte sin NaN", () => {
	for (const derecha of [0.2, NaN]) {
		const m = mapeoTaza({ proporcion: 21 / 8, referencia: {
			anchoFoto: 1000, altoFoto: 800,
			banda: { izquierda: 0.2, derecha, arriba: 0.15, abajo: 0.85, bombeo: 0.1 },
		} });
		assert.equal(m.calibrado, false);
		cerca(2 * Math.PI * m.radio / m.altoBanda, 21 / 8);
	}
});
