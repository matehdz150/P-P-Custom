"use client";

import { aLab, fondoDe, mascaraDeDiseno, otsu } from "./mascara";

export type ClaseImagen =
	| "logo-line-art"
	| "icono-geometrico"
	| "ilustracion"
	| "fotografia";

export type MetricasInput = {
	alpha: {
		transparente: number;
		parcial: number;
		opaco: number;
		fuerte: boolean;
	};
	color: {
		top1: number;
		top8: number;
		entropiaBits: number;
		entropiaNormalizada: number;
		bins: number;
	};
	tonoContinuo: number;
	densidadBordes: number;
	uniformidadFondoBorde: number;
	textura: number;
	componentes: {
		total: number;
		pequenos: number;
		fraccionAreaPequena: number;
	};
};

export type Clasificacion = {
	clase: ClaseImagen;
	confianza: number;
	ambigua: boolean;
	scores: Record<ClaseImagen, number>;
	margen: number;
};

export type Preparado = {
	datos: Uint8ClampedArray;
	ancho: number;
	alto: number;
	escala: number;
	referencia: Uint8Array;
	luminanciaOriginal?: Uint8Array;
	umbralLuminancia?: number;
};

export type Candidato = {
	nombre: string;
	pixeles: Uint8Array;
	config: Record<string, unknown>;
	transformar?: (svg: string) => string;
};

export type Validacion = {
	valida: boolean;
	errores: string[];
	nodos: number;
	paths: number;
	dimensionesCorrectas: boolean;
};

export type Evaluacion = {
	score: number;
	fidelidadVisual: number;
	penalizacionComplejidad: number;
	foregroundPerdido: number;
	foregroundAnadido: number;
	similitudBordesF1: number;
	huecosReferencia: number;
	huecosSalida: number;
	errorHuecos: number;
	componentesReferencia: number;
	componentesPerdidos: number;
	recallComponentes: number;
};

export const NODOS_MAXIMOS_ADAPTATIVO = 20_000;
const PIXELES_MAXIMOS = 3_000_000;

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const redondear = (v: number, n = 4) => Number(v.toFixed(n));
const luma = (r: number, g: number, b: number) =>
	0.2126 * r + 0.7152 * g + 0.0722 * b;
const distanciaLab = (a: number[], b: number[]) =>
	Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function lienzoDeImagen(imagen: HTMLImageElement, ancho: number, alto: number) {
	const lienzo = document.createElement("canvas");
	lienzo.width = ancho;
	lienzo.height = alto;
	const ctx = lienzo.getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("No pudimos leer la imagen.");
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(imagen, 0, 0, ancho, alto);
	return ctx.getImageData(0, 0, ancho, alto);
}

function componentes(
	mask: Uint8Array,
	ancho: number,
	alto: number,
	valor = 1,
	areaMinima = 1,
) {
	const vistos = new Uint8Array(mask.length);
	const areas: number[] = [];
	const cola = new Int32Array(mask.length);
	for (let inicio = 0; inicio < mask.length; inicio++) {
		if (vistos[inicio] || Number(mask[inicio]) !== valor) continue;
		let cabeza = 0;
		let fin = 0;
		let area = 0;
		cola[fin++] = inicio;
		vistos[inicio] = 1;
		while (cabeza < fin) {
			const p = cola[cabeza++];
			const x = p % ancho;
			const y = (p / ancho) | 0;
			area++;
			if (x && !vistos[p - 1] && Number(mask[p - 1]) === valor) {
				vistos[p - 1] = 1;
				cola[fin++] = p - 1;
			}
			if (x + 1 < ancho && !vistos[p + 1] && Number(mask[p + 1]) === valor) {
				vistos[p + 1] = 1;
				cola[fin++] = p + 1;
			}
			if (y && !vistos[p - ancho] && Number(mask[p - ancho]) === valor) {
				vistos[p - ancho] = 1;
				cola[fin++] = p - ancho;
			}
			if (
				y + 1 < alto &&
				!vistos[p + ancho] &&
				Number(mask[p + ancho]) === valor
			) {
				vistos[p + ancho] = 1;
				cola[fin++] = p + ancho;
			}
		}
		if (area >= areaMinima) areas.push(area);
	}
	return areas;
}

