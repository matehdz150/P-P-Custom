"use client";

/**
 * Separar el diseño del fondo por COLOR, no por luminancia.
 *
 * EL FALLO QUE ESTO ARREGLA. VTracer en modo `binary` decide qué es diseño y
 * qué es fondo por lo claro que es cada píxel. Sobre un logo a color eso no
 * significa nada: el amarillo de un isotipo es `rgb(245,196,0)` y su luminancia
 * es 188 sobre 255 —más clara que el gris medio—, así que el trazador lo
 * clasificaba como FONDO y lo borraba. En un logo real se comprobó exactamente
 * eso: el verde (112), el azul (80) y el gris (89) sobrevivían, y el cuarto
 * amarillo del isotipo y una línea entera de texto naranja (165) desaparecían
 * sin dejar rastro ni aviso.
 *
 * LO QUE HACE FALTA NO ES "OSCURO", ES "DISTINTO DEL FONDO". Un grabado no
 * tiene colores: todo lo que es diseño se quema y el resto no. Así que la
 * pregunta correcta es cuánto se aleja cada píxel del color del papel, y eso se
 * mide en distancia de color, no en brillo.
 *
 * SE MIDE EN LAB Y NO EN RGB porque RGB miente en las distancias: el amarillo y
 * el blanco están lejísimos para el ojo y cerca en RGB. Lab está construido
 * para que la distancia numérica se parezca a la diferencia percibida, que es
 * justo lo que hay que decidir aquí.
 *
 * SÓLO PARA LINE ART. Una fotografía no tiene "un color de fondo" que estimar,
 * y ahí la luminancia sí es lo que se quiere: las sombras se queman y las luces
 * no. El perfil `imagen` no pasa por aquí.
 */

