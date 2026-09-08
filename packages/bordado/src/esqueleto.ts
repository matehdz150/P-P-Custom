/**
 * Partir una forma en columnas bordables.
 *
 * EL PROBLEMA. Una "H" es un solo trozo conexo, y medida entera no es una
 * columna: ni es alargada ni tiene el grosor estable, así que la regla de
 * `decidirPuntada` la manda a relleno y la letra sale como una mancha. Pero la
 * "H" no es una forma, son TRES columnas de grosor idéntico que se tocan. Lo
 * mismo con la "E", la "A" o casi cualquier letra: lo que hay que decidir no es
 * la puntada del componente, es la de cada asta.
 *
 * POR QUÉ AQUÍ SÍ HAY ADELGAZAMIENTO. `geometria.ts` se queda con los máximos
 * locales de la distancia porque para saber "qué grosor tiene y si se mantiene"
 * eso basta y sale en una pasada. Pero esa cresta es gruesa en las mesetas, y
 * sobre algo grueso el GRADO de un nodo no significa nada: no se puede
 * distinguir un cruce de un tramo ancho. Para cortar por los cruces hace falta
 * un esqueleto de un píxel de ancho de verdad, y eso es Zhang-Suen.
 *
 * LO QUE NO SE INVENTA. Una rama que no da columna válida no se fuerza a satin:
 * se devuelve tal cual y quien llama decide. Y lo que queda de la forma después
 * de quitar las columnas —los nudos de los cruces, los remates— se devuelve
 * como sobrante para coserlo de relleno, no se descarta: descartarlo dejaría
 * agujeros en la letra.
 */

import {
	type Componente,
	componentes,
	distanciaAlFondo,
	type Rejilla,
	simplificar,
} from "./geometria";
import { exigir } from "./presupuesto";
import type { EmbroideryProfile } from "./profile";

/** Vecinos en el orden P2..P9 de Zhang-Suen: N, NE, E, SE, S, SO, O, NO. */
const P = [
	[0, -1],
	[1, -1],
	[1, 0],
	[1, 1],
	[0, 1],
	[-1, 1],
	[-1, 0],
	[-1, -1],
] as const;

/**
 * Esqueleto de un píxel de ancho, por Zhang-Suen.
 *
 * Devuelve una máscara nueva; no toca la de entrada.
 *
 * DEVUELVE TAMBIÉN SI CONVERGIÓ, y quien llama TIENE que mirarlo. Si se acaban
 * las pasadas antes de tiempo, lo que queda no es un esqueleto: es la forma a
 * medio adelgazar, o sea un bloque. Tratarlo como esqueleto es desastroso —un
 * icono geométrico daba 25 988 "cruces" sobre 29 607 píxeles y 51 766 ramas,
 * porque en un bloque casi ningún píxel tiene exactamente dos vecinos.
 *
 * `caja` acota el barrido a un rectángulo. NO ES UNA OPTIMIZACIÓN COSMÉTICA: el
 * adelgazamiento son varias decenas de pasadas, y sin acotar cada una recorre la
 * rejilla ENTERA para una forma que ocupa un rincón. Un logo con cien regiones
 * en un área de 90x60 mm eran cinco mil millones de visitas y el banco se
 * quedaba colgado; en el navegador del comprador habría sido la pestaña.
 * Los índices siguen siendo los de la rejilla completa, así que quien llama no
 * tiene que traducir nada.
 */
