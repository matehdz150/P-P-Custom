"use client";

import {
	type CosteDeEsqueleto,
	comoPath,
	comoPathCompuesto,
	componentes,
	construirSatinManual,
	construirSatinManualAdaptativo,
	contornos,
	decidirDeRama,
	decidirPuntada,
	decidirRepresentacionSatin,
	distanciaDe,
	type EmbroideryIssue,
	type EmbroideryObject,
	type EmbroideryProfile,
	medir,
	parametrosDe,
	type Rejilla,
	ramas,
	recortarRamaEnJunctions,
	revisarLegibilidad,
	sobranteDe,
} from "@kustto/bordado";
import svgpath from "svgpath";
import type { Cronometro } from "./cronometro";

/**
 * De una máscara a objetos bordables, con la puntada que le toca a cada trozo.
 *
 * ES LA MISMA RUTINA PARA TEXTO Y PARA RASTER a propósito. Una vez que las dos
 * entradas son una máscara en milímetros, la pregunta "¿esto es una columna?"
 * no depende de si vino de una fuente o de un PNG, y tener dos copias de la
 * respuesta garantizaba que con el tiempo dijeran cosas distintas.
 *
 * EL ORDEN IMPORTA:
 *
 *   1. Se parte la forma en astas y se cosen de satin o running las que de
 *      verdad son columnas.
 *   2. Lo que las columnas NO cubren —el nudo de una "H", el remate de una
 *      "G"— se cose de relleno. No se tira: dejaría agujeros en la letra.
 *   3. Lo que queda por debajo del área mínima se elimina y SE CUENTA, para
 *      poder decir cuánto detalle se perdió.
 *
 * Si ninguna asta da columna, la forma entera va de relleno con sus
 * contraformas recortadas. Es peor bordado que un satin, pero es honesto: no se
 * inventa una columna donde la geometría no la permite.
 */

export type ResultadoDeFormas = {
	objetos: EmbroideryObject[];
	incidencias: EmbroideryIssue[];
	conteo: { satin: number; running: number; fill: number };
	/** Regiones descartadas por caer bajo el área mínima. */
	eliminadas: number;
	eliminadasMm2: number;
};

type Entrada = {
	rejilla: Rejilla;
	profile: EmbroideryProfile;
	colorId: string;
	sourceObjectId: string;
	sourceType: EmbroideryObject["sourceType"];
	classification: EmbroideryObject["classification"];
	/** Prefijo de los ids; tiene que ser único dentro del diseño. */
	prefijo: string;
	/** Cuánto restar a las coordenadas para volver al origen del área. */
	desplazamientoMm: number;
	/** Activa las comprobaciones de legibilidad de letra. */
	esTexto?: boolean;
	cronometro?: Cronometro;
	/** Si viene, se acumulan los contadores de coste del esqueleto. */
	coste?: CosteDeEsqueleto;
};

function contarNodos(d: string) {
	return Math.max(1, (d.match(/[MmLlHhVvCcSsQqTtAa]/g) ?? []).length);
}

function cajaDe(puntos: Array<[number, number]>) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const [x, y] of puntos) {
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	return {
		xMm: minX,
		yMm: minY,
		widthMm: Math.max(0.05, maxX - minX),
		heightMm: Math.max(0.05, maxY - minY),
	};
}