/** sRGB a lineal, precalculado: son 256 valores y se usan en cada píxel. */
const LINEAL = new Float64Array(256);
for (let i = 0; i < 256; i++) {
	const c = i / 255;
	LINEAL[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const f = (t: number) =>
	t > 0.008856451679 ? Math.cbrt(t) : 7.787037 * t + 16 / 116;

/**
 * Un color en Lab, con memoria.
 *
 * LA CACHÉ NO ES UN LUJO: un logo tiene un puñado de colores repartidos por
 * millones de píxeles. Sin ella se convierten los mismos seis colores dos
 * millones y medio de veces, y la máscara pasaba de milisegundos a décimas de
 * segundo. Con tope, porque una imagen ruidosa sí trae muchos.
 */
const memoria = new Map<number, [number, number, number]>();

export function aLab(
	r: number,
	g: number,
	b: number,
): [number, number, number] {
	const llave = (r << 16) | (g << 8) | b;
	const guardado = memoria.get(llave);
	if (guardado) return guardado;

	const R = LINEAL[r];
	const G = LINEAL[g];
	const B = LINEAL[b];

	const x = f((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
	const y = f(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
	const z = f((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);

	const lab: [number, number, number] = [
		116 * y - 16,
		500 * (x - y),
		200 * (y - z),
	];

	if (memoria.size < 40000) memoria.set(llave, lab);
	return lab;
}

/**
 * El color del fondo, estimado desde el marco.
 *
 * SE MIRA EL BORDE porque es donde el fondo está casi siempre, y se toma la
 * MEDIANA y no el promedio: si el diseño toca un lado —una firma en una
 * esquina, un marco de color— la mediana lo ignora y el promedio se lo come.
 */
export function fondoDe(datos: Uint8ClampedArray, ancho: number, alto: number) {
	const grosor = Math.max(2, Math.round(Math.min(ancho, alto) * 0.02));
	const rs: number[] = [];
	const gs: number[] = [];
	const bs: number[] = [];

	for (let y = 0; y < alto; y++) {
		for (let x = 0; x < ancho; x++) {
			const borde =
				x < grosor || y < grosor || x >= ancho - grosor || y >= alto - grosor;
			if (!borde) continue;
			const i = (y * ancho + x) * 4;
			rs.push(datos[i]);
			gs.push(datos[i + 1]);
			bs.push(datos[i + 2]);
		}
	}

	const mediana = (a: number[]) => {
		a.sort((p, q) => p - q);
		return a[a.length >> 1] ?? 255;
	};

	return [mediana(rs), mediana(gs), mediana(bs)] as const;
}

/**
 * El corte entre fondo y diseño, buscado en el histograma de distancias.
 *
 * Es Otsu: parte la población en dos de forma que queden lo más separadas
 * posible. Se usa en vez de un número escrito a mano porque el umbral correcto
 * depende del logo —uno a dos tintas y uno con degradados no se cortan igual— y
 * un número fijo acertaría en unos y borraría otros, que es de donde venimos.
 */
export function otsu(hist: Uint32Array, total: number) {
	let suma = 0;
	for (let i = 0; i < 256; i++) suma += i * hist[i];

	let sumaB = 0;
	let pesoB = 0;
	let mejor = 0;
	let umbral = 0;

	for (let t = 0; t < 256; t++) {
		pesoB += hist[t];
		if (!pesoB) continue;

		const pesoF = total - pesoB;
		if (!pesoF) break;

		sumaB += t * hist[t];
		const mediaB = sumaB / pesoB;
		const mediaF = (suma - sumaB) / pesoF;
		const entre = pesoB * pesoF * (mediaB - mediaF) ** 2;

		if (entre > mejor) {
			mejor = entre;
			umbral = t;
		}
	}

	return umbral;
}

/**
 * Convierte la imagen en una máscara: negro donde hay diseño, blanco el fondo.
 *
 * Trabaja SOBRE el mismo buffer y lo devuelve en gris, listo para VTracer: a
 * partir de aquí su binarización por luminancia hace lo correcto, porque en la
 * máscara "oscuro" ya significa "esto es diseño".
 */
export function mascaraDeDiseno(
	datos: Uint8ClampedArray,
	ancho: number,
	alto: number,
) {
	const n = ancho * alto;

	/* 1) CON TRANSPARENCIA NO HAY QUE ADIVINAR NADA. Si el PNG trae fondo
	   transparente, el propio alfa dice qué es diseño; estimar un color sería
	   inventar un problema que el archivo ya resolvió. */
	let transparentes = 0;
	for (let i = 3; i < datos.length; i += 4) {
		if (datos[i] < 250) transparentes++;
	}
	const porAlfa = transparentes > n * 0.02;

	const distancia = new Float32Array(n);
	let maxima = 0;

	if (porAlfa) {
		for (let p = 0, i = 0; p < n; p++, i += 4) {
			const d = datos[i + 3];
			distancia[p] = d;
			if (d > maxima) maxima = d;
		}
	} else {
		const [fr, fg, fb] = fondoDe(datos, ancho, alto);
		const fondo = aLab(fr, fg, fb);

		for (let p = 0, i = 0; p < n; p++, i += 4) {
			const lab = aLab(datos[i], datos[i + 1], datos[i + 2]);
			const dl = lab[0] - fondo[0];
			const da = lab[1] - fondo[1];
			const db = lab[2] - fondo[2];
			const d = Math.sqrt(dl * dl + da * da + db * db);

			distancia[p] = d;
			if (d > maxima) maxima = d;
		}
	}

	// Un solo color en toda la imagen: no hay diseño que separar del fondo.
	if (!(maxima > 0)) {
		for (let i = 0; i < datos.length; i += 4) {
			datos[i] = datos[i + 1] = datos[i + 2] = 255;
			datos[i + 3] = 255;
		}
		return { vacia: true, porAlfa };
	}

	const hist = new Uint32Array(256);
	for (let p = 0; p < n; p++) {
		hist[Math.min(255, ((distancia[p] / maxima) * 255) | 0)]++;
	}
	const corte = Math.max(1, otsu(hist, n)) * (maxima / 255);

	/* EL ANTIALIAS SE CONSERVA, y por eso esto no es un corte duro: la distancia
	   se estira a una rampa con el umbral justo en el gris medio. Los píxeles de
	   borde —a media distancia del fondo— salen en grises intermedios, que es la
	   misma información que VTracer tendría de una imagen en escala de grises.
	   Con un corte a secas, los bordes salen dentados y las letras finas se
	   parten. */
	for (let p = 0, i = 0; p < n; p++, i += 4) {
		const v =
			255 -
			Math.max(0, Math.min(255, Math.round((distancia[p] / corte) * 128)));
		datos[i] = datos[i + 1] = datos[i + 2] = v;
		datos[i + 3] = 255;
	}

	return { vacia: false, porAlfa };
}