export function esqueleto(
	rejilla: Rejilla,
	caja?: { minX: number; minY: number; maxX: number; maxY: number },
	coste?: CosteDeEsqueleto,
	maxPasadas = 200,
): { datos: Uint8Array; convergio: boolean } {
	const { ancho, alto } = rejilla;
	const m = Uint8Array.from(rejilla.datos);
	const vecinos = new Uint8Array(8);

	const desdeX = Math.max(0, caja ? caja.minX : 0);
	const hastaX = Math.min(ancho - 1, caja ? caja.maxX : ancho - 1);
	const desdeY = Math.max(0, caja ? caja.minY : 0);
	const hastaY = Math.min(alto - 1, caja ? caja.maxY : alto - 1);

	const leer = (x: number, y: number) =>
		x >= 0 && y >= 0 && x < ancho && y < alto ? m[y * ancho + x] : 0;

	let cambio = true;
	let vuelta = 0;
	// El tope es una red de seguridad: Zhang-Suen converge, pero esto corre en el
	// navegador del comprador y una máscara corrupta no debe colgar la pestaña.
	while (cambio && vuelta < maxPasadas) {
		cambio = false;

		for (const paso of [0, 1]) {
			const borrar: number[] = [];

			for (let y = desdeY; y <= hastaY; y++) {
				for (let x = desdeX; x <= hastaX; x++) {
					const i = y * ancho + x;
					if (!m[i]) continue;

					let b = 0;
					for (let k = 0; k < 8; k++) {
						vecinos[k] = leer(x + P[k][0], y + P[k][1]);
						b += vecinos[k];
					}
					if (b < 2 || b > 6) continue;

					// A(p): cuántas veces se pasa de fondo a diseño dando la vuelta.
					// Vale 1 exactamente cuando borrar el píxel no parte la forma.
					let a = 0;
					for (let k = 0; k < 8; k++) {
						if (!vecinos[k] && vecinos[(k + 1) % 8]) a++;
					}
					if (a !== 1) continue;

					const [n, , e, , s, , o] = vecinos;
					const primera = paso === 0 ? n * e * s : n * e * o;
					const segunda = paso === 0 ? e * s * o : n * s * o;
					if (primera === 0 && segunda === 0) borrar.push(i);
				}
			}

			if (borrar.length) {
				for (const i of borrar) m[i] = 0;
				cambio = true;
			}
		}

		vuelta++;
	}

	if (coste) coste.pasadasAdelgazado += vuelta;
	return { datos: m, convergio: !cambio };
}

/**
 * Lo que costó partir una forma. Se rellena si quien llama pasa el objeto.
 *
 * No es telemetría: es lo que permite poner un presupuesto con criterio en vez
 * de a ojo. Una foto posterizada y un logo se distinguen aquí por dos órdenes
 * de magnitud, y sin estos números el límite sería un número inventado.
 */
export type CosteDeEsqueleto = {
	pixelesEsqueleto: number;
	ramas: number;
	cruces: number;
	pasadasAdelgazado: number;
	fusiones: number;
	/** Comparaciones del bucle de fusión: es el término que se dispara. */
	comparacionesFusion: number;
	msEsqueleto: number;
	msFusion: number;
};

export function costeVacio(): CosteDeEsqueleto {
	return {
		pixelesEsqueleto: 0,
		ramas: 0,
		cruces: 0,
		pasadasAdelgazado: 0,
		fusiones: 0,
		comparacionesFusion: 0,
		msEsqueleto: 0,
		msFusion: 0,
	};
}

const ahora = () =>
	typeof performance !== "undefined" ? performance.now() : Date.now();

export type Rama = {
	/** El camino en milímetros, ya simplificado y prolongado hasta las puntas. */
	puntos: Array<[number, number]>;
	/** Ancho local alineado con `puntos`, medido sobre la distancia al fondo. */
	anchosMm: number[];
	/** Índices de píxeles que recorre, en orden, incluidas las prolongaciones. */
	pixeles: number[];
	largoMm: number;
	grosorMedianoMm: number;
	grosorMinimoMm: number;
	grosorMaximoMm: number;
	uniformidad: number;
	/** Un lazo cerrado: la panza de una "o", un anillo. */
	cerrada: boolean;
	/** El extremo toca un nodo de grado >= 3. */
	junctionInicio: boolean;
	junctionFin: boolean;
};

function percentil(ordenados: number[], p: number) {
	if (!ordenados.length) return 0;
	const i = Math.min(
		ordenados.length - 1,
		Math.max(0, Math.round((ordenados.length - 1) * p)),
	);
	return ordenados[i];
}

