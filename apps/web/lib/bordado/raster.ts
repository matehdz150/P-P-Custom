"use client";

import {
	type CosteDeEsqueleto,
	componentes,
	costeVacio,
	type EmbroideryIssue,
	type EmbroideryObject,
	type EmbroideryPreparation,
	type EmbroideryProfile,
	esPresupuestoExcedido,
	exigir,
	incidenciaDeComplejidad,
	limpiar,
} from "@kustto/bordado";
import type { FabricObject } from "fabric";
import { aLab, fondoDe, otsu } from "@/lib/impresion/mascara";
import { colorIdDe } from "./color";
import { type Cronometro, crearCronometro } from "./cronometro";
import { objetosDeMascara } from "./formas";
import { comoLa, lienzoEnMm } from "./rejilla";

/**
 * Un PNG o un JPG del editor, preparado para bordarse.
 *
 * NO ES EL PIPELINE DEL LÁSER. Ahí el objetivo es un contorno fiel que una
 * máquina pueda seguir con un cabezal, y por eso se vectoriza a una sola tinta
 * conservando hasta el antialias. Un bordado no puede hacer eso: cada color es
 * un hilo que alguien enhebra, cada región es una parada, y un detalle de medio
 * milímetro no es un detalle sino un nido. La preparación de aquí REDUCE a
 * propósito —paleta corta, regiones mínimas en milímetros, fondo fuera— y
 * guarda cuánto redujo.
 *
 * EL ORDEN NO ES NEGOCIABLE:
 *
 *   1. separar diseño de fondo,
 *   2. preguntar sobre el ORIGINAL si esto era tono continuo -> si lo es, se
 *      rechaza aquí mismo y no se cuantiza ni se arranca nada,
 *   3. reducir la paleta,
 *   4. limpiar el ruido del umbral,
 *   5. quitar lo que no llega al área mínima en milímetros,
 *   6. clasificar por complejidad para elegir entre bordar y revisar.
 *
 * EL PASO 2 VA ANTES DEL 3 PORQUE EL 3 BORRA LA RESPUESTA. Cuantizar convierte
 * un degradado en tintas planas: medido sobre el banco, después de reducir la
 * paleta el retrato daba un ΔE de 2.4 —mejor que varios logos con antialias— y
 * sus regiones salían tan limpias como las de un icono. Cuando esta pregunta se
 * hacía después, la única forma de contestarla era inventar proporciones sobre
 * el recuento de regiones, y esas medían el ruido del umbral, no la imagen.
 *
 * LA TRANSPARENCIA NO BASTA PARA DISTINGUIR UN LOGO. Un recorte de fotografía
 * también trae alfa. El alfa dice DÓNDE está el diseño; qué es ese diseño lo
 * contesta el paso 2, y las dos preguntas se hacen aparte.
 */

export type PreparacionDeRaster = {
	objetos: EmbroideryObject[];
	incidencias: EmbroideryIssue[];
	colores: Map<string, string>;
	conteo: { satin: number; running: number; fill: number };
	analisis: NonNullable<EmbroideryPreparation["raster"]>;
	/** Si viene, el diseño no se manda: se explica y se para. */
	rechazo?: EmbroideryIssue;
	/** Qué recurso de cómputo se agotó, si se agotó alguno. */
	presupuestoAgotado?: string;
	metricas: {
		gradientRatio: number;
		texture: number;
		colorEntropy: number;
		alphaCoverage: number;
	};
	/** Milisegundos por etapa. Vacío si no se pidió medir. */
	tiempos: Record<string, number>;
	/** Cuánto costó partir las formas en columnas. */
	coste: CosteDeEsqueleto;
	/** Lo que se miró para clasificar. No sale de aquí; es para poder auditarlo. */
	diagnostico: AnalisisDelOriginal & {
		/** Componentes de todas las tintas ANTES del filtro de ruido. */
		componentesAntes: number;
		/** Y después, ya sin las islas de un píxel del umbral. */
		componentesDespues: number;
		regionesGrandes: number;
		motas: number;
		fraccionMotas: number;
		areaEnMotas: number;
	};
};

/** Bits por canal al agrupar colores para el histograma. */
const BITS = 5;

type Cubo = { lab: [number, number, number]; rgb: [number, number, number] };

function llaveDe(r: number, g: number, b: number) {
	const s = 8 - BITS;
	return ((r >> s) << (BITS * 2)) | ((g >> s) << BITS) | (b >> s);
}
function deLlave(llave: number): [number, number, number] {
	const s = 8 - BITS;
	const mascara = (1 << BITS) - 1;
	// Se devuelve el centro del cubo, no su esquina: con la esquina toda la
	// paleta se iba sistemáticamente hacia el negro.
	const medio = 1 << (s - 1);
	return [
		(((llave >> (BITS * 2)) & mascara) << s) + medio,
		(((llave >> BITS) & mascara) << s) + medio,
		((llave & mascara) << s) + medio,
	];
}