export function analizarInput(imagen: HTMLImageElement): MetricasInput {
	const lado = 320;
	const escala = Math.min(
		1,
		lado / Math.max(imagen.naturalWidth, imagen.naturalHeight),
	);
	const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
	const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));
	const datos = lienzoDeImagen(imagen, ancho, alto).data;
	const n = ancho * alto;
	const luminancias = new Float32Array(n);
	const colores = new Map<number, number>();
	let transparentes = 0;
	let parciales = 0;
	let opacos = 0;
	let visibles = 0;

	for (let p = 0; p < n; p++) {
		const i = p * 4;
		const alpha = datos[i + 3];
		if (alpha < 250) transparentes++;
		else opacos++;
		if (alpha > 5 && alpha < 250) parciales++;
		const af = alpha / 255;
		const r = datos[i] * af + 255 * (1 - af);
		const g = datos[i + 1] * af + 255 * (1 - af);
		const b = datos[i + 2] * af + 255 * (1 - af);
		luminancias[p] = luma(r, g, b);
		if (alpha > 16) {
			visibles++;
			const k =
				((datos[i] >> 4) << 8) |
				((datos[i + 1] >> 4) << 4) |
				(datos[i + 2] >> 4);
			colores.set(k, (colores.get(k) ?? 0) + 1);
		}
	}

	const alphaFuerte = transparentes / n > 0.02;
	const frecuencias = [...colores.values()].sort((a, b) => b - a);
	const top1 = (frecuencias[0] ?? 0) / Math.max(1, visibles);
	const top8 =
		frecuencias.slice(0, 8).reduce((a, b) => a + b, 0) / Math.max(1, visibles);
	let entropia = 0;
	for (const frecuencia of frecuencias) {
		const proporcion = frecuencia / Math.max(1, visibles);
		entropia -= proporcion * Math.log2(proporcion);
	}

	let pares = 0;
	let gradientesSuaves = 0;
	let bordes = 0;
	let laplaciano = 0;
	let interiores = 0;
	for (let y = 1; y < alto - 1; y++) {
		for (let x = 1; x < ancho - 1; x++) {
			const p = y * ancho + x;
			const gx =
				-luminancias[p - ancho - 1] -
				2 * luminancias[p - 1] -
				luminancias[p + ancho - 1] +
				luminancias[p - ancho + 1] +
				2 * luminancias[p + 1] +
				luminancias[p + ancho + 1];
			const gy =
				-luminancias[p - ancho - 1] -
				2 * luminancias[p - ancho] -
				luminancias[p - ancho + 1] +
				luminancias[p + ancho - 1] +
				2 * luminancias[p + ancho] +
				luminancias[p + ancho + 1];
			if (Math.hypot(gx, gy) > 100) bordes++;
			laplaciano += Math.abs(
				4 * luminancias[p] -
					luminancias[p - 1] -
					luminancias[p + 1] -
					luminancias[p - ancho] -
					luminancias[p + ancho],
			);
			interiores++;
			const diferencia = Math.abs(luminancias[p] - luminancias[p + 1]);
			if (diferencia > 1 && diferencia < 24) gradientesSuaves++;
			pares++;
		}
	}

	const grosor = Math.max(2, Math.round(Math.min(ancho, alto) * 0.02));
	const fondo = aLab(...fondoDe(datos, ancho, alto));
	let muestrasBorde = 0;
	let bordeUniforme = 0;
	for (let y = 0; y < alto; y++) {
		for (let x = 0; x < ancho; x++) {
			if (x >= grosor && y >= grosor && x < ancho - grosor && y < alto - grosor)
				continue;
			const i = (y * ancho + x) * 4;
			const uniforme = alphaFuerte
				? datos[i + 3] < 25
				: distanciaLab(aLab(datos[i], datos[i + 1], datos[i + 2]), fondo) < 8;
			if (uniforme) bordeUniforme++;
			muestrasBorde++;
		}
	}

	const copia = new Uint8ClampedArray(datos);
	mascaraDeDiseno(copia, ancho, alto);
	const mascara = new Uint8Array(n);
	let areaForeground = 0;
	for (let p = 0; p < n; p++) {
		mascara[p] = copia[p * 4] < 128 ? 1 : 0;
		areaForeground += mascara[p];
	}
	const areas = componentes(mascara, ancho, alto, 1, 2);
	const limitePequeno = Math.max(6, n * 0.0002);
	const pequenos = areas.filter((area) => area <= limitePequeno);
	const areaPequena = pequenos.reduce((a, b) => a + b, 0);

	return {
		alpha: {
			transparente: redondear(transparentes / n),
			parcial: redondear(parciales / n),
			opaco: redondear(opacos / n),
			fuerte: alphaFuerte,
		},
		color: {
			top1: redondear(top1),
			top8: redondear(top8),
			entropiaBits: redondear(entropia),
			entropiaNormalizada: redondear(entropia / 12),
			bins: colores.size,
		},
		tonoContinuo: redondear(
			clamp((gradientesSuaves / Math.max(1, pares)) * 3.2),
		),
		densidadBordes: redondear(clamp((bordes / Math.max(1, interiores)) * 4)),
		uniformidadFondoBorde: redondear(
			bordeUniforme / Math.max(1, muestrasBorde),
		),
		textura: redondear(clamp(laplaciano / Math.max(1, interiores) / 45)),
		componentes: {
			total: areas.length,
			pequenos: pequenos.length,
			fraccionAreaPequena: redondear(areaPequena / Math.max(1, areaForeground)),
		},
	};
}

