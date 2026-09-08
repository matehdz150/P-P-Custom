/**
 * Medir una forma en milímetros para decidir cómo se borda.
 *
 * POR QUÉ SOBRE UNA REJILLA Y NO SOBRE POLÍGONOS. Lo que hay que saber de una
 * forma —cuál es su eje, qué grosor tiene ese eje y si el grosor se mantiene—
 * es el eje medial, y calcularlo analíticamente sobre polígonos arbitrarios es
 * frágil y largo. Sobre una máscara de píxeles sale de una transformada de
 * distancia, que son treinta líneas y se comporta igual con la panza de una "a"
 * que con una mancha de un logo rasterizado.
 *
 * Y ADEMÁS UNIFICA LAS DOS ENTRADAS. El raster ya es una máscara, y una letra
 * se rasteriza en un momento; a partir de ahí texto e imagen se miden con el
 * mismo código, así que no hay dos definiciones de "asta demasiado fina" que se
 * puedan ir separando con el tiempo.
 *
 * TODO SALE EN MILÍMETROS. La rejilla trae su escala y aquí no se devuelve ni
 * un píxel: una región de 40 px es válida a 10 cm y basura a 2 cm, así que un
 * umbral en píxeles sería una respuesta a la pregunta equivocada.
 *
 * NO HAY DOM: esto vive en el paquete compartido para que el worker y las
 * pruebas de node puedan usarlo sin un navegador.
 */

/** Una máscara binaria con su escala física. 1 = hay diseño. */
export type Rejilla = {
	datos: Uint8Array;
	ancho: number;
	alto: number;
	/** Cuántos milímetros mide el lado de un píxel. */
	mmPorPx: number;
};

export type Componente = {
	/** Índices de los píxeles que lo forman. */
	pixeles: Int32Array;
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

export type MedidasDeForma = {
	areaMm2: number;
	anchoMm: number;
	altoMm: number;
	/** Grosor típico del trazo: la mediana del eje, por dos. */
	grosorMedianoMm: number;
	grosorMinimoMm: number;
	grosorMaximoMm: number;
	/**
	 * Cuán constante es el grosor a lo largo del eje, de 0 a 1.
	 *
	 * Es lo que separa una columna satin de una mancha: una "l" tiene grosor casi
	 * idéntico en todo su eje y una salpicadura no.
	 */
	uniformidad: number;
	/** Largo del eje medial. Con el grosor, dice si la forma es alargada. */
	largoEjeMm: number;
	/** Agujeros interiores, en mm². Las contraformas de una "o" o una "B". */
	huecosMm2: number[];
};

const VECINOS_8 = [
	[-1, -1],
	[0, -1],
	[1, -1],
	[-1, 0],
	[1, 0],
	[-1, 1],
	[0, 1],
	[1, 1],
] as const;

/**
 * Los trozos conexos de la máscara.
 *
 * CONECTIVIDAD 8 y no 4: una diagonal de un píxel de ancho —el asta de una "N"
 * pequeña, el rabo de una "Q"— queda partida en cuadraditos sueltos con
 * conectividad 4, y cada cuadradito se contaría como una región minúscula que
 * después se borra por pequeña. Se perdía justo el detalle fino.
 */
export function componentes(rejilla: Rejilla): Componente[] {
	const { datos, ancho, alto } = rejilla;
	const visto = new Uint8Array(ancho * alto);
	const salida: Componente[] = [];
	const cola = new Int32Array(ancho * alto);

	for (let inicio = 0; inicio < datos.length; inicio++) {
		if (!datos[inicio] || visto[inicio]) continue;

		let cabeza = 0;
		let fin = 0;
		cola[fin++] = inicio;
		visto[inicio] = 1;

		let minX = ancho;
		let minY = alto;
		let maxX = -1;
		let maxY = -1;
		const pixeles: number[] = [];

		while (cabeza < fin) {
			const p = cola[cabeza++];
			const x = p % ancho;
			const y = (p / ancho) | 0;

			pixeles.push(p);
			if (x < minX) minX = x;
			if (y < minY) minY = y;
			if (x > maxX) maxX = x;
			if (y > maxY) maxY = y;

			for (const [dx, dy] of VECINOS_8) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
				const q = ny * ancho + nx;
				if (datos[q] && !visto[q]) {
					visto[q] = 1;
					cola[fin++] = q;
				}
			}
		}

		salida.push({ pixeles: Int32Array.from(pixeles), minX, minY, maxX, maxY });
	}

	return salida;
}