function deltaE(a: [number, number, number], b: [number, number, number]) {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Reduce la paleta a k tintas por k-medias en Lab.
 *
 * SOBRE EL HISTOGRAMA Y NO SOBRE LOS PÍXELES: con un área de 90x60 mm a 0.05
 * mm/px son dos millones y medio de píxeles, y doce iteraciones sobre ellos
 * congelan la pestaña. Sobre los cubos de color son unos pocos miles y el
 * resultado es el mismo, porque dos píxeles del mismo cubo van siempre al mismo
 * sitio.
 *
 * LA SEMILLA ES DETERMINISTA —el más frecuente y luego el más lejano de los ya
 * elegidos— porque el hash del diseño tiene que salir igual dos veces seguidas.
 * Con centros al azar, pedir el mismo bordado dos veces creaba dos trabajos.
 */
function reducirPaleta(
	histograma: Map<number, number>,
	k: number,
): { centros: Cubo[]; asignacion: Map<number, number>; deltaMedio: number } {
	const cubos = [...histograma.entries()]
		.sort((a, b) => b[1] - a[1] || a[0] - b[0])
		.map(([llave, cuenta]) => {
			const rgb = deLlave(llave);
			return { llave, cuenta, rgb, lab: aLab(rgb[0], rgb[1], rgb[2]) };
		});

	if (!cubos.length)
		return { centros: [], asignacion: new Map(), deltaMedio: 0 };

	const semillas = [cubos[0]];
	const candidatos = cubos.slice(0, 256);
	while (semillas.length < Math.min(k, cubos.length)) {
		let mejor = candidatos[0];
		let mejorD = -1;
		for (const c of candidatos) {
			let cerca = Infinity;
			for (const s of semillas) cerca = Math.min(cerca, deltaE(c.lab, s.lab));
			// El peso por frecuencia evita elegir como tinta un píxel suelto de ruido
			// que casualmente es el más lejano de la paleta.
			const puntuacion = cerca * Math.log1p(c.cuenta);
			if (puntuacion > mejorD) {
				mejorD = puntuacion;
				mejor = c;
			}
		}
		if (semillas.includes(mejor)) break;
		semillas.push(mejor);
	}

	let centros = semillas.map((s) => ({
		lab: [...s.lab] as [number, number, number],
		rgb: s.rgb,
	}));

	for (let vuelta = 0; vuelta < 12; vuelta++) {
		const sumas = centros.map(() => [0, 0, 0, 0, 0, 0, 0]);
		for (const cubo of cubos) {
			let mejor = 0;
			let mejorD = Infinity;
			for (let i = 0; i < centros.length; i++) {
				const d = deltaE(cubo.lab, centros[i].lab);
				if (d < mejorD) {
					mejorD = d;
					mejor = i;
				}
			}
			const s = sumas[mejor];
			s[0] += cubo.lab[0] * cubo.cuenta;
			s[1] += cubo.lab[1] * cubo.cuenta;
			s[2] += cubo.lab[2] * cubo.cuenta;
			s[3] += cubo.rgb[0] * cubo.cuenta;
			s[4] += cubo.rgb[1] * cubo.cuenta;
			s[5] += cubo.rgb[2] * cubo.cuenta;
			s[6] += cubo.cuenta;
		}
		let movio = 0;
		centros = centros.map((centro, i) => {
			const s = sumas[i];
			if (!s[6]) return centro;
			const lab: [number, number, number] = [
				s[0] / s[6],
				s[1] / s[6],
				s[2] / s[6],
			];
			movio = Math.max(movio, deltaE(lab, centro.lab));
			return {
				lab,
				rgb: [
					Math.round(s[3] / s[6]),
					Math.round(s[4] / s[6]),
					Math.round(s[5] / s[6]),
				] as [number, number, number],
			};
		});
		if (movio < 0.3) break;
	}

	const asignacion = new Map<number, number>();
	let sumaDelta = 0;
	let total = 0;
	for (const cubo of cubos) {
		let mejor = 0;
		let mejorD = Infinity;
		for (let i = 0; i < centros.length; i++) {
			const d = deltaE(cubo.lab, centros[i].lab);
			if (d < mejorD) {
				mejorD = d;
				mejor = i;
			}
		}
		asignacion.set(cubo.llave, mejor);
		sumaDelta += mejorD * cubo.cuenta;
		total += cubo.cuenta;
	}

	return {
		centros,
		asignacion,
		deltaMedio: total ? sumaDelta / total : 0,
	};
}

function hexDe([r, g, b]: [number, number, number]) {
	return `#${[r, g, b]
		.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
		.join("")}`;
}

/**
 * Lo que se puede saber de la imagen ANTES de tocarla.
 *
 * ESTO SE MIDE SOBRE EL ORIGINAL Y POR ESO EXISTE. Cuantizar convierte un
 * degradado en tintas planas: después de reducir la paleta, una fotografía y un
 * logo son indistinguibles —medido: el retrato da un ΔE de 2.4 contra sus seis
 * tintas, mejor que varios logos con antialias, y sus regiones salen tan
 * limpias como las de un icono—. La señal de "esto era tono continuo" sólo
 * existe aquí.
 *
 * EL INTERIOR ES LA CLAVE. Un logo con antialias tiene cientos de colores, pero
 * TODOS en el borde: en cuanto un píxel está rodeado de píxeles casi iguales al
 * suyo, su color es una de las pocas tintas planas del diseño. En un degradado
 * o una fotografía el interior es justamente donde vive la variación. Mirar
 * sólo el interior es lo que impide que el antialias se confunda con tono
 * continuo, y es barato: dos pasadas.
 */
export type AnalisisDelOriginal = {
	/** Cubos de color distintos en el diseño. */
	coloresDistintos: number;
	/** Qué parte de la tinta está en los ocho colores más usados. */
	concentracionDominante: number;
	entropia: number;
	/** Qué parte del diseño NO es borde. */
	fraccionInterior: number;
	/** Qué parte del interior cabe en las tintas dominantes. */
	concentracionInterior: number;
	entropiaInterior: number;
	/** Interior que varía poco a poco: ni plano ni borde. */
	suavidadInterior: number;
};

const DOMINANTES = 8;

export function analizarOriginal(
	datos: Uint8ClampedArray,
	primerPlano: Uint8Array,
	ancho: number,
	alto: number,
	tintas: number,
): AnalisisDelOriginal {
	const n = ancho * alto;
	const lab = new Float32Array(n * 3);
	for (let p = 0; p < n; p++) {
		if (!primerPlano[p]) continue;
		const i = p * 4;
		const l = aLab(datos[i], datos[i + 1], datos[i + 2]);
		lab[p * 3] = l[0];
		lab[p * 3 + 1] = l[1];
		lab[p * 3 + 2] = l[2];
	}

	const distanciaA = (p: number, q: number) =>
		Math.hypot(
			lab[p * 3] - lab[q * 3],
			lab[p * 3 + 1] - lab[q * 3 + 1],
			lab[p * 3 + 2] - lab[q * 3 + 2],
		);

	const todos = new Map<number, number>();
	const interior = new Map<number, number>();
	let diseno = 0;
	let dentro = 0;
	let suaves = 0;

	for (let p = 0; p < n; p++) {
		if (!primerPlano[p]) continue;
		diseno++;
		const i = p * 4;
		const llave = llaveDe(datos[i], datos[i + 1], datos[i + 2]);
		todos.set(llave, (todos.get(llave) ?? 0) + 1);

		const x = p % ancho;
		const y = (p / ancho) | 0;
		let mayor = 0;
		let vecinos = 0;
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		] as const) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
			const q = ny * ancho + nx;
			if (!primerPlano[q]) continue;
			vecinos++;
			mayor = Math.max(mayor, distanciaA(p, q));
		}
		// Un píxel con menos de cuatro vecinos de diseño está en el contorno, y el
		// contorno es exactamente lo que no se quiere mirar.
		if (vecinos < 4 || mayor >= 2) continue;
		dentro++;
		interior.set(llave, (interior.get(llave) ?? 0) + 1);
		if (mayor >= 0.3) suaves++;
	}

	const reparto = (
		mapa: Map<number, number>,
		total: number,
		cuantos: number,
	) => {
		if (!total) return { concentracion: 0, entropia: 0 };
		const cuentas = [...mapa.values()].sort((a, b) => b - a);
		return {
			concentracion:
				cuentas.slice(0, cuantos).reduce((s, v) => s + v, 0) / total,
			entropia: cuentas.reduce((h, c) => {
				const q = c / total;
				return h - q * Math.log2(q);
			}, 0),
		};
	};

	const global = reparto(todos, diseno, DOMINANTES);
	const dentroReparto = reparto(interior, dentro, tintas);

	return {
		coloresDistintos: todos.size,
		concentracionDominante: Number(global.concentracion.toFixed(4)),
		entropia: Number(global.entropia.toFixed(3)),
		fraccionInterior: Number((dentro / Math.max(1, diseno)).toFixed(4)),
		concentracionInterior: Number(dentroReparto.concentracion.toFixed(4)),
		entropiaInterior: Number(dentroReparto.entropia.toFixed(3)),
		suavidadInterior: Number((suaves / Math.max(1, dentro)).toFixed(4)),
	};
}

