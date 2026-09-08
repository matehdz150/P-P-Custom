import type { Rama } from "./esqueleto";
import type { MedidasDeForma } from "./geometria";
import type { EmbroideryProfile } from "./profile";
import type { EmbroideryIssue } from "./types";

/**
 * Qué puntada le toca a una forma, mirándola en milímetros.
 *
 * POR QUÉ NO TODO ES FILL. Es lo que hacía el primer corte, y es lo que hace
 * que una letra bordada se vea como una mancha: un relleno tatami recorre la
 * región en líneas paralelas, y en un asta de 1.5 mm eso son tres líneas y un
 * borde deshilachado. Una letra se cose en SATIN —una columna de puntadas que
 * cruzan el trazo de lado a lado— y por eso brilla y tiene el canto limpio.
 *
 * LAS TRES PREGUNTAS, EN ESTE ORDEN:
 *
 *   1. ¿Es tan fina que no cabe una columna? -> running.
 *   2. ¿Es una columna: alargada, de grosor estable y dentro del rango de la
 *      máquina? -> satin.
 *   3. Si no -> fill.
 *
 * Y UNA CUARTA QUE NO ES DE ESTILO SINO DE SI SE PUEDE: por debajo del área
 * mínima la forma no se borda, se elimina y se cuenta. Inventarle puntadas a
 * una mota de medio milímetro produce un nido de hilo, no un detalle.
 *
 * NO SE FUERZA SATIN EN LAS LETRAS. Una "O" gorda de un logo no es una columna
 * —su grosor no es estable y es tan ancha como larga— y forzarla daría puntadas
 * de 12 mm que se enganchan. La geometría manda sobre la semántica.
 */

export type TipoDePuntada = "running" | "satin" | "fill";

export type DecisionDePuntada = {
	tipo: TipoDePuntada;
	/** Ancho de la columna, sólo en satin. Es lo que el worker pone en el stroke. */
	strokeWidthMm?: number;
	/** Por qué salió así. Viaja al metadata para poder auditar una decisión. */
	motivo: string;
	/** Lo que impide bordarlo limpio, si algo. */
	incidencias: EmbroideryIssue[];
	/** Falso cuando la forma no debe llegar al motor. */
	fabricable: boolean;
};

/**
 * Decide la puntada de una forma cualquiera —de un logo raster o de una letra—.
 *
 * `esTexto` no cambia el criterio geométrico, sólo AÑADE las comprobaciones de
 * legibilidad: una mancha de 4 mm de alto es un detalle legítimo de un logo y
 * una letra de 4 mm no se lee bordada.
 */
export function decidirPuntada(
	medidas: MedidasDeForma,
	profile: EmbroideryProfile,
	opciones: { esTexto?: boolean } = {},
): DecisionDePuntada {
	const g = profile.geometria;
	const incidencias: EmbroideryIssue[] = [];

	if (medidas.areaMm2 < g.minAreaMm2) {
		return {
			tipo: "running",
			motivo: `area ${medidas.areaMm2.toFixed(2)}mm2 < ${g.minAreaMm2}mm2`,
			fabricable: false,
			incidencias: [
				{
					code: "REGION_DEMASIADO_PEQUENA",
					message: "Hay detalles demasiado pequeños para bordarse.",
					severity: "review",
				},
			],
		};
	}

	if (opciones.esTexto)
		incidencias.push(...revisarLegibilidad(medidas, profile));

	const alargamiento =
		medidas.grosorMedianoMm > 0
			? medidas.largoEjeMm / medidas.grosorMedianoMm
			: 0;

	if (medidas.grosorMedianoMm < g.maxGrosorRunningMm) {
		/* Demasiado fino para una columna. Un running sigue el eje con una sola
		   línea de puntadas: es lo correcto para un contorno o un detalle, y es
		   además lo único que no deforma un trazo de menos de un milímetro. */
		return {
			tipo: "running",
			motivo: `grosor ${medidas.grosorMedianoMm.toFixed(2)}mm < ${g.maxGrosorRunningMm}mm`,
			fabricable: true,
			incidencias,
		};
	}

	if (
		medidas.grosorMedianoMm <= g.maxGrosorSatinMm &&
		medidas.grosorMedianoMm >= g.minGrosorSatinMm &&
		medidas.uniformidad >= g.minUniformidadSatin &&
		alargamiento >= g.minAlargamientoSatin
	) {
		return {
			tipo: "satin",
			strokeWidthMm: Number(medidas.grosorMedianoMm.toFixed(2)),
			motivo: `columna ${medidas.grosorMedianoMm.toFixed(2)}mm uniformidad ${medidas.uniformidad.toFixed(2)} alargamiento ${alargamiento.toFixed(1)}`,
			fabricable: true,
			incidencias,
		};
	}

	/* Una columna demasiado ANCHA no se rechaza: se rellena. Un satin de más de
	   ocho milímetros son puntadas larguísimas que se enganchan con cualquier
	   cosa; el mismo trazo en tatami se cose bien y se ve casi igual. Se anota
	   porque un digitalizador humano probablemente la partiría en dos columnas. */
	if (
		medidas.uniformidad >= g.minUniformidadSatin &&
		alargamiento >= g.minAlargamientoSatin &&
		medidas.grosorMedianoMm > g.maxGrosorSatinMm
	) {
		incidencias.push({
			code: "COLUMNA_DEMASIADO_ANCHA",
			message: `Un trazo de ${medidas.grosorMedianoMm.toFixed(1)} mm es demasiado ancho para una columna; se borda como relleno.`,
			severity: "review",
		});
	}

	return {
		tipo: "fill",
		motivo: `relleno area ${medidas.areaMm2.toFixed(1)}mm2 grosor ${medidas.grosorMedianoMm.toFixed(2)}mm uniformidad ${medidas.uniformidad.toFixed(2)}`,
		fabricable: true,
		incidencias,
	};
}