/**
 * Distancia de cada píxel de diseño al fondo más cercano.
 *
 * Es el chamfer 3-4 en dos pasadas: aproxima la distancia euclídea con un error
 * por debajo del 2 %, que sobre décimas de milímetro no cambia ninguna
 * decisión, y cuesta dos recorridos en vez de una cola de prioridad.
 *
 * LO QUE HAY FUERA DE LA REJILLA CUENTA COMO FONDO. Sin esto, una forma que
 * toca el borde —un logo recortado a ras, una barra que cruza el lienzo de
 * lado a lado— no tiene ningún fondo contra el que medirse: su distancia crece
 * sin tope, su grosor sale enorme y termina de relleno cuando era una columna.
 * El diseño está acotado por su área; el borde ES el final del diseño.
 */
export function distanciaAlFondo(rejilla: Rejilla): Float32Array {
	const { datos, ancho, alto } = rejilla;
	const d = new Float32Array(ancho * alto);
	const GRANDE = 1e9;

	for (let i = 0; i < datos.length; i++) d[i] = datos[i] ? GRANDE : 0;

	const mira = (i: number, j: number, coste: number) => {
		const v = d[j] + coste;
		if (v < d[i]) d[i] = v;
	};
	/** Un vecino que cae fuera de la rejilla es fondo, a distancia cero. */
	const fuera = (i: number, coste: number) => {
		if (coste < d[i]) d[i] = coste;
	};

	for (let y = 0; y < alto; y++) {
		for (let x = 0; x < ancho; x++) {
			const i = y * ancho + x;
			if (!d[i]) continue;
			if (x > 0) mira(i, i - 1, 3);
			else fuera(i, 3);
			if (y > 0) mira(i, i - ancho, 3);
			else fuera(i, 3);
			if (x > 0 && y > 0) mira(i, i - ancho - 1, 4);
			else fuera(i, 4);
			if (x < ancho - 1 && y > 0) mira(i, i - ancho + 1, 4);
			else fuera(i, 4);
		}
	}

	for (let y = alto - 1; y >= 0; y--) {
		for (let x = ancho - 1; x >= 0; x--) {
			const i = y * ancho + x;
			if (!d[i]) continue;
			if (x < ancho - 1) mira(i, i + 1, 3);
			else fuera(i, 3);
			if (y < alto - 1) mira(i, i + ancho, 3);
			else fuera(i, 3);
			if (x < ancho - 1 && y < alto - 1) mira(i, i + ancho + 1, 4);
			else fuera(i, 4);
			if (x > 0 && y < alto - 1) mira(i, i + ancho - 1, 4);
			else fuera(i, 4);
		}
	}

	// El chamfer cuenta en tercios de píxel; se devuelve en píxeles.
	for (let i = 0; i < d.length; i++) d[i] /= 3;
	return d;
}

/**
 * El eje de la forma: los píxeles que están en la cresta de la distancia.
 *
 * NO ES UN ADELGAZAMIENTO MORFOLÓGICO. Zhang-Suen daría un esqueleto más limpio
 * de un píxel, pero cuesta varias pasadas y para lo que hace falta aquí —saber
 * el grosor típico y si se mantiene— basta con quedarse con los máximos
 * locales de la distancia, que son el eje medial por definición.
 */