function medirRama(
	recorrido: number[],
	muestras: number[],
	rejilla: Rejilla,
	distancia: Float32Array,
	toleranciaMm: number,
	cerrada: boolean,
	junctionInicio = false,
	junctionFin = false,
): Rama {
	const mm = rejilla.mmPorPx;
	/* El grosor se mide SÓLO sobre el esqueleto. Las prolongaciones caen en la
	   punta del trazo, donde la distancia al fondo se desploma; incluirlas haría
	   que toda columna pareciera irregular y ninguna letra llegaría a satin. */
	const grosores = muestras
		.map((p) => distancia[p] * 2 * mm)
		.sort((a, b) => a - b);
	const p10 = percentil(grosores, 0.1);
	const p90 = percentil(grosores, 0.9);

	const crudos = recorrido.map(
		(p) =>
			[(p % rejilla.ancho) * mm, ((p / rejilla.ancho) | 0) * mm] as [
				number,
				number,
			],
	);

	let largo = 0;
	for (let i = 1; i < crudos.length; i++) {
		largo += Math.hypot(
			crudos[i][0] - crudos[i - 1][0],
			crudos[i][1] - crudos[i - 1][1],
		);
	}

	const puntos = simplificar(crudos, toleranciaMm);
	const anchosMm = puntos.map(([x, y]) => {
		const px = Math.max(0, Math.min(rejilla.ancho - 1, Math.round(x / mm)));
		const py = Math.max(0, Math.min(rejilla.alto - 1, Math.round(y / mm)));
		return distancia[py * rejilla.ancho + px] * 2 * mm;
	});

	return {
		puntos,
		anchosMm,
		pixeles: recorrido,
		largoMm: largo,
		grosorMedianoMm: percentil(grosores, 0.5),
		grosorMinimoMm: grosores[0] ?? 0,
		grosorMaximoMm: grosores[grosores.length - 1] ?? 0,
		uniformidad: p90 > 0 ? Math.min(1, p10 / p90) : 0,
		cerrada,
		junctionInicio,
		junctionFin,
	};
}

/**
 * Alarga el camino por sus dos puntas hasta el borde real del trazo.
 *
 * Zhang-Suen deja el esqueleto CORTO: en una barra de 2 mm el eje empieza y
 * acaba a 1 mm de las puntas, porque ahí ya no hay nada que adelgazar. Si se
 * cosiera esa línea tal cual, la columna no llegaría al final del asta y los
 * remates de cada letra quedarían sin bordar. Se prolonga en la dirección de
 * los últimos píxeles mientras se siga estando dentro de la forma.
 */
function prolongar(
	camino: number[],
	mascara: Uint8Array,
	ancho: number,
	alto: number,
	distancia: Float32Array,
): number[] {
	const punta = (indices: number[]) => {
		const fin = indices[indices.length - 1];
		// Se toma la dirección de un tramo, no del último píxel: en una diagonal
		// escalonada el último paso puede ser puro horizontal y desviaría el remate.
		const atras = indices[Math.max(0, indices.length - 6)];
		let dx = (fin % ancho) - (atras % ancho);
		let dy = ((fin / ancho) | 0) - ((atras / ancho) | 0);
		const norma = Math.hypot(dx, dy);
		if (!norma) return [];
		dx /= norma;
		dy /= norma;

		const pasos = Math.ceil(distancia[fin]) + 2;
		const extra: number[] = [];
		const x = fin % ancho;
		const y = (fin / ancho) | 0;

		for (let k = 1; k <= pasos; k++) {
			const nx = Math.round(x + dx * k);
			const ny = Math.round(y + dy * k);
			if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) break;
			const i = ny * ancho + nx;
			if (!mascara[i]) break;
			if (extra[extra.length - 1] !== i) extra.push(i);
		}
		return extra;
	};

	const cola = punta(camino);
	const cabeza = punta([...camino].reverse());
	return [...cabeza.reverse(), ...camino, ...cola];
}

/**
 * Las ramas del esqueleto de un componente: los tramos entre cruce y cruce.
 *
 * El corte va en los nodos de grado distinto de dos —puntas y cruces—, que es
 * justo donde una columna deja de serlo. Una forma sin ningún nodo es un lazo
 * cerrado y se devuelve entero.
 */
