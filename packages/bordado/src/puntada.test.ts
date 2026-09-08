import assert from "node:assert/strict";
import test from "node:test";
import {
	comoPathCompuesto,
	componentes,
	contornos,
	decidirPuntada,
	distanciaAlFondo,
	EMBROIDERY_PROFILE_V2,
	ejeCentral,
	medir,
	type Rejilla,
	simplificar,
} from "./index";

/**
 * Las formas se dibujan a mano sobre la rejilla y NO se importan de un PNG.
 *
 * Así la prueba dice en su propio texto cuántos milímetros mide lo que está
 * midiendo: un fallo señala la regla, no un archivo binario que hay que abrir
 * para entender qué se rompió.
 */
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

function medirUnica(r: Rejilla) {
	const partes = componentes(r);
	assert.equal(partes.length, 1, "la prueba espera un solo componente");
	return medir(r, partes[0], distanciaAlFondo(r));
}

const perfil = EMBROIDERY_PROFILE_V2;

test("una barra estrecha y larga es una columna satin", () => {
	// 2 mm de ancho por 30 de alto, a 0.1 mm/px.
	const r = rejilla(60, 300, 0.1, (x) => x >= 20 && x < 40);
	const m = medirUnica(r);

	assert.ok(
		Math.abs(m.grosorMedianoMm - 2) < 0.35,
		`grosor medido ${m.grosorMedianoMm}`,
	);
	assert.ok(m.uniformidad > 0.9, `uniformidad ${m.uniformidad}`);

	const d = decidirPuntada(m, perfil);
	assert.equal(d.tipo, "satin");
	assert.ok(d.strokeWidthMm && d.strokeWidthMm > 1.5 && d.strokeWidthMm < 2.5);
});

test("un trazo por debajo del milímetro se cose como running", () => {
	// 0.6 mm de ancho.
	const r = rejilla(60, 300, 0.1, (x) => x >= 20 && x < 26);
	const d = decidirPuntada(medirUnica(r), perfil);
	assert.equal(d.tipo, "running");
});

test("un bloque ancho y cuadrado se cose como fill, no como satin", () => {
	// 20 x 20 mm: uniforme, pero ni alargado ni dentro del rango de columna.
	const r = rejilla(200, 200, 0.1, () => true);
	const m = medirUnica(r);
	const d = decidirPuntada(m, perfil);

	assert.equal(d.tipo, "fill");
	assert.ok(m.grosorMedianoMm > perfil.geometria.maxGrosorSatinMm);
});

test("una columna uniforme pero demasiado ancha cae a fill y lo avisa", () => {
	// 12 mm de ancho por 60 de largo: es columna, pero de 12 mm no se hace satin.
	const r = rejilla(200, 600, 0.1, (x) => x >= 40 && x < 160);
	const d = decidirPuntada(medirUnica(r), perfil);

	assert.equal(d.tipo, "fill");
	assert.ok(
		d.incidencias.some((i) => i.code === "COLUMNA_DEMASIADO_ANCHA"),
		"debe avisar de la columna ancha",
	);
});

test("una región por debajo del área mínima no es fabricable", () => {
	// 0.5 x 0.5 mm = 0.25 mm2, por debajo de los 0.75 del perfil.
	const r = rejilla(20, 20, 0.1, (x, y) => x < 5 && y < 5);
	const d = decidirPuntada(medirUnica(r), perfil);

	assert.equal(d.fabricable, false);
	assert.ok(d.incidencias.some((i) => i.code === "REGION_DEMASIADO_PEQUENA"));
});

test("un texto más bajo que el mínimo se rechaza por ilegible", () => {
	// 2 mm de ancho por 4 de alto: geometría válida, altura insuficiente.
	const r = rejilla(60, 40, 0.1, (x) => x >= 20 && x < 40);
	const d = decidirPuntada(medirUnica(r), perfil, { esTexto: true });

	assert.ok(
		d.incidencias.some(
			(i) => i.code === "TEXTO_DEMASIADO_PEQUENO" && i.severity === "reject",
		),
		"la altura insuficiente debe rechazar",
	);
});

test("una serif con asta demasiado fina se rechaza aunque sea alta", () => {
	// 0.6 mm de asta y 30 mm de alto: alta pero irrepresentable.
	const r = rejilla(60, 300, 0.1, (x) => x >= 20 && x < 26);
	const d = decidirPuntada(medirUnica(r), perfil, { esTexto: true });

	assert.ok(
		d.incidencias.some(
			(i) => i.code === "ASTA_DEMASIADO_FINA" && i.severity === "reject",
		),
	);
});