export function objetosDeRaster(input: {
	imagen: FabricObject;
	profile: EmbroideryProfile;
	area: { left: number; top: number };
	escalaX: number;
	escalaY: number;
	anchoMm: number;
	altoMm: number;
	sourceObjectId: string;
	prefijo: string;
	cronometro?: Cronometro;
}): PreparacionDeRaster {
	const reloj = input.cronometro ?? crearCronometro();
	const lienzo = reloj.medir("render", () => {
		const l = lienzoEnMm(input.anchoMm, input.altoMm);
		return l;
	});
	// El objeto se pinta con SU propia transformación encima de la del área, así
	// que lo que se mide es exactamente lo que el comprador ve colocado.
	lienzo.ctx.scale(input.escalaX, input.escalaY);
	lienzo.ctx.translate(-input.area.left, -input.area.top);
	input.imagen.render(lienzo.ctx as unknown as CanvasRenderingContext2D);
	lienzo.ctx.setTransform(1, 0, 0, 1, 0, 0);

	const imagen = lienzo.ctx.getImageData(0, 0, lienzo.ancho, lienzo.alto);
	return prepararPixeles({
		datos: imagen.data,
		ancho: lienzo.ancho,
		alto: lienzo.alto,
		mmPorPx: lienzo.mmPorPx,
		desplazamientoMm: lienzo.desplazamientoMm,
		profile: input.profile,
		sourceObjectId: input.sourceObjectId,
		prefijo: input.prefijo,
		cronometro: reloj,
	});
}