export function clasificar(metricas: MetricasInput): Clasificacion {
	const e = clamp(metricas.color.entropiaBits / 6);
	const plano = metricas.color.top8;
	const tono = metricas.tonoContinuo;
	const textura = metricas.textura;
	const bordes = metricas.densidadBordes;
	const fondo = metricas.uniformidadFondoBorde;
	const cantidad = metricas.componentes.total;
	const pocos = 1 - clamp((cantidad - 1) / 20);
	const geometriaPlana =
		pocos * (1 - bordes) * (1 - textura) * clamp((1 - e) * 1.5);
	const complejidadMedia = 1 - clamp(Math.abs(cantidad - 18) / 25);
	const scores: Record<ClaseImagen, number> = {
		"logo-line-art":
			0.3 * plano +
			0.2 * fondo +
			0.19 * (1 - tono) +
			0.14 * (1 - textura) +
			0.17 * bordes,
		"icono-geometrico":
			0.29 * plano +
			0.2 * fondo +
			0.18 * (1 - tono) +
			0.14 * (1 - textura) +
			0.19 * geometriaPlana,
		ilustracion:
			0.2 * (1 - Math.abs(e - 0.48)) +
			0.18 * (1 - Math.abs(plano - 0.76)) +
			0.22 * bordes +
			0.16 * fondo +
			0.14 * complejidadMedia +
			0.1 * (1 - textura * 0.5),
		fotografia: 0.3 * e + 0.38 * tono + 0.17 * textura + 0.15 * (1 - plano),
	};

	if (
		cantidad <= 5 &&
		plano > 0.9 &&
		metricas.color.entropiaBits < 1.5 &&
		bordes < 0.28 &&
		textura < 0.18
	)
		scores["icono-geometrico"] += 0.1;
	if (cantidad >= 6)
		scores["logo-line-art"] += Math.min(0.08, Math.log2(cantidad) / 80);
	scores["logo-line-art"] -= 0.45 * tono * e;
	scores["icono-geometrico"] -= 0.5 * tono * e;
	scores.fotografia += 0.3 * tono * e;
	scores.ilustracion -= 0.3 * tono * e;
	scores["logo-line-art"] += 0.22 * bordes * (1 - tono);

	if (
		plano >= 0.9 &&
		plano <= 0.97 &&
		metricas.color.entropiaBits >= 1.5 &&
		metricas.color.entropiaBits <= 3 &&
		tono < 0.4 &&
		bordes > 0.25
	)
		scores.ilustracion += 0.22;
	else if (
		cantidad >= 6 &&
		cantidad <= 60 &&
		plano >= 0.6 &&
		plano <= 0.97 &&
		metricas.color.entropiaBits >= 1.5 &&
		tono < 0.55
	)
		scores.ilustracion += 0.18;
	if (tono > 0.65 && metricas.color.entropiaBits > 2.4 && plano < 0.9)
		scores.fotografia += 0.12;

	const orden = (Object.entries(scores) as [ClaseImagen, number][]).sort(
		(a, b) => b[1] - a[1],
	);
	const margen = orden[0][1] - orden[1][1];
	return {
		clase: orden[0][0],
		confianza: redondear(clamp(0.45 + margen * 2.8)),
		ambigua: margen < 0.09,
		scores: Object.fromEntries(
			Object.entries(scores).map(([k, v]) => [k, redondear(v)]),
		) as Record<ClaseImagen, number>,
		margen: redondear(margen),
	};
}