export function ramas(
	rejilla: Rejilla,
	componente: Componente,
	distancia: Float32Array,
	toleranciaMm: number,
	coste?: CosteDeEsqueleto,
	presupuesto?: EmbroideryProfile["presupuesto"],
): Rama[] {
	const { ancho, alto } = rejilla;

	const soloEste = new Uint8Array(ancho * alto);
	for (const p of componente.pixeles) soloEste[p] = 1;

	// Un píxel de holgura: el adelgazamiento mira los ocho vecinos y sin margen
	// los del borde de la caja verían fondo donde hay forma.
	const caja = {
		minX: componente.minX - 1,
		minY: componente.minY - 1,
		maxX: componente.maxX + 1,
		maxY: componente.maxY + 1,
	};
	const desdeEsqueleto = ahora();
	const adelgazado = esqueleto(
		{ ...rejilla, datos: soloEste },
		caja,
		coste,
		presupuesto?.maxPasadasAdelgazado,
	);
	if (coste) coste.msEsqueleto += ahora() - desdeEsqueleto;

	/* Sin convergencia no hay columnas que buscar. Y no es una pérdida: para
	   agotar las pasadas la forma tiene que ser MUCHO más gruesa que el máximo de
	   una columna satin —doscientas pasadas son unos veinte milímetros de grosor
	   contra los ocho que admite el perfil—, así que su respuesta correcta era el
	   relleno de todas formas. Quien llama ya sabe qué hacer cuando no hay ramas. */
	if (!adelgazado.convergio) return [];
	const hueso = adelgazado.datos;

	const puntos: number[] = [];
	for (const p of componente.pixeles) if (hueso[p]) puntos.push(p);
	puntos.sort((a, b) => a - b);
	if (puntos.length < 2) return [];

	const indice = new Map<number, number>();
	puntos.forEach((p, i) => {
		indice.set(p, i);
	});

	/* Las diagonales redundantes se descartan. Un tramo en escalera —cualquier
	   trazo que no sea recto vertical u horizontal— deja píxeles con tres
	   vecinos: el de arriba, el de al lado y el de la esquina entre los dos. Esa
	   esquina no es una rama, es la misma línea; contarla convertía cada escalón
	   en un cruce y un anillo salía partido en doscientos trozos. */
	const vecinos = puntos.map((p) => {
		const x = p % ancho;
		const y = (p / ancho) | 0;
		const hay = (dx: number, dy: number) => {
			const nx = x + dx;
			const ny = y + dy;
			return (
				nx >= 0 &&
				ny >= 0 &&
				nx < ancho &&
				ny < alto &&
				hueso[ny * ancho + nx] === 1
			);
		};
		const salida: number[] = [];
		for (const [dx, dy] of P) {
			if (!hay(dx, dy)) continue;
			if (dx !== 0 && dy !== 0 && (hay(dx, 0) || hay(0, dy))) continue;
			const j = indice.get((y + dy) * ancho + (x + dx));
			if (j !== undefined) salida.push(j);
		}
		return salida;
	});

	const nodo = vecinos.map((v) => v.length !== 2);
	if (coste) {
		coste.pixelesEsqueleto += puntos.length;
		coste.cruces += nodo.filter(Boolean).length;
		if (presupuesto)
			exigir(
				"pixelesEsqueleto",
				coste.pixelesEsqueleto,
				presupuesto.maxPixelesEsqueleto,
			);
	}
	const crudas: number[][] = [];
	const visitado = new Set<string>();
	const arista = (a: number, b: number) => `${a}>${b}`;

	for (let inicio = 0; inicio < puntos.length; inicio++) {
		if (!nodo[inicio]) continue;

		for (const primero of vecinos[inicio]) {
			if (visitado.has(arista(inicio, primero))) continue;

			const camino = [inicio];
			let previo = inicio;
			let actual = primero;

			while (true) {
				visitado.add(arista(previo, actual));
				visitado.add(arista(actual, previo));
				camino.push(actual);
				if (nodo[actual]) break;

				const siguiente = vecinos[actual].find((v) => v !== previo);
				if (siguiente === undefined) break;
				previo = actual;
				actual = siguiente;
			}

			crudas.push(camino);
		}
	}

	/* Sin ningún nodo el esqueleto es un lazo: la panza de una "o", un aro. Se
	   recorre entero y se marca cerrado, porque una columna cerrada es
	   exactamente lo que se quiere ahí y partirla dejaría una costura visible. */
	if (!crudas.length) {
		if (!vecinos[0].length) return [];
		const camino = [0];
		let previo = 0;
		let actual: number | undefined = vecinos[0][0];
		while (actual !== undefined && actual !== 0) {
			camino.push(actual);
			const siguiente: number | undefined = vecinos[actual].find(
				(v) => v !== previo,
			);
			previo = actual;
			actual = siguiente;
			if (camino.length > puntos.length) break;
		}
		const enPixeles = camino.map((i) => puntos[i]);
		return [
			medirRama(enPixeles, enPixeles, rejilla, distancia, toleranciaMm, true),
		];
	}

	if (coste) {
		coste.ramas += crudas.length;
		if (presupuesto) exigir("ramas", coste.ramas, presupuesto.maxRamas);
	}
	const desdeFusion = ahora();
	const enteras = fundirRectas(
		crudas,
		puntos,
		ancho,
		distancia,
		coste,
		presupuesto,
	);
	if (coste) coste.msFusion += ahora() - desdeFusion;

	return enteras.map((camino) => {
		const enPixeles = camino.map((i) => puntos[i]);
		return medirRama(
			prolongar(enPixeles, soloEste, ancho, alto, distancia),
			enPixeles,
			rejilla,
			distancia,
			toleranciaMm,
			false,
			vecinos[camino[0]].length >= 3,
			vecinos[camino[camino.length - 1]].length >= 3,
		);
	});
}

