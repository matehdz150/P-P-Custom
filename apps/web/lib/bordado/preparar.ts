import {
	EMBROIDERY_PROFILE_HYBRID_V4,
	EMBROIDERY_PROFILE_V2,
	EMBROIDERY_PROFILE_V3,
	EMBROIDERY_SCHEMA_VERSION,
	type EmbroideryDesign,
	type EmbroideryIssue,
	type EmbroideryObject,
	type EmbroideryPreparation,
	type EmbroideryProfile,
	esPresupuestoExcedido,
	INKSTITCH_ENGINE_VERSION,
	incidenciaDeComplejidad,
} from "@kustto/bordado";
import { colorIdDe, normalizarHex } from "./color";
import { crearCronometro } from "./cronometro";
import { objetosDeMascara } from "./formas";
import type { SolicitudDePreparacion } from "./protocolo";
import { prepararPixeles } from "./raster";
import { aRejilla, lienzoEnMm } from "./rejilla";

/**
 * De lo capturado en el editor a un `EmbroideryDesign`.
 *
 * NO TOCA EL DOM DEL DOCUMENTO NI FABRIC: sólo `OffscreenCanvas`, que existe
 * igual dentro de un worker. Esa es toda la razón de que este archivo esté
 * separado de la captura — es la mitad cara del trabajo y es la que tiene que
 * salir del hilo principal.
 *
 * TAMPOCO DECIDE NADA NUEVO. Las reglas son las mismas que ya estaban probadas;
 * lo único que cambia es de qué hilo se llaman.
 */

export class BordadoRechazado extends Error {
	readonly incidencias: EmbroideryIssue[];
	constructor(incidencias: EmbroideryIssue[]) {
		super(incidencias[0]?.message ?? "Este diseño no se puede bordar");
		this.name = "BordadoRechazado";
		this.incidencias = incidencias;
	}
}

function dedupe(lista: EmbroideryIssue[]) {
	return lista.filter(
		(issue, i, todos) => todos.findIndex((y) => y.code === issue.code) === i,
	);
}

export type ResultadoDePreparacion = {
	design: EmbroideryDesign;
	tiempos: Record<string, number>;
};