function grisDesdeAlpha(datos: Uint8ClampedArray, n: number) {
	const gris = new Uint8Array(n);
	for (let p = 0; p < n; p++) gris[p] = 255 - datos[p * 4 + 3];
	return gris;
}

function grisDesdeMascara(
	datos: Uint8ClampedArray,
	ancho: number,
	alto: number,
) {
	const copia = new Uint8ClampedArray(datos);
	const estado = mascaraDeDiseno(copia, ancho, alto);
	const gris = new Uint8Array(ancho * alto);
	for (let p = 0; p < gris.length; p++) gris[p] = copia[p * 4];
	return { gris, vacia: estado.vacia };
}

function grisDesdeLuminancia(datos: Uint8ClampedArray, n: number) {
	const gris = new Uint8Array(n);
	for (let p = 0; p < n; p++) {
		const i = p * 4;
		const alpha = datos[i + 3] / 255;
		gris[p] = Math.round(
			luma(
				datos[i] * alpha + 255 * (1 - alpha),
				datos[i + 1] * alpha + 255 * (1 - alpha),
				datos[i + 2] * alpha + 255 * (1 - alpha),
			),
		);
	}
	return gris;
}

export function preparar(
	imagen: HTMLImageElement,
	clase: ClaseImagen,
	metricas: MetricasInput,
): Preparado {
	const largo = Math.max(imagen.naturalWidth, imagen.naturalHeight);
	const objetivo =
		clase === "fotografia" ? 720 : clase === "ilustracion" ? 1000 : 1400;
	let escala = objetivo / largo;
	if (clase !== "logo-line-art") escala = Math.min(1, escala);
	escala = Math.min(
		3,
		escala,
		Math.sqrt(PIXELES_MAXIMOS / (imagen.naturalWidth * imagen.naturalHeight)),
	);
	const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
	const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));
	const datos = lienzoDeImagen(imagen, ancho, alto).data;
	const n = ancho * alto;

	if (clase === "fotografia") {
		const luminanciaOriginal = grisDesdeLuminancia(datos, n);
		const hist = new Uint32Array(256);
		for (const valor of luminanciaOriginal) hist[valor]++;
		const umbral = otsu(hist, n);
		const referencia = Uint8Array.from(luminanciaOriginal, (valor) =>
			clamp(valor - umbral + 128, 0, 255),
		);
		return {
			datos,
			ancho,
			alto,
			escala,
			referencia,
			luminanciaOriginal,
			umbralLuminancia: umbral,
		};
	}

	const referencia = metricas.alpha.fuerte
		? grisDesdeAlpha(datos, n)
		: grisDesdeMascara(datos, ancho, alto).gris;
	return { datos, ancho, alto, escala, referencia };
}

function rgbaDesdeGris(gris: Uint8Array) {
	const rgba = new Uint8Array(gris.length * 4);
	for (let p = 0; p < gris.length; p++) {
		const i = p * 4;
		rgba[i] = gris[p];
		rgba[i + 1] = gris[p];
		rgba[i + 2] = gris[p];
		rgba[i + 3] = 255;
	}
	return rgba;
}

const preset = (
	filterSpeckle: number,
	lengthThreshold: number,
	extra: Record<string, unknown> = {},
) => ({
	mode: "polygon",
	binary: true,
	hierarchical: "cutout",
	filterSpeckle,
	colorPrecision: 6,
	layerDifference: 16,
	cornerThreshold: 45,
	lengthThreshold,
	maxIterations: 10,
	spliceThreshold: 45,
	pathPrecision: 3,
	...extra,
});