export function crestaDeDistancia(
	rejilla: Rejilla,
	componente: Componente,
	distancia: Float32Array,
): number[] {
	const { ancho } = rejilla;
	const cresta: number[] = [];

	for (const p of componente.pixeles) {
		const dp = distancia[p];
		if (dp <= 0) continue;

		const x = p % ancho;
		const y = (p / ancho) | 0;
		let esMaximo = true;

		for (const [dx, dy] of VECINOS_8) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || ny < 0 || nx >= rejilla.ancho || ny >= rejilla.alto)
				continue;
			// Estrictamente mayor: en una meseta se quedan todos, que es lo que se
			// quiere para poder medir el largo del eje.
			if (distancia[ny * ancho + nx] > dp + 1e-6) {
				esMaximo = false;
				break;
			}
		}

		if (esMaximo) cresta.push(p);
	}

	return cresta;
}

type HuecoLocal = {
	mascara: Uint8Array;
	pixeles: Int32Array;
	ancho: number;
	alto: number;
	offsetX: number;
	offsetY: number;
};

/**
 * Los agujeros encerrados por un componente, sobre una rejilla local.
 *
 * El fondo se inunda DESDE EL MARCO: lo que quede sin marcar y sin diseño está
 * encerrado, y eso es una contraforma. Un recuento a secas contaría también el
 * fondo exterior como si fuera un hueco.
 */
function huecosLocales(rejilla: Rejilla, componente: Componente): HuecoLocal[] {
	const ancho = componente.maxX - componente.minX + 3;
	const alto = componente.maxY - componente.minY + 3;
	const offsetX = componente.minX - 1;
	const offsetY = componente.minY - 1;
	const dentro = new Uint8Array(ancho * alto);

	for (const p of componente.pixeles) {
		const x = (p % rejilla.ancho) - offsetX;
		const y = ((p / rejilla.ancho) | 0) - offsetY;
		dentro[y * ancho + x] = 1;
	}

	const fuera = new Uint8Array(ancho * alto);
	const cola: number[] = [];
	for (let x = 0; x < ancho; x++) cola.push(x, (alto - 1) * ancho + x);
	for (let y = 0; y < alto; y++) cola.push(y * ancho, y * ancho + ancho - 1);

	while (cola.length) {
		const i = cola.pop() as number;
		if (fuera[i] || dentro[i]) continue;
		fuera[i] = 1;
		const x = i % ancho;
		const y = (i / ancho) | 0;
		if (x > 0) cola.push(i - 1);
		if (x < ancho - 1) cola.push(i + 1);
		if (y > 0) cola.push(i - ancho);
		if (y < alto - 1) cola.push(i + ancho);
	}

	const salida: HuecoLocal[] = [];
	const visto = new Uint8Array(ancho * alto);

	for (let inicio = 0; inicio < dentro.length; inicio++) {
		if (dentro[inicio] || fuera[inicio] || visto[inicio]) continue;

		const pixeles: number[] = [];
		const pila = [inicio];
		visto[inicio] = 1;

		while (pila.length) {
			const i = pila.pop() as number;
			pixeles.push(i);
			const x = i % ancho;
			const y = (i / ancho) | 0;
			for (const [dx, dy] of VECINOS_8) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || ny < 0 || nx >= ancho || ny >= alto) continue;
				const j = ny * ancho + nx;
				if (!dentro[j] && !fuera[j] && !visto[j]) {
					visto[j] = 1;
					pila.push(j);
				}
			}
		}

		const mascara = new Uint8Array(ancho * alto);
		for (const i of pixeles) mascara[i] = 1;
		salida.push({
			mascara,
			pixeles: Int32Array.from(pixeles),
			ancho,
			alto,
			offsetX,
			offsetY,
		});
	}

	return salida;
}

/** Los agujeros interiores de un componente, en mm², de mayor a menor. */
function huecosDe(rejilla: Rejilla, componente: Componente): number[] {
	const area = rejilla.mmPorPx * rejilla.mmPorPx;
	return huecosLocales(rejilla, componente)
		.map((hueco) => hueco.pixeles.length * area)
		.sort((a, b) => b - a);
}

function percentil(ordenados: number[], p: number) {
	if (!ordenados.length) return 0;
	const i = Math.min(
		ordenados.length - 1,
		Math.max(0, Math.round((ordenados.length - 1) * p)),
	);
	return ordenados[i];
}

