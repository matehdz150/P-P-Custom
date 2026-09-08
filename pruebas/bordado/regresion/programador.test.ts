/**
 * Que preparar solo no se traduzca en correr el motor sin control.
 *
 * Lo que se comprueba aquí es lo que cuesta dinero: cuántas veces llega a
 * ejecutarse el motor cuando el comprador está editando.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { crearProgramador } from "../../../apps/web/lib/bordado/programador.ts";

/** Un reloj falso: nada de esperar de verdad en una prueba. */
function reloj() {
	let siguiente = 1;
	const pendientes = new Map<number, { fn: () => void; en: number }>();
	let ahora = 0;
	return {
		poner: (fn: () => void, ms: number) => {
			const id = siguiente++;
			pendientes.set(id, { fn, en: ahora + ms });
			return id;
		},
		quitar: (id: number) => void pendientes.delete(id),
		avanzar(ms: number) {
			ahora += ms;
			for (const [id, t] of [...pendientes])
				if (t.en <= ahora) {
					pendientes.delete(id);
					t.fn();
				}
		},
	};
}

const OPCIONES = { espera: 100, esperaLarga: 1000, antesDeFrenar: 3 };

test("una ráfaga de ediciones prepara UNA sola vez", () => {
	let veces = 0;
	const r = reloj();
	const p = crearProgramador(() => veces++, OPCIONES, r.poner, r.quitar);

	// Diez cambios seguidos, como quien arrastra un logo por el lienzo.
	for (let i = 0; i < 10; i++) {
		p.programar(true);
		r.avanzar(20);
	}
	assert.equal(veces, 0, "no puede preparar mientras sigue editando");

	r.avanzar(100);
	assert.equal(veces, 1, "al parar, una vez y sólo una");
});

test("sin contenido no prepara, y borrar cancela lo programado", () => {
	let veces = 0;
	const r = reloj();
	const p = crearProgramador(() => veces++, OPCIONES, r.poner, r.quitar);

	p.programar(false);
	r.avanzar(500);
	assert.equal(veces, 0, "un lado vacío no dispara `capturar`, que lanzaría");

	/* Escribir y borrarlo todo antes de que venza: lo programado tiene que
	   morir, o saltaría el error de «agrega texto o un logo» sin haber tocado
	   nada desde entonces. */
	p.programar(true);
	r.avanzar(50);
	p.programar(false);
	r.avanzar(500);
	assert.equal(veces, 0, "borrar el contenido cancela la preparación pendiente");
});

test("el freno alarga la espera, pero nunca deja de preparar", () => {
	let veces = 0;
	const r = reloj();
	const p = crearProgramador(() => veces++, OPCIONES, r.poner, r.quitar);

	// Tres diseños distintos llegan al motor: se alcanza el freno.
	for (let i = 0; i < 3; i++) {
		p.programar(true);
		r.avanzar(100);
		p.contar();
	}
	assert.equal(veces, 3);

	p.programar(true);
	r.avanzar(100);
	assert.equal(veces, 3, "con el freno puesto, la espera corta ya no basta");

	r.avanzar(900);
	assert.equal(veces, 4, "pero acaba preparando: el freno no puede acorralar");
});

test("cancelar deja el programador en silencio", () => {
	let veces = 0;
	const r = reloj();
	const p = crearProgramador(() => veces++, OPCIONES, r.poner, r.quitar);

	p.programar(true);
	p.cancelar();
	r.avanzar(500);
	assert.equal(veces, 0);
});