function prepararConProfile(
	solicitud: SolicitudDePreparacion,
	profile: EmbroideryProfile,
): ResultadoDePreparacion {
	const reloj = crearCronometro();

	const colores = new Map<string, string>();
	const objetos: EmbroideryObject[] = [];
	const incidencias: EmbroideryIssue[] = [];
	const rechazos: EmbroideryIssue[] = [];
	const conteoTexto = { satin: 0, running: 0, fill: 0 };
	let analisisRaster: EmbroideryPreparation["raster"];
	let metricasRaster:
		| {
				gradientRatio: number;
				texture: number;
				colorEntropy: number;
				alphaCoverage: number;
		  }
		| undefined;

	for (let i = 0; i < solicitud.fuentes.length; i++) {
		const fuente = solicitud.fuentes[i];
		const prefijo = `o${i}`;

		if (fuente.tipo === "raster") {
			const preparado = prepararPixeles({
				datos: fuente.datos,
				ancho: fuente.ancho,
				alto: fuente.alto,
				mmPorPx: fuente.mmPorPx,
				desplazamientoMm: fuente.desplazamientoMm,
				profile,
				sourceObjectId: fuente.sourceObjectId,
				prefijo,
				cronometro: reloj,
			});
			if (preparado.rechazo) {
				rechazos.push(preparado.rechazo);
				continue;
			}
			if (preparado.presupuestoAgotado) {
				/* El presupuesto no rechaza el diseño: lo manda a revisión. Se corta
				   aquí porque seguir con las demás fuentes sería gastar el mismo
				   cómputo que acabamos de decidir no gastar. */
				throw new BordadoRechazado([incidenciaDeComplejidad()]);
			}
			for (const [id, hex] of preparado.colores) colores.set(id, hex);
			objetos.push(...preparado.objetos);
			incidencias.push(...preparado.incidencias);
			analisisRaster = preparado.analisis;
			metricasRaster = preparado.metricas;
			continue;
		}

		try {
			if (fuente.tipo === "texto") {
				const lienzo = lienzoEnMm(solicitud.widthMm, solicitud.heightMm);
				lienzo.ctx.fillStyle = "#000000";
				// `nonzero`: las contraformas de una fuente vienen con el sentido de
				// giro invertido, que es justo lo que esa regla sabe restar.
				lienzo.ctx.fill(new Path2D(fuente.d), "nonzero");

				const hex = normalizarHex(fuente.colorHex);
				colores.set(colorIdDe(hex), hex);

				const preparado = objetosDeMascara({
					rejilla: aRejilla(lienzo),
					profile,
					colorId: colorIdDe(hex),
					sourceObjectId: fuente.sourceObjectId,
					sourceType: "text",
					classification: "text",
					prefijo,
					desplazamientoMm: lienzo.desplazamientoMm,
					esTexto: true,
					cronometro: reloj,
				});

				objetos.push(...preparado.objetos);
				for (const incidencia of preparado.incidencias) {
					(incidencia.severity === "reject" ? rechazos : incidencias).push(
						incidencia,
					);
				}
				conteoTexto.satin += preparado.conteo.satin;
				conteoTexto.running += preparado.conteo.running;
				conteoTexto.fill += preparado.conteo.fill;
				continue;
			}

			let indice = 0;
			for (const grupo of fuente.porColor) {
				const lienzo = lienzoEnMm(solicitud.widthMm, solicitud.heightMm);
				lienzo.ctx.fillStyle = "#000000";
				for (const camino of grupo.caminos)
					lienzo.ctx.fill(new Path2D(camino), "nonzero");

				const hex = normalizarHex(grupo.hex);
				colores.set(colorIdDe(hex), hex);

				objetos.push(
					...objetosDeMascara({
						rejilla: aRejilla(lienzo),
						profile,
						colorId: colorIdDe(hex),
						sourceObjectId: fuente.sourceObjectId,
						sourceType: "vector",
						classification: "logo",
						prefijo: `${prefijo}-v${indice++}`,
						desplazamientoMm: lienzo.desplazamientoMm,
						cronometro: reloj,
					}).objetos,
				);
			}
		} catch (error) {
			if (!esPresupuestoExcedido(error)) throw error;
			throw new BordadoRechazado([incidenciaDeComplejidad()]);
		}
	}

	/* Los rechazos se cuentan AQUÍ y no en el worker de AWS: son razones que el
	   análisis barato ya conoce —una foto, una letra de tres milímetros— y
	   arrancar un contenedor de Ink/Stitch para llegar a la misma conclusión sólo
	   añade un minuto de espera antes del mismo "no". */
	if (rechazos.length) throw new BordadoRechazado(dedupe(rechazos));

	if (!objetos.length)
		throw new Error("No encontramos trazos fabricables en este diseño");

	if (objetos.length > profile.limits.maxObjects)
		throw new BordadoRechazado([
			{
				code: "TOO_COMPLEX",
				message:
					"Este diseño tiene demasiadas piezas para bordarse automáticamente. Simplifícalo e inténtalo de nuevo.",
				severity: "reject",
			},
		]);

	if (colores.size > profile.limits.maxColors)
		throw new BordadoRechazado([
			{
				code: "DEMASIADOS_HILOS",
				message: `El bordado admite hasta ${profile.limits.maxColors} hilos y este diseño necesita ${colores.size}.`,
				severity: "reject",
			},
		]);

	const caja = objetos.reduce(
		(todo, objeto) => ({
			xMm: Math.min(todo.xMm, objeto.bounds.xMm),
			yMm: Math.min(todo.yMm, objeto.bounds.yMm),
			maxX: Math.max(todo.maxX, objeto.bounds.xMm + objeto.bounds.widthMm),
			maxY: Math.max(todo.maxY, objeto.bounds.yMm + objeto.bounds.heightMm),
		}),
		{ xMm: Infinity, yMm: Infinity, maxX: -Infinity, maxY: -Infinity },
	);

	const preparation: EmbroideryPreparation = {
		profileVersion: profile.version,
		raster: analisisRaster,
		texto:
			conteoTexto.satin + conteoTexto.running + conteoTexto.fill
				? {
						satinColumns: conteoTexto.satin,
						runningPaths: conteoTexto.running,
						fillAreas: conteoTexto.fill,
					}
				: undefined,
		issues: dedupe(incidencias),
	};

	const design: EmbroideryDesign = {
		schemaVersion: EMBROIDERY_SCHEMA_VERSION,
		sourceSnapshotHash: solicitud.sourceSnapshotHash,
		productId: solicitud.productId,
		sideId: solicitud.sideId,
		physical: { widthMm: solicitud.widthMm, heightMm: solicitud.heightMm },
		bounds: {
			xMm: Math.max(0, caja.xMm),
			yMm: Math.max(0, caja.yMm),
			widthMm: Math.min(solicitud.widthMm, caja.maxX - Math.max(0, caja.xMm)),
			heightMm: Math.min(solicitud.heightMm, caja.maxY - Math.max(0, caja.yMm)),
		},
		colors: [...colores.entries()].map(([id, valor], orden) => ({
			id,
			sourceHex: valor,
			displayHex: valor,
			order: orden,
		})),
		objects: objetos,
		metrics: {
			componentCount: objetos.length,
			nodeCount: objetos.reduce((suma, objeto) => suma + objeto.nodeCount, 0),
			colorCount: colores.size,
			widthMm: solicitud.widthMm,
			heightMm: solicitud.heightMm,
			...(metricasRaster ?? {}),
		},
		preparation,
		profileVersion: profile.version,
		engineVersion: INKSTITCH_ENGINE_VERSION,
	};

	return { design, tiempos: reloj.etapas };
}