/** Mide un componente y devuelve todo en milímetros. */
export function medir(
	rejilla: Rejilla,
	componente: Componente,
	distancia: Float32Array,
): MedidasDeForma {
	const mm = rejilla.mmPorPx;
	const cresta = crestaDeDistancia(rejilla, componente, distancia);

	/* El grosor es el DOBLE de la distancia al fondo: la distancia va del eje a
	   un borde, y el trazo tiene dos. */
	const grosores = (cresta.length ? cresta : Array.from(componente.pixeles))
		.map((p) => distancia[p] * 2 * mm)
		.sort((a, b) => a - b);

	const mediano = percentil(grosores, 0.5);
	const p10 = percentil(grosores, 0.1);
	const p90 = percentil(grosores, 0.9);

	/* Uniformidad como p10/p90 y no como desviación típica: lo que importa es si
	   el trozo más fino y el más grueso se parecen, no cuánto se dispersa el
	   conjunto. Una "T" tiene dos anchos y una desviación pequeña; el cociente
	   sí la delata. */
	const uniformidad = p90 > 0 ? Math.min(1, p10 / p90) : 0;

	return {
		areaMm2: componente.pixeles.length * mm * mm,
		anchoMm: (componente.maxX - componente.minX + 1) * mm,
		altoMm: (componente.maxY - componente.minY + 1) * mm,
		grosorMedianoMm: mediano,
		grosorMinimoMm: grosores[0] ?? 0,
		grosorMaximoMm: grosores[grosores.length - 1] ?? 0,
		uniformidad,
		// El eje aproximado por su número de píxeles: para decidir "alargado o no"
		// sobra, y no obliga a ordenar la cresta en una polilínea.
		largoEjeMm: cresta.length * mm,
		huecosMm2: huecosDe(rejilla, componente),
	};
}

/**
 * El borde de un componente recorrido en orden, en píxeles.
 *
 * Trazado de Moore: se avanza mirando a partir de la casilla anterior a la que
 * se venía, que es lo que hace que el recorrido bordee en vez de rebotar.
 */
function trazarBorde(
	rejilla: Rejilla,
	componente: Componente,
): Array<[number, number]> {
	const { datos, ancho, alto } = rejilla;
	const dentro = (x: number, y: number) =>
		x >= 0 && y >= 0 && x < ancho && y < alto && datos[y * ancho + x] === 1;

	let inicio = -1;
	for (const p of componente.pixeles) {
		if (inicio < 0 || p < inicio) inicio = p;
	}
	if (inicio < 0) return [];

	const ix = inicio % ancho;
	const iy = (inicio / ancho) | 0;

	const orden = [
		[1, 0],
		[1, 1],
		[0, 1],
		[-1, 1],
		[-1, 0],
		[-1, -1],
		[0, -1],
		[1, -1],
	] as const;

	const puntos: Array<[number, number]> = [];
	let x = ix;
	let y = iy;
	let direccion = 0;
	const tope = componente.pixeles.length * 8 + 64;

	for (let paso = 0; paso < tope; paso++) {
		puntos.push([x, y]);

		let siguiente = -1;
		for (let k = 0; k < 8; k++) {
			const d = (direccion + 6 + k) % 8;
			const nx = x + orden[d][0];
			const ny = y + orden[d][1];
			if (dentro(nx, ny)) {
				siguiente = d;
				x = nx;
				y = ny;
				break;
			}
		}

		if (siguiente < 0) break;
		direccion = siguiente;
		if (x === ix && y === iy) break;
	}

	return puntos;
}

/**
 * El contorno exterior del componente, ya simplificado y en milímetros.
 *
 * Se simplifica con la tolerancia EN MILÍMETROS que pida el perfil: simplificar
 * en píxeles daría un diseño más burdo cuanto más pequeño se borde, que es al
 * revés de lo que hace falta.
 */
export function contorno(
	rejilla: Rejilla,
	componente: Componente,
	toleranciaMm: number,
): Array<[number, number]> {
	const enMm = trazarBorde(rejilla, componente).map(
		([px, py]) =>
			[px * rejilla.mmPorPx, py * rejilla.mmPorPx] as [number, number],
	);
	return simplificar(enMm, toleranciaMm);
}