function pixelesRegiones(datos: Uint8ClampedArray, mascara: Uint8Array) {
	const salida = new Uint8Array(datos.length);
	for (let p = 0; p < mascara.length; p++) {
		const i = p * 4;
		if (mascara[p] >= 170) {
			salida[i] = 255;
			salida[i + 1] = 0;
			salida[i + 2] = 255;
			salida[i + 3] = 255;
		} else {
			salida[i] = datos[i];
			salida[i + 1] = datos[i + 1];
			salida[i + 2] = datos[i + 2];
			salida[i + 3] = 255;
		}
	}
	return salida;
}

function recolorearRegiones(svg: string) {
	const paths = svg.match(/<path\b[^>]*\/?\s*>/gi) ?? [];
	const conservados = paths
		.filter((tag) => {
			const fill = tag.match(/fill=["']#([0-9a-f]{6})["']/i)?.[1];
			if (!fill) return true;
			const r = Number.parseInt(fill.slice(0, 2), 16);
			const g = Number.parseInt(fill.slice(2, 4), 16);
			const b = Number.parseInt(fill.slice(4, 6), 16);
			return Math.hypot(255 - r, g, 255 - b) > 35;
		})
		.map((tag) => tag.replace(/fill=["'][^"']+["']/i, 'fill="#000000"'));
	return svg
		.replace(/<path\b[^>]*\/?\s*>/gi, "")
		.replace(/<\/svg>/i, `${conservados.join("\n")}\n</svg>`);
}

export function generarCandidatos(
	preparado: Preparado,
	clase: ClaseImagen,
): Candidato[] {
	if (
		clase === "fotografia" &&
		preparado.luminanciaOriginal &&
		preparado.umbralLuminancia !== undefined
	) {
		return [
			["luminancia-adaptativa", preparado.umbralLuminancia, 8, 3],
			[
				"luminancia-sombras",
				Math.max(40, preparado.umbralLuminancia - 18),
				12,
				4,
			],
			[
				"luminancia-luces",
				Math.min(215, preparado.umbralLuminancia + 18),
				12,
				4,
			],
		].map(([nombre, umbral, speckle, largo]) => {
			const ajustado = Uint8Array.from(
				preparado.luminanciaOriginal as Uint8Array,
				(valor) => clamp(valor - Number(umbral) + 128, 0, 255),
			);
			return {
				nombre: String(nombre),
				pixeles: rgbaDesdeGris(ajustado),
				config: preset(Number(speckle), Number(largo)),
			};
		});
	}

	return [
		{
			nombre: "mascara-detalle",
			pixeles: rgbaDesdeGris(preparado.referencia),
			config: preset(2, 1),
		},
		{
			nombre: "mascara-balanceada",
			pixeles: rgbaDesdeGris(preparado.referencia),
			config: preset(5, 3),
		},
		{
			nombre: "regiones-color",
			pixeles: pixelesRegiones(preparado.datos, preparado.referencia),
			config: preset(clase === "ilustracion" ? 5 : 2, 2, {
				binary: false,
				hierarchical: "cutout",
				colorPrecision: 6,
				layerDifference: 12,
			}),
			transformar: recolorearRegiones,
		},
	];
}

const contarNodos = (svg: string) =>
	(svg.match(/[MmLlCcSsQqTtAaHhVv]/g) ?? []).length;
const contarPaths = (svg: string) => (svg.match(/<path\b/g) ?? []).length;

export function validarSvg(
	svg: string,
	ancho: number,
	alto: number,
): Validacion {
	const nodos = contarNodos(svg);
	const paths = contarPaths(svg);
	const dimensionesCorrectas = new RegExp(
		`width=["']${ancho}["'][^>]*height=["']${alto}["']`,
		"i",
	).test(svg);
	const errores: string[] = [];
	if (/<image\b/i.test(svg)) errores.push("image");
	if (/<text\b/i.test(svg)) errores.push("text");
	if (/\b(?:href|xlink:href)\s*=|url\s*\(/i.test(svg))
		errores.push("referencia-externa");
	if (!paths || !nodos) errores.push("sin-geometria");
	if (nodos > NODOS_MAXIMOS_ADAPTATIVO) errores.push("complejidad");
	if (!dimensionesCorrectas) errores.push("dimensiones");
	return {
		valida: errores.length === 0,
		errores,
		nodos,
		paths,
		dimensionesCorrectas,
	};
}

function mapaBordes(mask: Uint8Array, ancho: number, alto: number) {
	const salida = new Uint8Array(mask.length);
	for (let y = 1; y < alto - 1; y++) {
		for (let x = 1; x < ancho - 1; x++) {
			const p = y * ancho + x;
			const valor = mask[p];
			if (
				mask[p - 1] !== valor ||
				mask[p + 1] !== valor ||
				mask[p - ancho] !== valor ||
				mask[p + ancho] !== valor
			)
				salida[p] = 1;
		}
	}
	return salida;
}

function dilatar(mask: Uint8Array, ancho: number, alto: number) {
	const salida = new Uint8Array(mask.length);
	for (let y = 0; y < alto; y++) {
		for (let x = 0; x < ancho; x++) {
			let valor = 0;
			for (let dy = -1; dy <= 1 && !valor; dy++) {
				for (let dx = -1; dx <= 1 && !valor; dx++) {
					const xx = x + dx;
					const yy = y + dy;
					if (xx >= 0 && yy >= 0 && xx < ancho && yy < alto)
						valor ||= mask[yy * ancho + xx];
				}
			}
			salida[y * ancho + x] = valor;
		}
	}
	return salida;
}

function contarHuecos(mask: Uint8Array, ancho: number, alto: number) {
	const vistos = new Uint8Array(mask.length);
	const cola = new Int32Array(mask.length);
	let huecos = 0;
	for (let inicio = 0; inicio < mask.length; inicio++) {
		if (vistos[inicio] || mask[inicio]) continue;
		let cabeza = 0;
		let fin = 0;
		let area = 0;
		let tocaBorde = false;
		cola[fin++] = inicio;
		vistos[inicio] = 1;
		while (cabeza < fin) {
			const p = cola[cabeza++];
			const x = p % ancho;
			const y = (p / ancho) | 0;
			area++;
			if (!x || !y || x === ancho - 1 || y === alto - 1) tocaBorde = true;
			const vecinos = [
				x ? p - 1 : -1,
				x + 1 < ancho ? p + 1 : -1,
				y ? p - ancho : -1,
				y + 1 < alto ? p + ancho : -1,
			];
			for (const q of vecinos) {
				if (q >= 0 && !vistos[q] && !mask[q]) {
					vistos[q] = 1;
					cola[fin++] = q;
				}
			}
		}
		if (!tocaBorde && area >= 4) huecos++;
	}
	return huecos;
}

function recallComponentes(
	referencia: Uint8Array,
	salida: Uint8Array,
	ancho: number,
	alto: number,
) {
	const vistos = new Uint8Array(referencia.length);
	const cola = new Int32Array(referencia.length);
	let total = 0;
	let presentes = 0;
	for (let inicio = 0; inicio < referencia.length; inicio++) {
		if (vistos[inicio] || !referencia[inicio]) continue;
		let cabeza = 0;
		let fin = 0;
		let area = 0;
		let solape = 0;
		cola[fin++] = inicio;
		vistos[inicio] = 1;
		while (cabeza < fin) {
			const p = cola[cabeza++];
			const x = p % ancho;
			const y = (p / ancho) | 0;
			area++;
			solape += salida[p];
			const vecinos = [
				x ? p - 1 : -1,
				x + 1 < ancho ? p + 1 : -1,
				y ? p - ancho : -1,
				y + 1 < alto ? p + ancho : -1,
			];
			for (const q of vecinos) {
				if (q >= 0 && !vistos[q] && referencia[q]) {
					vistos[q] = 1;
					cola[fin++] = q;
				}
			}
		}
		if (area >= 4) {
			total++;
			if (solape / area >= 0.1) presentes++;
		}
	}
	return {
		total,
		perdidos: total - presentes,
		recall: total ? presentes / total : 1,
	};
}

async function rasterizarSvg(svg: string, ancho: number, alto: number) {
	const blob = new Blob([svg], { type: "image/svg+xml" });
	const url = URL.createObjectURL(blob);
	try {
		const imagen = new Image();
		await new Promise<void>((listo, falla) => {
			imagen.onload = () => listo();
			imagen.onerror = () => falla(new Error("No pudimos revisar el trazado."));
			imagen.src = url;
		});
		const lienzo = document.createElement("canvas");
		lienzo.width = ancho;
		lienzo.height = alto;
		const ctx = lienzo.getContext("2d", { willReadFrequently: true });
		if (!ctx) throw new Error("No pudimos revisar el trazado.");
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, ancho, alto);
		ctx.drawImage(imagen, 0, 0, ancho, alto);
		return ctx.getImageData(0, 0, ancho, alto).data;
	} finally {
		URL.revokeObjectURL(url);
	}
}

export async function evaluarSvg(
	svg: string,
	referenciaGris: Uint8Array,
	ancho: number,
	alto: number,
	validacion: Validacion,
): Promise<Evaluacion> {
	const pixeles = await rasterizarSvg(svg, ancho, alto);
	const referencia = Uint8Array.from(referenciaGris, (v) => (v < 128 ? 1 : 0));
	const salida = new Uint8Array(ancho * alto);
	let refFg = 0;
	let outFg = 0;
	let perdido = 0;
	let anadido = 0;
	for (let p = 0; p < salida.length; p++) {
		const i = p * 4;
		salida[p] = luma(pixeles[i], pixeles[i + 1], pixeles[i + 2]) < 128 ? 1 : 0;
		refFg += referencia[p];
		outFg += salida[p];
		if (referencia[p] && !salida[p]) perdido++;
		if (!referencia[p] && salida[p]) anadido++;
	}

	const refE = mapaBordes(referencia, ancho, alto);
	const outE = mapaBordes(salida, ancho, alto);
	const refD = dilatar(refE, ancho, alto);
	const outD = dilatar(outE, ancho, alto);
	let refEc = 0;
	let outEc = 0;
	let refMatch = 0;
	let outMatch = 0;
	for (let p = 0; p < salida.length; p++) {
		refEc += refE[p];
		outEc += outE[p];
		if (refE[p] && outD[p]) refMatch++;
		if (outE[p] && refD[p]) outMatch++;
	}
	const precision = outEc ? outMatch / outEc : 0;
	const recall = refEc ? refMatch / refEc : 0;
	const edgeF1 =
		precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
	const huecosRef = contarHuecos(referencia, ancho, alto);
	const huecosOut = contarHuecos(salida, ancho, alto);
	const errorHuecos = clamp(
		Math.abs(huecosRef - huecosOut) / Math.max(1, huecosRef || 5),
	);
	const comp = recallComponentes(referencia, salida, ancho, alto);
	const lost = perdido / Math.max(1, refFg);
	const added = anadido / Math.max(1, outFg);
	const visual = clamp(
		1 -
			(0.27 * lost +
				0.17 * added +
				0.24 * (1 - edgeF1) +
				0.16 * errorHuecos +
				0.16 * (1 - comp.recall)),
	);
	const complejidad = clamp(
		0.06 * (validacion.nodos / NODOS_MAXIMOS_ADAPTATIVO) ** 1.4 +
			0.02 * (validacion.paths / 500) ** 1.2,
		0,
		0.12,
	);
	const score = validacion.valida ? 100 * clamp(visual - complejidad) : 0;
	return {
		score: redondear(score, 2),
		fidelidadVisual: redondear(visual),
		penalizacionComplejidad: redondear(complejidad),
		foregroundPerdido: redondear(lost),
		foregroundAnadido: redondear(added),
		similitudBordesF1: redondear(edgeF1),
		huecosReferencia: huecosRef,
		huecosSalida: huecosOut,
		errorHuecos: redondear(errorHuecos),
		componentesReferencia: comp.total,
		componentesPerdidos: comp.perdidos,
		recallComponentes: redondear(comp.recall),
	};
}

export function confianzaFinal(
	score: number,
	segundoScore: number,
	confianzaClase: number,
) {
	const margen = score - segundoScore;
	return redondear(
		clamp(
			0.5 * (score / 100) + 0.3 * clamp(margen / 12) + 0.2 * confianzaClase,
		),
	);
}