test("una contraforma minúscula se marca para revisión", () => {
	// Anillo de 12 mm con un agujero de 0.6 mm de diámetro (0.28 mm2).
	const r = rejilla(120, 120, 0.1, (x, y) => {
		const dx = x - 60;
		const dy = y - 60;
		const d = Math.hypot(dx, dy);
		return d < 60 && d > 3;
	});
	const m = medirUnica(r);
	const d = decidirPuntada(m, perfil, { esTexto: true });

	assert.ok(m.huecosMm2.length >= 1, "debe encontrar el hueco");
	assert.ok(d.incidencias.some((i) => i.code === "CONTRAFORMA_PEQUENA"));
});

test("las contraformas grandes no generan incidencia", () => {
	// Anillo con un agujero de 8 mm de diámetro: se borda sin problema.
	const r = rejilla(200, 200, 0.1, (x, y) => {
		const d = Math.hypot(x - 100, y - 100);
		return d < 100 && d > 40;
	});
	const d = decidirPuntada(medirUnica(r), perfil, { esTexto: true });
	assert.ok(!d.incidencias.some((i) => i.code === "CONTRAFORMA_PEQUENA"));
});

test("componentes separa las partes y no las une por una diagonal rota", () => {
	const r = rejilla(100, 20, 0.1, (x) => x < 20 || x > 60);
	assert.equal(componentes(r).length, 2);
});

test("la simplificación respeta la tolerancia en milímetros", () => {
	// Una recta con ruido de 0.05 mm: con tolerancia 0.12 mm debe quedar en dos.
	const puntos: Array<[number, number]> = [];
	for (let i = 0; i <= 40; i++) puntos.push([i * 0.5, i % 2 ? 0.05 : 0]);

	assert.equal(simplificar(puntos, 0.12).length, 2);
	assert.ok(simplificar(puntos, 0.01).length > 2);
});

test("el mismo dibujo cambia de veredicto según a cuántos mm se borde", () => {
	// La MISMA barra de 40x400 px: a 0.1 mm/px mide 4 mm de ancho y es una columna
	// satin; a 0.02 mide 0.8 mm y ahí no cabe columna ninguna, va de running.
	// Es la razón de que todo esté en mm y no en píxeles.
	const grande = rejilla(80, 440, 0.1, (x) => x >= 20 && x < 60);
	const chica = rejilla(80, 440, 0.02, (x) => x >= 20 && x < 60);

	assert.equal(decidirPuntada(medirUnica(grande), perfil).tipo, "satin");
	assert.equal(decidirPuntada(medirUnica(chica), perfil).tipo, "running");
});

test("el eje de una columna es su línea central, no su contorno", () => {
	// Barra vertical de 2 x 30 mm centrada en x = 3 mm.
	const r = rejilla(60, 300, 0.1, (x) => x >= 20 && x < 40);
	const partes = componentes(r);
	const eje = ejeCentral(r, partes[0], distanciaAlFondo(r), 0.12);

	assert.ok(eje.length >= 2, "debe haber eje");
	// Todos los puntos cerca del centro horizontal: si fuera el contorno habría
	// puntos en x=2 y en x=4 a la vez.
	for (const [x] of eje) {
		assert.ok(Math.abs(x - 2.95) < 0.4, `punto fuera del eje: x=${x}`);
	}
	// Y recorre casi todo el alto.
	const ys = eje.map(([, y]) => y);
	assert.ok(Math.max(...ys) - Math.min(...ys) > 25);
});

test("el relleno de un anillo lleva su contraforma como subtrazado", () => {
	const r = rejilla(200, 200, 0.1, (x, y) => {
		const d = Math.hypot(x - 100, y - 100);
		return d < 100 && d > 40;
	});
	const c = contornos(r, componentes(r)[0], 0.12);

	assert.equal(c.huecos.length, 1, "el anillo tiene un agujero");
	const d = comoPathCompuesto(c);
	assert.equal(
		(d.match(/M/g) ?? []).length,
		2,
		"exterior y hueco son dos subtrazados",
	);
});

test("un hueco por debajo del mínimo no se recorta del relleno", () => {
	// Mismo anillo pero con el agujero de 0.6 mm: recortarlo produciría un
	// salto de hilo por una contraforma que se va a cerrar sola.
	const r = rejilla(120, 120, 0.1, (x, y) => {
		const d = Math.hypot(x - 60, y - 60);
		return d < 60 && d > 3;
	});
	const c = contornos(r, componentes(r)[0], 0.12, 0.8);
	assert.equal(c.huecos.length, 0);
});