/**
 * El contorno exterior MÁS el de cada contraforma.
 *
 * Sin esto una "O" se borda como un disco. El relleno se emite con `evenodd`,
 * así que basta con concatenar los subtrazados: el agujero se resta solo.
 */
export function contornos(
	rejilla: Rejilla,
	componente: Componente,
	toleranciaMm: number,
	minHuecoMm2 = 0,
): {
	exterior: Array<[number, number]>;
	huecos: Array<Array<[number, number]>>;
} {
	const exterior = contorno(rejilla, componente, toleranciaMm);
	const mm = rejilla.mmPorPx;
	const huecos: Array<Array<[number, number]>> = [];

	for (const hueco of huecosLocales(rejilla, componente)) {
		if (hueco.pixeles.length * mm * mm < minHuecoMm2) continue;
		const sub: Rejilla = {
			datos: hueco.mascara,
			ancho: hueco.ancho,
			alto: hueco.alto,
			mmPorPx: mm,
		};
		const trazo = trazarBorde(sub, {
			pixeles: hueco.pixeles,
			minX: 0,
			minY: 0,
			maxX: hueco.ancho - 1,
			maxY: hueco.alto - 1,
		}).map(
			([px, py]) =>
				[(px + hueco.offsetX) * mm, (py + hueco.offsetY) * mm] as [
					number,
					number,
				],
		);
		const simple = simplificar(trazo, toleranciaMm);
		if (simple.length >= 3) huecos.push(simple);
	}

	return { exterior, huecos };
}

/**
 * El eje central del componente como polilínea ordenada, en milímetros.
 *
 * ES LO QUE EL SATIN NECESITA Y NO EL CONTORNO. El worker emite una columna
 * como `stroke` con `stroke-width`, así que la geometría que se le entrega
 * tiene que ser la LÍNEA CENTRAL del trazo; si se le mandara el contorno, la
 * máquina bordearía el perímetro con una columna de ese ancho y saldría el
 * doble de gorda y hueca por dentro.
 *
 * Del conjunto de píxeles de la cresta se toma el camino más largo (dos BFS,
 * el truco del diámetro de un árbol). Las ramitas laterales que deja la
 * transformada de distancia se descartan solas al quedarse fuera de ese camino.
 */
export function ejeCentral(
	rejilla: Rejilla,
	componente: Componente,
	distancia: Float32Array,
	toleranciaMm: number,
): Array<[number, number]> {
	const cresta = crestaDeDistancia(rejilla, componente, distancia);
	if (cresta.length < 2) return [];

	const { ancho } = rejilla;
	const indice = new Map<number, number>();
	cresta.forEach((p, i) => {
		indice.set(p, i);
	});

	const vecinos = cresta.map((p) => {
		const x = p % ancho;
		const y = (p / ancho) | 0;
		const salida: number[] = [];
		for (const [dx, dy] of VECINOS_8) {
			const j = indice.get((y + dy) * ancho + (x + dx));
			if (j !== undefined) salida.push(j);
		}
		return salida;
	});

	const lejano = (desde: number) => {
		const previo = new Int32Array(cresta.length).fill(-1);
		const visto = new Uint8Array(cresta.length);
		const cola = [desde];
		visto[desde] = 1;
		let ultimo = desde;
		for (let c = 0; c < cola.length; c++) {
			const i = cola[c];
			ultimo = i;
			for (const j of vecinos[i]) {
				if (!visto[j]) {
					visto[j] = 1;
					previo[j] = i;
					cola.push(j);
				}
			}
		}
		return { ultimo, previo };
	};

	const a = lejano(0).ultimo;
	const { ultimo: b, previo } = lejano(a);

	const camino: Array<[number, number]> = [];
	for (let i = b; i >= 0; i = previo[i]) {
		const p = cresta[i];
		camino.push([
			(p % ancho) * rejilla.mmPorPx,
			((p / ancho) | 0) * rejilla.mmPorPx,
		]);
	}

	return simplificar(camino, toleranciaMm);
}