/**
 * Perfil activo de la beta: hibrido v4.
 *
 * Columnas simples con el stroke de v2, complejas con rails, y las que pasan
 * de seis milimetros con relleno. Sobre el banco de 20 fixtures mejora el
 * solape normalizado (146.8 -> 137.6 por mil puntadas), los cruces de satin
 * (-18.2 %), la puntada mas larga (8.0 -> 6.4 mm) y el p95 (7.8 -> 5.3 mm),
 * con el tiempo de motor practicamente igual en los fixtures que conservan su
 * representacion (-0.7 %).
 *
 * `EMBROIDERY_PROFILE_V2` NO se borra: sigue exportado y `profileByVersion` lo
 * resuelve, que es lo que permite volver atras cambiando esta unica linea y
 * lo que mantiene legibles los trabajos ya guardados con el.
 */
export function preparar(
	solicitud: SolicitudDePreparacion,
): ResultadoDePreparacion {
	return prepararConProfile(solicitud, EMBROIDERY_PROFILE_HYBRID_V4);
}

/**
 * El perfil anterior, accesible para volver atras.
 *
 * Se conserva porque el rollback de la beta consiste en que `preparar` llame a
 * esta en vez de al hibrido: una linea, sin tocar nada mas. Los trabajos ya
 * guardados con v2 siguen siendo legibles porque `profileByVersion` lo resuelve.
 */
export function prepararV2(
	solicitud: SolicitudDePreparacion,
): ResultadoDePreparacion {
	return prepararConProfile(solicitud, EMBROIDERY_PROFILE_V2);
}

/** Entrada explícita para regresión; ningún flujo productivo la llama aún. */
export function prepararExperimentalV3(
	solicitud: SolicitudDePreparacion,
): ResultadoDePreparacion {
	return prepararConProfile(solicitud, EMBROIDERY_PROFILE_V3);
}

/** Candidato híbrido aislado. Producción continúa entrando por `preparar`. */
export function prepararExperimentalHybridV4(
	solicitud: SolicitudDePreparacion,
): ResultadoDePreparacion {
	return prepararConProfile(solicitud, EMBROIDERY_PROFILE_HYBRID_V4);
}