/** Coseno de 35 grados: cuánto se admite que una unión se desvíe de la recta. */
const RECTA = Math.cos((35 * Math.PI) / 180);

/**
 * Une los tramos que atraviesan un cruce siguiendo recto.
 *
 * El asta izquierda de una "H" llega al travesaño y sale por el otro lado: el
 * corte por el cruce la parte en dos, y coserla como dos columnas mete dos
 * paradas y una costura visible a media asta. Se vuelven a unir los pares que
 * salen del cruce en direcciones opuestas y con el mismo grosor; el travesaño,
 * que sale perpendicular, se queda solo, que es lo correcto.
 */
function fundirRectas(
	crudas: number[][],
	puntos: number[],
	ancho: number,
	distancia: Float32Array,
	coste?: CosteDeEsqueleto,
	presupuesto?: EmbroideryProfile["presupuesto"],
): number[][] {
	const vivas = crudas.map((camino) => [...camino]);
	const muerta = new Uint8Array(vivas.length);

	const grosor = (camino: number[]) => {
		const v = camino.map((i) => distancia[puntos[i]]).sort((a, b) => a - b);
		return v[Math.floor(v.length / 2)] ?? 0;
	};
	/** Dirección de salida desde el extremo `alFinal` de la rama. */
	const salida = (camino: number[], alFinal: boolean): [number, number] => {
		const orden = alFinal ? [...camino].reverse() : camino;
		const a = puntos[orden[0]];
		const b = puntos[orden[Math.min(orden.length - 1, 6)]];
		const dx = (b % ancho) - (a % ancho);
		const dy = ((b / ancho) | 0) - ((a / ancho) | 0);
		const n = Math.hypot(dx, dy) || 1;
		return [dx / n, dy / n];
	};

	let hubo = true;
	while (hubo) {
		hubo = false;

		for (let i = 0; i < vivas.length && !hubo; i++) {
			if (muerta[i]) continue;

			for (const iAlFinal of [false, true]) {
				const nodoI = iAlFinal ? vivas[i][vivas[i].length - 1] : vivas[i][0];
				const dirI = salida(vivas[i], iAlFinal);
				const grosorI = grosor(vivas[i]);

				let mejor = -1;
				let mejorAlFinal = false;
				let mejorDot = -RECTA;

				for (let j = 0; j < vivas.length; j++) {
					if (j === i || muerta[j]) continue;
					for (const jAlFinal of [false, true]) {
						if (coste) {
							coste.comparacionesFusion++;
							/* La comprobación va DENTRO del bucle más interno, que es lo
							   único que sirve: este bucle se reinicia entero tras cada
							   fusión, así que es cuadrático en el número de ramas y sobre
							   una foto posterizada llegó a dos mil novecientos millones de
							   comparaciones. Comprobarlo fuera no lo habría parado nunca. */
							if (presupuesto)
								exigir(
									"comparacionesFusion",
									coste.comparacionesFusion,
									presupuesto.maxComparacionesFusion,
								);
						}
						const nodoJ = jAlFinal
							? vivas[j][vivas[j].length - 1]
							: vivas[j][0];
						if (nodoJ !== nodoI) continue;

						const dirJ = salida(vivas[j], jAlFinal);
						const dot = dirI[0] * dirJ[0] + dirI[1] * dirJ[1];
						// Opuestas: la una entra al cruce por donde la otra sale.
						if (dot >= mejorDot) continue;

						const grosorJ = grosor(vivas[j]);
						const mayor = Math.max(grosorI, grosorJ) || 1;
						if (Math.abs(grosorI - grosorJ) / mayor > 0.35) continue;

						mejor = j;
						mejorAlFinal = jAlFinal;
						mejorDot = dot;
					}
				}

				if (mejor < 0) continue;

				// La i queda orientada terminando en el cruce y la j empezando en él.
				const izquierda = iAlFinal ? vivas[i] : [...vivas[i]].reverse();
				const derecha = mejorAlFinal
					? [...vivas[mejor]].reverse()
					: vivas[mejor];
				vivas[i] = [...izquierda, ...derecha.slice(1)];
				muerta[mejor] = 1;
				if (coste) coste.fusiones++;
				hubo = true;
				break;
			}
		}
	}

	return vivas.filter((_, i) => !muerta[i]);
}

