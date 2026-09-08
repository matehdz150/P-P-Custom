import assert from "node:assert/strict";
import test from "node:test";
import {
	componentes,
	distanciaAlFondo,
	esqueleto,
	type Rejilla,
	ramas,
	sobranteDe,
} from "./index";

function rejilla(
	ancho: number,
	alto: number,
	mmPorPx: number,
	pintar: (x: number, y: number) => boolean,
): Rejilla {
	const datos = new Uint8Array(ancho * alto);
	for (let y = 0; y < alto; y++) {
		for (let x = 0; x < ancho; x++) datos[y * ancho + x] = pintar(x, y) ? 1 : 0;
	}
	return { datos, ancho, alto, mmPorPx };
}

/**
 * Una "H" de asta 2 mm: dos astas de 20 mm y un travesaño de 12 mm, a 0.1 mm/px.
 * Es el caso que motiva todo el archivo: un solo componente conexo que en
 * realidad son tres columnas.
 */
function eme() {
	return rejilla(160, 200, 0.1, (x, y) => {
		const izq = x >= 0 && x < 20;
		const der = x >= 140 && x < 160;
		const travesano = y >= 90 && y < 110;
		return izq || der || travesano;
	});
}

test("el esqueleto de una barra es una línea de un píxel", () => {
	const r = rejilla(41, 200, 0.1, () => true);
	const { datos: hueso, convergio } = esqueleto(r);
	assert.equal(convergio, true, "una barra converge de sobra");

	// El esqueleto de un rectángulo no llega a las puntas: se para a media
	// anchura de cada extremo. De eso se encarga la prolongación de `ramas`.
	for (let y = 21; y < 179; y++) {
		let cuenta = 0;
		for (let x = 0; x < 41; x++) if (hueso[y * 41 + x]) cuenta++;
		assert.ok(cuenta <= 2, `fila ${y} tiene ${cuenta} píxeles de esqueleto`);
		assert.ok(cuenta >= 1, `fila ${y} se quedó sin esqueleto`);
	}
});

test("una H se parte en las tres astas y no en una mancha", () => {
	const r = eme();
	const partes = componentes(r);
	assert.equal(partes.length, 1, "la H es un solo componente conexo");

	const d = distanciaAlFondo(r);
	const rr = ramas(r, partes[0], d, 0.12);

	// Tres astas, más los rabillos cortos que el esqueleto deja en los cuatro
	// extremos y en los dos cruces.
	const largas = rr.filter((rama) => rama.largoMm > 5);
	assert.equal(
		largas.length,
		3,
		`ramas largas: ${largas.map((x) => x.largoMm.toFixed(1))}`,
	);

	for (const rama of largas) {
		assert.ok(
			Math.abs(rama.grosorMedianoMm - 2) < 0.5,
			`asta de ${rama.grosorMedianoMm.toFixed(2)} mm`,
		);
		assert.ok(rama.uniformidad > 0.6, `uniformidad ${rama.uniformidad}`);
	}
});

test("el sobrante de una H son los nudos, no media letra", () => {
	const r = eme();
	const partes = componentes(r);
	const d = distanciaAlFondo(r);
	const rr = ramas(r, partes[0], d, 0.12).filter((x) => x.largoMm > 5);

	const areaTotal = partes[0].pixeles.length * 0.01;
	const sobra = sobranteDe(r, partes[0], d, rr);
	const areaSobrante = sobra.reduce((s, c) => s + c.pixeles.length * 0.01, 0);

	assert.ok(
		areaSobrante / areaTotal < 0.15,
		`las columnas deberían cubrir la letra; sobra ${((areaSobrante / areaTotal) * 100).toFixed(1)}%`,
	);
});

test("una O da una sola rama cerrada", () => {
	// Anillo de 2 mm de grosor y 16 mm de diámetro.
	const r = rejilla(200, 200, 0.1, (x, y) => {
		const d = Math.hypot(x - 100, y - 100);
		return d < 80 && d > 60;
	});
	const partes = componentes(r);
	const rr = ramas(r, partes[0], distanciaAlFondo(r), 0.12);

	assert.equal(rr.length, 1);
	assert.equal(rr[0].cerrada, true);
	assert.ok(Math.abs(rr[0].grosorMedianoMm - 2) < 0.5);
	// El perímetro medio del anillo: 2*pi*7 mm.
	assert.ok(rr[0].largoMm > 35 && rr[0].largoMm < 50, `largo ${rr[0].largoMm}`);
});

test("una I da una sola rama abierta del alto de la letra", () => {
	const r = rejilla(60, 300, 0.1, (x) => x >= 20 && x < 40);
	const partes = componentes(r);
	const rr = ramas(r, partes[0], distanciaAlFondo(r), 0.12).filter(
		(x) => x.largoMm > 5,
	);

	assert.equal(rr.length, 1);
	assert.equal(rr[0].cerrada, false);
	assert.ok(rr[0].largoMm > 24, `largo ${rr[0].largoMm}`);
});

test("si el adelgazamiento no converge no se inventan ramas", () => {
	/* Un bloque macizo con el tope de pasadas muy bajo: el esqueleto queda a
	   medio hacer. Devolver ESO como esqueleto era el fallo que hacía que un
	   icono geométrico produjera 51 766 ramas de 29 607 píxeles y agotara el
	   presupuesto; la respuesta correcta es no devolver ninguna, para que quien
	   llama lo cosa de relleno, que es lo que le toca a un bloque de ese grosor. */
	// Una barra gruesa: su eje ES una línea, así que si sale vacío es por la
	// convergencia y no porque la forma no tenga eje (un disco se adelgaza a un
	// punto y también daría cero, y entonces la prueba no probaría nada).
	const r = rejilla(80, 400, 0.1, (x) => x >= 10 && x < 70);
	const partes = componentes(r);
	const d = distanciaAlFondo(r);

	const cortas = ramas(r, partes[0], d, 0.12, undefined, {
		maxPixelesPrimerPlano: 1e9,
		maxComponentes: 1e9,
		maxPixelesEsqueleto: 1e9,
		maxRamas: 1e9,
		maxComparacionesFusion: 1e9,
		maxPasadasAdelgazado: 3,
	});
	assert.equal(cortas.length, 0, "sin convergencia, ninguna rama");

	// Con pasadas de sobra el mismo disco sí da su eje.
	const largas = ramas(r, partes[0], d, 0.12);
	assert.ok(largas.length >= 1, "con pasadas suficientes sí hay eje");
});