/**
 * El análisis y la segmentación, ya sin canvas de por medio.
 *
 * VA APARTE PARA PODER PROBARLO. Lo de arriba necesita un navegador —hay que
 * pintar un objeto de Fabric— y lo de aquí no necesita más que píxeles, así que
 * las catorce regresiones de raster corren en node con las mismas imágenes que
 * el banco del láser y sin arrancar Chrome. Si estuvieran fundidos, la única
 * forma de probar la clasificación sería a ojo sobre una captura.
 */
export function prepararPixeles(input: {
	datos: Uint8ClampedArray;
	ancho: number;
	alto: number;
	mmPorPx: number;
	desplazamientoMm: number;
	profile: EmbroideryProfile;
	sourceObjectId: string;
	prefijo: string;
	cronometro?: Cronometro;
}): PreparacionDeRaster {
	const reloj = input.cronometro ?? crearCronometro();
	const coste = costeVacio();
	const lienzo = {
		ancho: input.ancho,
		alto: input.alto,
		mmPorPx: input.mmPorPx,
		desplazamientoMm: input.desplazamientoMm,
	};
	const datos = input.datos;
	const n = lienzo.ancho * lienzo.alto;

	const inicioSegmentacion =
		typeof performance !== "undefined" ? performance.now() : Date.now();

	/* 1) DÓNDE HAY IMAGEN. Fuera de lo que ocupa el objeto el lienzo está a alfa
	   cero, y eso no es "fondo transparente del PNG": es que ahí no hay imagen.
	   Confundirlos hacía que cualquier logo pequeño pareciera traer alfa. */
	let minX = lienzo.ancho;
	let minY = lienzo.alto;
	let maxX = -1;
	let maxY = -1;
	for (let p = 0; p < n; p++) {
		if (datos[p * 4 + 3] === 0) continue;
		const x = p % lienzo.ancho;
		const y = (p / lienzo.ancho) | 0;
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	if (maxX < 0) {
		return vacio(lienzo.mmPorPx, {
			code: "IMAGEN_FUERA_DEL_AREA",
			message: "La imagen quedó fuera del área de bordado.",
			severity: "reject",
		});
	}

	const dentroDelRecorte = (p: number) => {
		const x = p % lienzo.ancho;
		const y = (p / lienzo.ancho) | 0;
		return x >= minX && x <= maxX && y >= minY && y <= maxY;
	};

	/* 2) QUÉ ES DISEÑO. Con alfa de verdad, el archivo ya lo dice. Sin él, se
	   estima el fondo desde el marco y se corta por distancia perceptual, que es
	   lo mismo que hace el láser: un fondo amarillo no es "claro", es OTRO color,
	   y separarlo por luminancia borraría el amarillo del propio logo. */
	let semi = 0;
	let conImagen = 0;
	for (let p = 0; p < n; p++) {
		if (!dentroDelRecorte(p)) continue;
		conImagen++;
		const a = datos[p * 4 + 3];
		if (a < 250) semi++;
	}
	const conAlfa = semi > conImagen * 0.02;

	const primerPlano = new Uint8Array(n);
	if (conAlfa) {
		for (let p = 0; p < n; p++) {
			primerPlano[p] = datos[p * 4 + 3] >= 128 ? 1 : 0;
		}
	} else {
		const recorte = recortar(datos, lienzo.ancho, minX, minY, maxX, maxY);
		const [fr, fg, fb] = fondoDe(recorte, maxX - minX + 1, maxY - minY + 1);
		const fondo = aLab(fr, fg, fb);
		const distancia = new Float32Array(n);
		let maxima = 0;
		for (let p = 0; p < n; p++) {
			if (!dentroDelRecorte(p) || datos[p * 4 + 3] < 128) continue;
			const i = p * 4;
			const d = deltaE(aLab(datos[i], datos[i + 1], datos[i + 2]), fondo);
			distancia[p] = d;
			if (d > maxima) maxima = d;
		}
		if (!(maxima > 0)) {
			return vacio(lienzo.mmPorPx, {
				code: "IMAGEN_DE_UN_SOLO_COLOR",
				message: "Esta imagen es de un solo color; no hay nada que bordar.",
				severity: "reject",
			});
		}
		const hist = new Uint32Array(256);
		for (let p = 0; p < n; p++) {
			if (!dentroDelRecorte(p)) continue;
			hist[Math.min(255, ((distancia[p] / maxima) * 255) | 0)]++;
		}
		const corte = Math.max(1, otsu(hist, conImagen)) * (maxima / 255);
		for (let p = 0; p < n; p++) {
			primerPlano[p] = distancia[p] >= corte ? 1 : 0;
		}
	}

	reloj.sumar(
		"segmentacion",
		(typeof performance !== "undefined" ? performance.now() : Date.now()) -
			inicioSegmentacion,
	);

	const histograma = new Map<number, number>();
	let pixelesDiseno = 0;
	let pixelesPrimerPlano = 0;
	for (let p = 0; p < n; p++) pixelesPrimerPlano += primerPlano[p];
	try {
		exigir(
			"pixelesPrimerPlano",
			pixelesPrimerPlano,
			input.profile.presupuesto.maxPixelesPrimerPlano,
		);
	} catch (error) {
		if (!esPresupuestoExcedido(error)) throw error;
		return excedido(lienzo.mmPorPx, error.recurso, reloj, coste);
	}

	for (let p = 0; p < n; p++) {
		if (!primerPlano[p]) continue;
		pixelesDiseno++;
		const i = p * 4;
		const llave = llaveDe(datos[i], datos[i + 1], datos[i + 2]);
		histograma.set(llave, (histograma.get(llave) ?? 0) + 1);
	}
	if (!pixelesDiseno) {
		return vacio(lienzo.mmPorPx, {
			code: "IMAGEN_SIN_DISENO",
			message: "No encontramos ninguna forma que bordar en esta imagen.",
			severity: "reject",
		});
	}

	const r = input.profile.raster;
	const base = {
		sourceColorCount: histograma.size,
		hadAlpha: conAlfa,
		mmPorPx: Number(lienzo.mmPorPx.toFixed(4)),
	};

	/* 3) ¿ERA TONO CONTINUO? Se pregunta AQUÍ, sobre el original, porque el paso
	   siguiente destruye la respuesta: en cuanto se cuantiza, un degradado son
	   seis tintas planas y ya no hay forma de distinguirlo de un logo. */
	const original = reloj.medir("analisisOriginal", () =>
		analizarOriginal(
			datos,
			primerPlano,
			lienzo.ancho,
			lienzo.alto,
			r.maxColoresReducidos,
		),
	);
	const entropia = original.entropia;

	if (original.suavidadInterior > r.maxSuavidadInterior) {
		/* Se para ANTES DE CUANTIZAR y antes del motor. Reducir la paleta de una
		   fotografía cuesta lo mismo que hacerlo con un logo y no sirve para nada:
		   la respuesta ya está decidida, y arrancar un contenedor de Ink/Stitch
		   para llegar a ella sólo añade un minuto de espera al mismo "no". */
		return {
			objetos: [],
			incidencias: [],
			colores: new Map(),
			conteo: { satin: 0, running: 0, fill: 0 },
			analisis: {
				...base,
				reducedColorCount: 0,
				quantizationDeltaE: 0,
				classification: "photo",
				removedRegions: 0,
				removedAreaMm2: 0,
			},
			rechazo: {
				code: "PHOTO",
				message:
					"Esta imagen tiene tonos que van cambiando poco a poco, y el bordado sólo puede hacer colores planos. Prueba con un logo o una ilustración de pocas tintas.",
				severity: "reject",
			},
			tiempos: reloj.etapas,
			coste,
			metricas: {
				gradientRatio: 0,
				texture: 0,
				colorEntropy: Number(entropia.toFixed(3)),
				alphaCoverage: Number(
					(pixelesDiseno / Math.max(1, conImagen)).toFixed(4),
				),
			},
			diagnostico: {
				...original,
				componentesAntes: 0,
				componentesDespues: 0,
				regionesGrandes: 0,
				motas: 0,
				fraccionMotas: 0,
				areaEnMotas: 0,
			},
		};
	}

	/* 4) LA PALETA, CON LAS TINTAS JUSTAS. Se van añadiendo hasta que el error de
	   color deja de bajar, no hasta llegar al tope: cuantizar un logo de dos
	   tintas a seis no lo mejora, mete cuatro hilos que nadie va a enhebrar y
	   convierte cada borde con antialias en una orla de motas. Medido sobre el
	   banco, forzar seis tintas en el logo blanco y negro lo llevaba de 5
	   regiones y 0 motas a 10 regiones y 1115 motas. */
	const paleta = reloj.medir("cuantizacion", () => {
		let elegida = reducirPaleta(histograma, 2);
		for (
			let k = 3;
			k <= Math.min(r.maxColoresReducidos, input.profile.limits.maxColors);
			k++
		) {
			if (elegida.deltaMedio <= r.deltaObjetivoDeltaE) break;
			const siguiente = reducirPaleta(histograma, k);
			if (siguiente.centros.length <= elegida.centros.length) break;
			elegida = siguiente;
		}
		return elegida;
	});
	const { centros, asignacion, deltaMedio } = paleta;

	const porPixel = new Int16Array(n).fill(-1);
	for (let p = 0; p < n; p++) {
		if (!primerPlano[p]) continue;
		const i = p * 4;
		porPixel[p] =
			asignacion.get(llaveDe(datos[i], datos[i + 1], datos[i + 2])) ?? 0;
	}

	let gradiente = 0;
	for (const [llave, cuenta] of histograma) {
		const centro = centros[asignacion.get(llave) ?? 0];
		const rgb = deLlave(llave);
		if (deltaE(aLab(rgb[0], rgb[1], rgb[2]), centro.lab) > 10)
			gradiente += cuenta;
	}
	const gradientRatio = gradiente / pixelesDiseno;

	let bordes = 0;
	for (let p = 0; p < n; p++) {
		if (porPixel[p] < 0) continue;
		const x = p % lienzo.ancho;
		if (
			x + 1 < lienzo.ancho &&
			porPixel[p + 1] >= 0 &&
			porPixel[p + 1] !== porPixel[p]
		)
			bordes++;
	}

	const metricas = {
		gradientRatio: Number(gradientRatio.toFixed(4)),
		texture: Number((bordes / pixelesDiseno).toFixed(4)),
		colorEntropy: Number(entropia.toFixed(3)),
		alphaCoverage: Number((pixelesDiseno / Math.max(1, conImagen)).toFixed(4)),
	};

	/* 5) LIMPIEZA Y ELIMINACIÓN DE LO QUE NO SE PUEDE BORDAR. Aquí ya no se
	   decide si la imagen sirve —eso se decidió sobre el original— sino cuánto de
	   ella sobrevive a la regla de que una región mida al menos `minAreaMm2`. */
	const mascaras: Uint8Array[] = [];
	let regionesGrandes = 0;
	let motas = 0;
	let pixelesEnMotas = 0;
	let componentesAntes = 0;
	let componentesDespues = 0;
	for (let c = 0; c < centros.length; c++) {
		const mascara = new Uint8Array(n);
		let cuantos = 0;
		for (let p = 0; p < n; p++) {
			if (porPixel[p] === c) {
				mascara[p] = 1;
				cuantos++;
			}
		}
		/* La limpieza va ANTES de contar. Contar sobre la máscara cruda mide el
		   ruido del umbral, no el diseño. */
		const cruda = comoLa(rejillaVacia(lienzo), mascara);
		componentesAntes += reloj.medir(
			"analisisComponentes",
			() => componentes(cruda).length,
		);
		const limpia = reloj.medir("limpieza", () => limpiar(cruda));
		mascaras.push(limpia.datos);
		if (!cuantos) continue;
		const partes = reloj.medir("analisisComponentes", () =>
			componentes(limpia),
		);
		componentesDespues += partes.length;
		for (const parte of partes) {
			const area = parte.pixeles.length * lienzo.mmPorPx * lienzo.mmPorPx;
			if (area >= input.profile.geometria.minAreaMm2) regionesGrandes++;
			else {
				motas++;
				pixelesEnMotas += parte.pixeles.length;
			}
		}
	}
	const fraccionMotas = motas / Math.max(1, regionesGrandes + motas);
	const areaEnMotas = pixelesEnMotas / pixelesDiseno;
	const diagnostico = {
		...original,
		componentesAntes,
		componentesDespues,
		regionesGrandes,
		motas,
		fraccionMotas: Number(fraccionMotas.toFixed(4)),
		areaEnMotas: Number(areaEnMotas.toFixed(4)),
	};

	try {
		/* Aquí es donde de verdad se ataja lo patológico: contar componentes es un
		   relleno por inundación y cuesta milisegundos, mientras que adelgazarlos
		   y partirlos en ramas cuesta minutos. Una foto posterizada tiene dos mil
		   y se para en esta línea, sin gastar ni una pasada de esqueleto. */
		exigir(
			"componentes",
			componentesDespues,
			input.profile.presupuesto.maxComponentes,
		);
	} catch (error) {
		if (!esPresupuestoExcedido(error)) throw error;
		return excedido(lienzo.mmPorPx, error.recurso, reloj, coste, diagnostico);
	}

	/* `fraccionMotas` YA NO DECIDE NADA y se queda sólo como dato de auditoría.
	   Se probó como separador de foto y logo y es inestable por construcción: en
	   un logo limpio el denominador es de tres o cuatro regiones, así que una
	   sola mota lo dispara al 25 %, mientras que el wordmark daba 94 % perdiendo
	   sólo el 15 % de la tinta. Medía el ruido del umbral, no la imagen. */

	if (deltaMedio > r.maxPerdidaCuantizacionDeltaE) {
		return {
			objetos: [],
			incidencias: [],
			colores: new Map(),
			conteo: { satin: 0, running: 0, fill: 0 },
			analisis: {
				...base,
				reducedColorCount: centros.length,
				quantizationDeltaE: Number(deltaMedio.toFixed(2)),
				classification: "photo",
				removedRegions: motas,
				removedAreaMm2: 0,
			},
			rechazo: {
				code: "COLOR_IRREPRESENTABLE",
				message: `No pudimos reducir esta imagen a ${centros.length} hilos sin cambiarle los colores de forma visible.`,
				severity: "reject",
			},
			tiempos: reloj.etapas,
			coste,
			metricas,
			diagnostico,
		};
	}

	/* 6) CLASIFICACIÓN POR COMPLEJIDAD, ya no por naturaleza. Excluido el tono
	   continuo, lo único que queda por decidir es si esto se borda solo o si
	   alguien tiene que mirarlo, y eso es cuántas piezas tiene. Que un logo con
	   muchas piezas salga como `illustration` no es un fallo: la etiqueta sólo
	   elige entre bordar y revisar, y con cien regiones lo correcto es revisar. */
	const clasificacion: "logo" | "illustration" =
		regionesGrandes > r.maxComponentesLogo ? "illustration" : "logo";

	const incidencias: EmbroideryIssue[] = [];
	if (clasificacion === "illustration") {
		incidencias.push({
			code: "ILLUSTRATION_REVIEW",
			message: `Este diseño tiene ${regionesGrandes} piezas; alguien del taller lo revisará antes de bordarlo.`,
			severity: "review",
		});
	}

	/* 5) CADA TINTA PASA POR LA MISMA RUTINA QUE EL TEXTO: se le buscan columnas
	   y lo que no lo sea se cose de relleno. */
	const objetos: EmbroideryObject[] = [];
	const colores = new Map<string, string>();
	const conteo = { satin: 0, running: 0, fill: 0 };
	let eliminadas = 0;
	let eliminadasMm2 = 0;

	try {
		for (let c = 0; c < centros.length; c++) {
			const mascara = mascaras[c];
			if (!mascara.some((v) => v === 1)) continue;

			const hex = hexDe(centros[c].rgb);
			const colorId = colorIdDe(hex);
			colores.set(colorId, hex);

			const resultado = objetosDeMascara({
				cronometro: reloj,
				coste,
				rejilla: comoLa(rejillaVacia(lienzo), mascara),
				profile: input.profile,
				colorId,
				sourceObjectId: input.sourceObjectId,
				sourceType: "raster",
				classification: clasificacion,
				prefijo: `${input.prefijo}-t${c}`,
				desplazamientoMm: lienzo.desplazamientoMm,
			});

			objetos.push(...resultado.objetos);
			incidencias.push(...resultado.incidencias);
			conteo.satin += resultado.conteo.satin;
			conteo.running += resultado.conteo.running;
			conteo.fill += resultado.conteo.fill;
			eliminadas += resultado.eliminadas;
			eliminadasMm2 += resultado.eliminadasMm2;
		}
	} catch (error) {
		if (!esPresupuestoExcedido(error)) throw error;
		return excedido(lienzo.mmPorPx, error.recurso, reloj, coste, diagnostico);
	}

	if (eliminadas > 0) {
		incidencias.push({
			code: "DETALLE_PERDIDO",
			message: `Quitamos ${eliminadas} detalle(s) demasiado pequeño(s) para bordarse a este tamaño.`,
			severity: "review",
		});
	}
	if (deltaMedio > r.deltaObjetivoDeltaE) {
		incidencias.push({
			code: "PALETA_FORZADA",
			message:
				"Tuvimos que simplificar bastante los colores; el bordado no se parecerá del todo al original.",
			severity: "review",
		});
	}

	return {
		objetos,
		incidencias: incidencias.filter(
			(issue, i, todos) => todos.findIndex((y) => y.code === issue.code) === i,
		),
		colores,
		conteo,
		analisis: {
			...base,
			reducedColorCount: colores.size,
			quantizationDeltaE: Number(deltaMedio.toFixed(2)),
			classification: clasificacion,
			removedRegions: eliminadas,
			removedAreaMm2: Number(eliminadasMm2.toFixed(3)),
		},
		tiempos: reloj.etapas,
		coste,
		metricas,
		diagnostico,
	};
}

/**
 * La respuesta cuando se agota el presupuesto de cómputo.
 *
 * Va a REVIEW y no a la basura: el diseño puede ser perfectamente bordable, lo
 * que no se puede es prepararlo solo. El recurso agotado queda en el resultado
 * para el taller; al comprador se le dice qué hacer, no qué se desbordó.
 */
function excedido(
	mmPorPx: number,
	recurso: string,
	reloj: Cronometro,
	coste: CosteDeEsqueleto,
	diagnostico?: PreparacionDeRaster["diagnostico"],
): PreparacionDeRaster {
	const vacia = vacio(mmPorPx, incidenciaDeComplejidad());
	return {
		...vacia,
		rechazo: undefined,
		incidencias: [incidenciaDeComplejidad()],
		presupuestoAgotado: recurso,
		tiempos: reloj.etapas,
		coste,
		diagnostico: diagnostico ?? vacia.diagnostico,
	};
}

/** Una rejilla con la forma y la escala del lienzo, para pasarle una máscara. */
function rejillaVacia(lienzo: {
	ancho: number;
	alto: number;
	mmPorPx: number;
}) {
	return {
		datos: new Uint8Array(0),
		ancho: lienzo.ancho,
		alto: lienzo.alto,
		mmPorPx: lienzo.mmPorPx,
	};
}

function recortar(
	datos: Uint8ClampedArray,
	ancho: number,
	minX: number,
	minY: number,
	maxX: number,
	maxY: number,
) {
	const w = maxX - minX + 1;
	const h = maxY - minY + 1;
	const salida = new Uint8ClampedArray(w * h * 4);
	for (let y = 0; y < h; y++) {
		const desde = ((minY + y) * ancho + minX) * 4;
		salida.set(datos.subarray(desde, desde + w * 4), y * w * 4);
	}
	return salida;
}

function vacio(mmPorPx: number, rechazo: EmbroideryIssue): PreparacionDeRaster {
	return {
		objetos: [],
		incidencias: [],
		colores: new Map(),
		conteo: { satin: 0, running: 0, fill: 0 },
		analisis: {
			sourceColorCount: 0,
			reducedColorCount: 0,
			quantizationDeltaE: 0,
			classification: "logo",
			removedRegions: 0,
			removedAreaMm2: 0,
			hadAlpha: false,
			mmPorPx: Number(mmPorPx.toFixed(4)),
		},
		rechazo,
		metricas: {
			gradientRatio: 0,
			texture: 0,
			colorEntropy: 0,
			alphaCoverage: 0,
		},
		tiempos: {},
		coste: costeVacio(),
		diagnostico: {
			coloresDistintos: 0,
			concentracionDominante: 0,
			entropia: 0,
			fraccionInterior: 0,
			concentracionInterior: 0,
			entropiaInterior: 0,
			suavidadInterior: 0,
			componentesAntes: 0,
			componentesDespues: 0,
			regionesGrandes: 0,
			motas: 0,
			fraccionMotas: 0,
			areaEnMotas: 0,
		},
	};
}