export function objetosDeMascara(entrada: Entrada): ResultadoDeFormas {
	const { rejilla, profile, desplazamientoMm } = entrada;
	const objetos: EmbroideryObject[] = [];
	const incidencias: EmbroideryIssue[] = [];
	const conteo = { satin: 0, running: 0, fill: 0 };
	let eliminadas = 0;
	let eliminadasMm2 = 0;

	const reloj = entrada.cronometro;
	const medirCon = <T>(etapa: string, fn: () => T): T =>
		reloj ? reloj.medir(etapa, fn) : fn();

	const partes = medirCon("segmentation", () =>
		medirCon("analisisComponentes", () => componentes(rejilla)),
	);
	const mover = (d: string) =>
		svgpath(d)
			.translate(-desplazamientoMm, -desplazamientoMm)
			.round(3)
			.toString();

	const emitir = (
		d: string,
		puntos: Array<[number, number]>,
		stitch: EmbroideryObject["stitch"],
		quality?: EmbroideryObject["quality"],
	) => {
		const movido = mover(d);
		if (!movido) return;
		const caja = cajaDe(puntos);
		objetos.push({
			id: `${entrada.prefijo}-${objetos.length}`,
			sourceObjectId: entrada.sourceObjectId,
			sourceType: entrada.sourceType,
			classification: entrada.classification,
			colorId: entrada.colorId,
			geometry: {
				kind: "path",
				d: movido,
				fillRule: stitch.type === "fill" ? "evenodd" : undefined,
			},
			stitch,
			quality,
			bounds: {
				xMm: Math.max(0, caja.xMm - desplazamientoMm),
				yMm: Math.max(0, caja.yMm - desplazamientoMm),
				widthMm: caja.widthMm,
				heightMm: caja.heightMm,
			},
			nodeCount: contarNodos(movido),
		});
		conteo[stitch.type]++;
	};

	for (const parte of partes) {
		const distancia = medirCon("distancia", () => distanciaDe(rejilla, parte));
		const medidas = medirCon("medicion", () =>
			medir(rejilla, parte, distancia),
		);

		if (medidas.areaMm2 < profile.geometria.minAreaMm2) {
			eliminadas++;
			eliminadasMm2 += medidas.areaMm2;
			continue;
		}

		if (entrada.esTexto) {
			incidencias.push(...revisarLegibilidad(medidas, profile));
		}

		const todas = medirCon("skeleton", () =>
			medirCon("esqueleto", () =>
				ramas(
					rejilla,
					parte,
					distancia,
					profile.geometria.toleranciaMm,
					entrada.coste,
					profile.presupuesto,
				),
			),
		);
		const columnas: Array<{
			rama: (typeof todas)[number];
			cobertura: (typeof todas)[number];
			decision: ReturnType<typeof decidirDeRama>;
			representacion?: ReturnType<typeof decidirRepresentacionSatin>;
		}> = [];

		for (const rama of todas) {
			const decision = medirCon("stitchTypeAssignment", () =>
				decidirDeRama(rama, profile),
			);
			if (decision.tipo !== "ninguna") {
				const representacion =
					decision.tipo === "satin" && profile.hybrid
						? decidirRepresentacionSatin(rama, profile)
						: undefined;
				columnas.push({
					rama,
					cobertura:
						decision.tipo === "satin" &&
						(profile.version.startsWith("experimental-v3") ||
							representacion?.representationDecision === "rails-v3")
							? medirCon("junctionHandling", () =>
									recortarRamaEnJunctions(rama, profile),
								)
							: rama,
					decision,
					representacion,
				});
			}
		}

		if (!columnas.length) {
			/* Ni una sola asta válida: la forma es un blob. Se cose de relleno
			   entera, con las contraformas recortadas para que una "O" no salga
			   como un disco. */
			const decision = decidirPuntada(medidas, profile, {
				esTexto: entrada.esTexto,
			});
			incidencias.push(
				...decision.incidencias.filter(
					(i) => !incidencias.some((y) => y.code === i.code),
				),
			);
			if (!decision.fabricable) {
				eliminadas++;
				eliminadasMm2 += medidas.areaMm2;
				continue;
			}
			const trazos = medirCon("vectorGeometry", () =>
				medirCon("contornos", () =>
					contornos(
						rejilla,
						parte,
						profile.geometria.toleranciaMm,
						profile.texto.minContraformaMm2,
					),
				),
			);
			emitir(
				comoPathCompuesto(trazos),
				trazos.exterior,
				parametrosDe(decision, medidas, profile, objetos.length),
			);
			continue;
		}

		for (const { rama, cobertura, decision, representacion } of columnas) {
			/* El trazado que se emite es la LÍNEA CENTRAL, no el contorno. El worker
			   convierte un satin en `stroke` + `stroke-width`, así que mandarle el
			   perímetro daría una columna del doble de ancho y hueca por dentro. */
			const d = comoPath(rama.puntos, rama.cerrada);
			if (decision.tipo === "satin") {
				if (
					profile.version.startsWith("experimental-v3") ||
					representacion?.representationDecision === "rails-v3"
				) {
					const segmentos = medirCon("rails", () =>
						profile.hybrid
							? construirSatinManualAdaptativo(cobertura, profile)
							: construirSatinManual(cobertura, profile),
					);
					for (const segmento of segmentos)
						emitir(
							segmento.d,
							segmento.puntos,
							{
								type: "satin",
								satinMode: "rails",
								spacingMm: profile.stitches.satinSpacingMm,
								pullCompensationMm: profile.stitches.pullCompensationMm,
								underlay:
									!profile.hybrid || segmento.quality.segmentIndex === 0,
							},
							segmento.quality,
						);
				} else {
					emitir(
						d,
						rama.puntos,
						{
							type: "satin",
							satinMode: profile.hybrid ? "stroke" : undefined,
							strokeWidthMm: decision.strokeWidthMm,
							spacingMm: profile.stitches.satinSpacingMm,
							pullCompensationMm: profile.stitches.pullCompensationMm,
							underlay: true,
						},
						representacion
							? {
									...representacion.metrics,
									representationDecision: "stroke-v2",
									representationReasons: [],
									rawCenterlineNodes: rama.puntos.length,
									rawRailNodes: 0,
									finalRailNodes: 0,
									rungsBefore: 0,
									rungsAfter: 0,
									underlayLayers: 1,
									estimatedUnderlayStitches: Math.ceil(rama.largoMm / 2.2),
								}
							: undefined,
					);
				}
			} else {
				emitir(d, rama.puntos, {
					type: "running",
					// Fino a propósito: en un running el stroke no es el ancho de nada,
					// sólo le dice al motor por dónde pasar.
					strokeWidthMm: 0.3,
					maxStitchLengthMm: profile.stitches.maxStitchLengthMm,
				});
			}
		}

		const sobrantes = medirCon("sobrante", () =>
			sobranteDe(
				rejilla,
				parte,
				distancia,
				columnas.map((c) => c.cobertura),
			),
		);
		for (const resto of sobrantes) {
			const suyas = medirCon("medicion", () =>
				medir(rejilla, resto, distanciaDe(rejilla, resto)),
			);
			if (suyas.areaMm2 < profile.geometria.minAreaMm2) {
				eliminadas++;
				eliminadasMm2 += suyas.areaMm2;
				continue;
			}
			const trazos = medirCon("vectorGeometry", () =>
				medirCon("contornos", () =>
					contornos(
						rejilla,
						resto,
						profile.geometria.toleranciaMm,
						profile.texto.minContraformaMm2,
					),
				),
			);
			emitir(
				comoPathCompuesto(trazos),
				trazos.exterior,
				parametrosDe(
					{
						tipo: "fill",
						motivo: "sobrante de las columnas",
						fabricable: true,
						incidencias: [],
					},
					suyas,
					profile,
					objetos.length,
				),
			);
		}
	}

	return {
		objetos,
		incidencias: incidencias.filter(
			(issue, i, todos) => todos.findIndex((y) => y.code === issue.code) === i,
		),
		conteo,
		eliminadas,
		eliminadasMm2: Number(eliminadasMm2.toFixed(3)),
	};
}