/** Los parámetros de máquina que le tocan a una decisión ya tomada. */
export function parametrosDe(
	decision: DecisionDePuntada,
	medidas: MedidasDeForma,
	profile: EmbroideryProfile,
	indice: number,
) {
	if (decision.tipo === "satin") {
		return {
			type: "satin" as const,
			strokeWidthMm: decision.strokeWidthMm,
			spacingMm: profile.stitches.satinSpacingMm,
			pullCompensationMm: profile.stitches.pullCompensationMm,
			underlay: true,
		};
	}

	if (decision.tipo === "running") {
		return {
			type: "running" as const,
			// Fino a propósito: el stroke de un running no es el ancho de nada, sólo
			// le dice al motor por dónde pasar.
			strokeWidthMm: 0.3,
			maxStitchLengthMm: profile.stitches.maxStitchLengthMm,
		};
	}

	return {
		type: "fill" as const,
		spacingMm: profile.stitches.fillSpacingMm,
		// Ángulos alternados entre objetos: dos rellenos contiguos en la misma
		// dirección se leen como una sola mancha.
		angleDeg: (indice % 4) * 45,
		maxStitchLengthMm: profile.stitches.maxStitchLengthMm,
		underlay: medidas.areaMm2 >= profile.geometria.minAreaUnderlayMm2,
		pullCompensationMm: profile.stitches.pullCompensationMm,
	};
}

/**
 * Si una letra con esta geometría se va a leer una vez bordada.
 *
 * Va aparte de `decidirPuntada` porque son preguntas distintas: la puntada se
 * decide por asta y la legibilidad por letra entera. Fundirlas hacía que una
 * "H" avisara tres veces de la misma altura insuficiente.
 */
export function revisarLegibilidad(
	medidas: MedidasDeForma,
	profile: EmbroideryProfile,
): EmbroideryIssue[] {
	const incidencias: EmbroideryIssue[] = [];

	if (medidas.altoMm < profile.texto.minAlturaMm) {
		incidencias.push({
			code: "TEXTO_DEMASIADO_PEQUENO",
			message: `El texto mide ${medidas.altoMm.toFixed(1)} mm de alto; por debajo de ${profile.texto.minAlturaMm} mm no se lee bordado.`,
			severity: "reject",
		});
	}
	if (medidas.grosorMedianoMm < profile.texto.minAstaMm) {
		incidencias.push({
			code: "ASTA_DEMASIADO_FINA",
			message: `Los trazos de esta tipografía miden ${medidas.grosorMedianoMm.toFixed(2)} mm; el mínimo para bordar es ${profile.texto.minAstaMm} mm.`,
			severity: "reject",
		});
	}
	/* Las contraformas son lo primero que se cierra al bordar: el hilo empuja y
	   el agujero de una "e" pequeña desaparece. Se avisa en vez de entregar una
	   palabra que llega hecha una mancha. */
	const cerradas = medidas.huecosMm2.filter(
		(area) => area > 0 && area < profile.texto.minContraformaMm2,
	);
	if (cerradas.length) {
		incidencias.push({
			code: "CONTRAFORMA_PEQUENA",
			message: `Hay ${cerradas.length} hueco(s) interior(es) que se cerrarían al bordar.`,
			severity: "review",
		});
	}

	return incidencias;
}

export type DecisionDeRama =
	| { tipo: "satin"; strokeWidthMm: number; motivo: string }
	| { tipo: "running"; motivo: string }
	| { tipo: "ninguna"; motivo: string };

/**
 * Qué se hace con un asta suelta del esqueleto de una forma.
 *
 * Devuelve `ninguna` sin disimulo cuando el asta no da columna: quien llama la
 * deja en la forma para coserla de relleno. Forzar aquí un satin de grosor
 * inventado es exactamente la puntada mala que no se quiere.
 */
export function decidirDeRama(
	rama: Rama,
	profile: EmbroideryProfile,
): DecisionDeRama {
	const g = profile.geometria;

	/* Un rabillo más corto que su propio grosor no es un asta, es el pico que el
	   adelgazamiento deja en un cruce o en un remate. Coserlo daría una columna
	   de dos puntadas cruzada encima de otra. */
	if (rama.largoMm <= rama.grosorMedianoMm) {
		return { tipo: "ninguna", motivo: "rabillo de cruce" };
	}

	if (rama.grosorMedianoMm < g.maxGrosorRunningMm) {
		return {
			tipo: "running",
			motivo: `grosor ${rama.grosorMedianoMm.toFixed(2)}mm`,
		};
	}

	const alargamiento = rama.largoMm / (rama.grosorMedianoMm || 1);
	if (
		rama.grosorMedianoMm <=
			(profile.version.startsWith("experimental-v3") || profile.hybrid
				? profile.quality.maxAutoSplitSatinWidthMm
				: g.maxGrosorSatinMm) &&
		rama.grosorMedianoMm >= g.minGrosorSatinMm &&
		rama.uniformidad >= g.minUniformidadSatin &&
		alargamiento >= g.minAlargamientoSatin
	) {
		return {
			tipo: "satin",
			strokeWidthMm: Number(rama.grosorMedianoMm.toFixed(2)),
			motivo: `columna ${rama.grosorMedianoMm.toFixed(2)}mm uniformidad ${rama.uniformidad.toFixed(2)} alargamiento ${alargamiento.toFixed(1)}`,
		};
	}

	return {
		tipo: "ninguna",
		motivo: `no es columna: grosor ${rama.grosorMedianoMm.toFixed(2)}mm uniformidad ${rama.uniformidad.toFixed(2)} alargamiento ${alargamiento.toFixed(1)}`,
	};
}