/** Douglas-Peucker. La tolerancia va en las mismas unidades que los puntos. */
export function simplificar(
	puntos: Array<[number, number]>,
	tolerancia: number,
): Array<[number, number]> {
	if (puntos.length < 3) return puntos;

	const guardar = new Uint8Array(puntos.length);
	guardar[0] = 1;
	guardar[puntos.length - 1] = 1;

	const pila: Array<[number, number]> = [[0, puntos.length - 1]];

	while (pila.length) {
		const [desde, hasta] = pila.pop() as [number, number];
		if (hasta <= desde + 1) continue;

		const [ax, ay] = puntos[desde];
		const [bx, by] = puntos[hasta];
		const dx = bx - ax;
		const dy = by - ay;
		const norma = Math.hypot(dx, dy) || 1;

		let peor = -1;
		let peorD = tolerancia;

		for (let i = desde + 1; i < hasta; i++) {
			const [px, py] = puntos[i];
			const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / norma;
			if (d > peorD) {
				peorD = d;
				peor = i;
			}
		}

		if (peor > 0) {
			guardar[peor] = 1;
			pila.push([desde, peor], [peor, hasta]);
		}
	}

	return puntos.filter((_, i) => guardar[i] === 1);
}

/** Un polígono en mm como comandos SVG, con los decimales justos. */
export function comoPath(
	puntos: Array<[number, number]>,
	cerrado = true,
): string {
	if (!puntos.length) return "";
	const n = (v: number) => Number(v.toFixed(3)).toString();
	const cuerpo = puntos
		.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`)
		.join("");
	return cerrado ? `${cuerpo}Z` : cuerpo;
}

/** Un contorno con sus huecos como un solo `d`. Se emite con `evenodd`. */
export function comoPathCompuesto(partes: {
	exterior: Array<[number, number]>;
	huecos: Array<Array<[number, number]>>;
}): string {
	return [partes.exterior, ...partes.huecos]
		.filter((p) => p.length >= 3)
		.map((p) => comoPath(p, true))
		.join("");
}

/**
 * Quita el ruido de un píxel de una máscara recién segmentada.
 *
 * POR QUÉ HACE FALTA. Un logo con antialias cortado por un umbral deja una orla
 * de islas de uno o dos píxeles a lo largo de TODO su contorno. No son detalle:
 * son el borde difuso de la imagen partido por la mitad. Sin limpiarlas, el
 * logo Discovery Park producía 1214 "regiones" —más que una fotografía— y
 * cualquier medida de complejidad que se hiciera encima decía lo contrario de
 * la verdad.
 *
 * Es un filtro de mayoría en 3x3: un píxel se queda encendido si al menos cinco
 * de sus nueve lo están. Rellena las mordidas de un píxel y borra las islas
 * sueltas en la misma pasada, y no encoge las formas de verdad, porque en el
 * interior de un trazo la mayoría siempre se cumple.
 *
 * NO SUSTITUYE AL ÁREA MÍNIMA. Esto quita ruido de muestreo; lo que quita
 * detalle que no se puede bordar es `minAreaMm2`, y ese sigue midiéndose en
 * milímetros después.
 */
export function limpiar(rejilla: Rejilla, pasadas = 1): Rejilla {
	const { ancho, alto } = rejilla;
	let actual = rejilla.datos;

	for (let vuelta = 0; vuelta < pasadas; vuelta++) {
		const siguiente = new Uint8Array(ancho * alto);
		for (let y = 0; y < alto; y++) {
			for (let x = 0; x < ancho; x++) {
				let vecinos = 0;
				for (let dy = -1; dy <= 1; dy++) {
					const ny = y + dy;
					if (ny < 0 || ny >= alto) continue;
					for (let dx = -1; dx <= 1; dx++) {
						const nx = x + dx;
						if (nx < 0 || nx >= ancho) continue;
						vecinos += actual[ny * ancho + nx];
					}
				}
				siguiente[y * ancho + x] = vecinos >= 5 ? 1 : 0;
			}
		}
		actual = siguiente;
	}

	return { ...rejilla, datos: actual };
}