/**
 * Lo que queda de la forma después de coser unas ramas como columnas.
 *
 * Cada punto de una columna tapa un disco del radio de su propia distancia al
 * fondo, que es literalmente el trozo de forma que esa puntada cubre. Lo que no
 * quede tapado —el nudo del cruce de una "H", el remate de una "G"— sale como
 * componente aparte para coserlo de relleno. Si se tirara, la letra tendría
 * agujeros justo en las uniones.
 */
export function sobranteDe(
	rejilla: Rejilla,
	componente: Componente,
	distancia: Float32Array,
	cubiertas: Rama[],
): Componente[] {
	const { ancho, alto } = rejilla;
	const resto = new Uint8Array(ancho * alto);
	for (const p of componente.pixeles) resto[p] = 1;

	for (const rama of cubiertas) {
		// Discos consecutivos se solapan casi del todo; se estampa uno de cada
		// tercio de radio y el resultado no cambia.
		const radio = Math.max(
			1,
			Math.round(rama.grosorMedianoMm / 2 / rejilla.mmPorPx),
		);
		const salto = Math.max(1, Math.floor(radio / 3));

		for (let k = 0; k < rama.pixeles.length; k += salto) {
			const p = rama.pixeles[k];
			const cx = p % ancho;
			const cy = (p / ancho) | 0;
			// Un pelo más que la distancia real, para no dejar una orla de un píxel
			// que después se contaría como una región suelta.
			const r = Math.ceil(distancia[p]) + 1;

			for (let dy = -r; dy <= r; dy++) {
				const y = cy + dy;
				if (y < 0 || y >= alto) continue;
				const media = Math.floor(Math.sqrt(r * r - dy * dy));
				const desde = Math.max(0, cx - media);
				const hasta = Math.min(ancho - 1, cx + media);
				for (let x = desde; x <= hasta; x++) resto[y * ancho + x] = 0;
			}
		}
	}

	return componentes({ ...rejilla, datos: resto });
}

/** La distancia al fondo restringida a un componente. Atajo para quien llama. */
export function distanciaDe(
	rejilla: Rejilla,
	componente: Componente,
): Float32Array {
	const soloEste = new Uint8Array(rejilla.ancho * rejilla.alto);
	for (const p of componente.pixeles) soloEste[p] = 1;
	return distanciaAlFondo({ ...rejilla, datos: soloEste });
}
