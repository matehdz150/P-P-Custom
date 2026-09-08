/**
 * Los números con los que se decide qué se puede bordar y cómo.
 *
 * ESTÁN AQUÍ Y NO REPARTIDOS POR EL CÓDIGO a propósito. Cada uno es una
 * hipótesis sobre una máquina, una tela y un hilo que todavía NO se han
 * probado: el día que se haga la matriz de test-sew, lo que cambia es este
 * archivo y nada más. Un umbral escondido dentro de una función es un umbral
 * que nadie vuelve a revisar.
 *
 * `physicallyValidated: false` no es un adorno: mientras siga en falso, ningún
 * diseño debe pasar a fabricación automática por muy alto que salga su
 * confidence.
 *
 * DE DÓNDE SALEN ESTOS NÚMEROS, para que nadie los tome por medidas:
 *
 *   - Los de puntada y legibilidad (`stitches`, `texto`, `geometria`) son las
 *     hipótesis del spike. No se han cosido nunca.
 *   - Los de `raster` se calibraron contra el banco de `pruebas/bordado`, que
 *     son imágenes de prueba, varias de ellas generadas. Separan bien ESE
 *     banco; que separen el catálogo real de un cliente está por ver.
 *   - `maxSuavidadInterior` en particular se fijó en el punto medio de un hueco
 *     de 0.089 sobre diez casos. Es el umbral con menos margen de todos y el
 *     primero que hay que remedir cuando aparezca una imagen mal clasificada.
 *
 * Ninguno está validado ni física ni productivamente.
 */

export type EmbroideryProfile = {
	version: string;
	experimental: true;
	physicallyValidated: false;
	limits: {
		maxWidthMm: number;
		maxHeightMm: number;
		maxInputBytes: number;
		maxPixels: number;
		maxObjects: number;
		maxComponents: number;
		maxNodes: number;
		maxColors: number;
		maxGradientRatio: number;
		maxTexture: number;
		maxEntropy: number;
	};
	stitches: {
		fillSpacingMm: number;
		satinSpacingMm: number;
		maxStitchLengthMm: number;
		pullCompensationMm: number;
	};
	/**
	 * Cuándo una forma es running, satin o fill.
	 *
	 * Todo en milímetros porque la misma forma cambia de respuesta según el
	 * tamaño al que se borde: una región de 40 px es un detalle legítimo a 10 cm
	 * y una mota irrecuperable a 2 cm.
	 */
	geometria: {
		/** Por debajo de esto una región no se borda: se elimina y se cuenta. */
		minAreaMm2: number;
		/** Con qué tolerancia se simplifican los contornos. */
		toleranciaMm: number;
		/** Un trazo más fino que esto no da columna: se cose como running. */
		maxGrosorRunningMm: number;
		/** Rango en el que una columna satin es fabricable. */
		minGrosorSatinMm: number;
		maxGrosorSatinMm: number;
		/** Cuán constante tiene que ser el grosor (p10/p90) para ser columna. */
		minUniformidadSatin: number;
		/** Cuántas veces más largo que ancho para considerarlo columna. */
		minAlargamientoSatin: number;
		/** Área a partir de la cual un relleno lleva underlay. */
		minAreaUnderlayMm2: number;
	};
	/**
	 * Lo que hace falta para que una letra salga legible.
	 *
	 * Del spike: altura >= 6 mm, asta >= 1.2 mm y contraforma >= 1.0 mm. La
	 * contraforma se guarda como ÁREA porque es lo que se puede medir sobre la
	 * forma real; 0.8 mm² es el área de un círculo de 1.0 mm de diámetro, que es
	 * la lectura literal de la regla del spike.
	 */
	texto: {
		minAlturaMm: number;
		minAstaMm: number;
		minContraformaMm2: number;
	};
	/** Qué se acepta de una imagen raster antes de gastar el motor. */
	raster: {
		/** Tope de tintas. Se usan menos si la imagen no las necesita. */
		maxColoresReducidos: number;
		/** ΔE medio con el que se deja de añadir tintas: por debajo, ya está. */
		deltaObjetivoDeltaE: number;
		/** Pérdida perceptual máxima admitida al cuantizar, en ΔE medio. */
		maxPerdidaCuantizacionDeltaE: number;
		/**
		 * Cuánto puede variar el INTERIOR de las formas antes de ser tono continuo.
		 *
		 * ES LA ÚNICA PREGUNTA QUE HAY QUE HACER ANTES DE CUANTIZAR, porque
		 * cuantizar la borra: en cuanto un degradado se reduce a seis tintas
		 * planas, es indistinguible de un logo por estructura y por color. Medido
		 * sobre el banco, después de cuantizar el retrato daba ΔE 2.4 —mejor que
		 * varios logos con antialias— y sus regiones salían tan limpias como las
		 * de un icono.
		 *
		 * Se mira sólo el interior —píxeles con sus cuatro vecinos dentro de la
		 * forma y casi del mismo color— porque ahí es donde un logo con antialias
		 * y una fotografía dejan de parecerse: los cientos de colores de un logo
		 * están TODOS en el contorno. Es la fracción del interior que varía poco a
		 * poco en vez de ser plana.
		 *
		 * Medido: gráficos entre 0.013 y 0.566, fotografías y degradados entre
		 * 0.655 y 0.995. El umbral va en medio del hueco. Es un margen estrecho
		 * —0.089 sobre diez casos— y la primera cosa que hay que volver a medir
		 * cuando aparezca una imagen mal clasificada.
		 */
		maxSuavidadInterior: number;
		/** Regiones por encima de las cuales ya no se borda sin que alguien mire. */
		maxComponentesLogo: number;
	};
	/**
	 * Cuánto CÓMPUTO se le concede a un diseño antes de rendirse.
	 *
	 * NO SON REGLAS DE FABRICABILIDAD Y NO HAY QUE CONFUNDIRLAS CON ELLAS. Un
	 * diseño que excede esto puede ser perfectamente bordable; lo que pasa es que
	 * prepararlo automáticamente cuesta más de lo que se puede gastar en el
	 * navegador de alguien. Por eso su incidencia es
	 * `COMPLEJIDAD_AUTOMATICA_EXCEDIDA` y no `DISENO_NO_BORDABLE`: la primera
	 * dice "no puedo yo", la segunda dice "no se puede".
	 *
	 * MEDIDO, NO INVENTADO. Sobre el corpus de 63 casos:
	 *
	 *   caso                    componentes  esqueleto px  ramas  comparaciones
	 *   wordmark pequeño                  6           226      6             64
	 *   logo b/n                         14         2 645      7             64
	 *   ilustración muy compleja         38         6 841     52            344
	 *   Discovery (con alfa)            122         6 696    138          1 642
	 *   Discovery (sin alfa)            273         7 072    198         13 158
	 *   pixel art 32                    492        16 587    351            380
	 *   foto posterizada a 8         2 064       117 036 10 556  2 901 322 394
	 *
	 * Los topes van por encima del peor caso legítimo y muy por debajo del
	 * patológico. El que de verdad ataja es `maxComponentes`, porque se comprueba
	 * ANTES de adelgazar nada: la posterizada se para ahí, sin gastar los veinte
	 * segundos de fusión ni los tres de esqueleto.
	 *
	 * `maxComparacionesFusion` es el único que no tiene margen de sobra a
	 * propósito: el bucle de fusión es cuadrático en el número de ramas y es el
	 * que se disparó a tres mil millones. Es una red, no un umbral de calidad.
	 */
	presupuesto: {
		maxPixelesPrimerPlano: number;
		maxComponentes: number;
		maxPixelesEsqueleto: number;
		maxRamas: number;
		maxComparacionesFusion: number;
		/** Pasadas de Zhang-Suen por componente. */
		maxPasadasAdelgazado: number;
	};
	/** Guardrails de trayectoria. Separados del clasificador y del presupuesto. */
	quality: {
		maxSatinWidthMm: number;
		maxAutoSplitSatinWidthMm: number;
		maxSatinStitchLengthMm: number;
		maxRunningStitchLengthMm: number;
		maxFillStitchLengthMm: number;
		maxDirectionDeltaDeg: number;
		maxLocalOverlap: number;
		maxLocalDensity: number;
		maxFanAngleDeg: number;
		maxColumnLengthMm: number;
		maxAccumulatedTurnDeg: number;
		railSampleSpacingMm: number;
		junctionInsetRatio: number;
		taperLengthMm: number;
	};
	/** Detector híbrido y muestreo adaptativo. Ausente en perfiles v1-v3. */
	hybrid?: {
		maxCurvatureDegPerMm: number;
		maxCurvaturePeakDegPerMm: number;
		maxAccumulatedTurnDeg: number;
		maxDirectionDeltaDeg: number;
		maxWidthVariationRatio: number;
		maxRailSlopeMmPerMm: number;
		maxFanRisk: number;
		maxSharpTurns: number;
		simplificationErrorMm: number;
		minAdaptiveSpacingMm: number;
		maxAdaptiveSpacingMm: number;
		joinToleranceMm: number;
	};
};

/** Hipótesis del spike. No sustituye una matriz de test-sew por tela/taller. */
export const EMBROIDERY_PROFILE_V1: EmbroideryProfile = Object.freeze({
	version: "experimental-v1-2026-09-05",
	experimental: true,
	physicallyValidated: false,
	limits: {
		maxWidthMm: 90,
		maxHeightMm: 60,
		maxInputBytes: 750_000,
		maxPixels: 12_000_000,
		maxObjects: 120,
		maxComponents: 100,
		maxNodes: 8_000,
		maxColors: 8,
		maxGradientRatio: 0.18,
		maxTexture: 0.42,
		maxEntropy: 6.8,
	},
	stitches: {
		fillSpacingMm: 0.45,
		satinSpacingMm: 0.42,
		maxStitchLengthMm: 4,
		pullCompensationMm: 0.15,
	},
	geometria: {
		minAreaMm2: 0.75,
		toleranciaMm: 0.12,
		maxGrosorRunningMm: 1,
		minGrosorSatinMm: 1,
		maxGrosorSatinMm: 8,
		minUniformidadSatin: 0.55,
		minAlargamientoSatin: 2.5,
		minAreaUnderlayMm2: 18,
	},
	texto: {
		minAlturaMm: 6,
		minAstaMm: 1.2,
		minContraformaMm2: 0.8,
	},
	raster: {
		maxColoresReducidos: 6,
		deltaObjetivoDeltaE: 3,
		maxPerdidaCuantizacionDeltaE: 12,
		maxSuavidadInterior: 0.61,
		maxComponentesLogo: 40,
	},
	presupuesto: {
		maxPixelesPrimerPlano: 3_000_000,
		maxComponentes: 600,
		maxPixelesEsqueleto: 40_000,
		maxRamas: 1_500,
		maxComparacionesFusion: 2_000_000,
		maxPasadasAdelgazado: 200,
	},
	quality: {
		// Línea base v2: límites diagnósticos, todavía no bloquean producción.
		maxSatinWidthMm: 8,
		maxAutoSplitSatinWidthMm: 8,
		maxSatinStitchLengthMm: 8,
		maxRunningStitchLengthMm: 4,
		maxFillStitchLengthMm: 4.5,
		maxDirectionDeltaDeg: 55,
		maxLocalOverlap: 0.25,
		maxLocalDensity: 24,
		maxFanAngleDeg: 40,
		maxColumnLengthMm: 24,
		maxAccumulatedTurnDeg: 40,
		railSampleSpacingMm: 1.2,
		junctionInsetRatio: 0.35,
		taperLengthMm: 2.5,
	},
});

/**
 * El perfil que emite el editor desde que raster y texto semántico existen.
 *
 * ES OTRA VERSIÓN AUNQUE VARIOS NÚMEROS COINCIDAN. La versión no identifica una
 * tabla de constantes, identifica las REGLAS que produjeron un diseño: con v1
 * el raster se rechazaba y todo se cosía como fill, así que un `bordado.json`
 * de v1 y uno de v2 no son comparables aunque compartan umbrales. v1 se
 * conserva para poder releer lo que ya se generó.
 */
export const EMBROIDERY_PROFILE_V2: EmbroideryProfile = Object.freeze({
	...EMBROIDERY_PROFILE_V1,
	version: "experimental-v2-2026-09-06",
	limits: {
		...EMBROIDERY_PROFILE_V1.limits,
		/* Los techos de v1 contaban OTRA COSA. Allí un objeto era una forma entera
		   cosida de relleno y sin contraformas; aquí una letra son varias columnas
		   —un objeto cada una— y un relleno lleva sus agujeros como subtrazados,
		   así que la misma "Kustto" pasa de 6 objetos a unos 30 y de 6 subtrazados
		   a unos 45 sin ser ni un ápice más compleja de bordar.

		   Siguen siendo topes, no permisos: lo que frenan es un diseño que no se
		   podría coser, y se recalibran con la matriz de test-sew igual que el
		   resto del perfil. */
		maxObjects: 300,
		maxComponents: 320,
		maxNodes: 40_000,
	},
});

/**
 * Perfil de calidad aislado. El editor sigue emitiendo v2 hasta que las dos
 * suites, Docker ARM64 y el E2E controlado queden verdes.
 */
export const EMBROIDERY_PROFILE_V3: EmbroideryProfile = Object.freeze({
	...EMBROIDERY_PROFILE_V2,
	version: "experimental-v3-2026-09-06",
	geometria: {
		...EMBROIDERY_PROFILE_V2.geometria,
		// El baseline mostró puntadas de 7.6–8.0 mm en curvas y texto. Por encima
		// de seis milímetros v3 usa fill antes que fabricar un satin de riesgo.
		maxGrosorSatinMm: 6,
	},
	quality: {
		...EMBROIDERY_PROFILE_V2.quality,
		maxSatinWidthMm: 6,
		maxAutoSplitSatinWidthMm: 12,
		maxSatinStitchLengthMm: 6.5,
		maxColumnLengthMm: 60,
		maxAccumulatedTurnDeg: 80,
		railSampleSpacingMm: 2,
	},
});

/**
 * Candidato híbrido: conserva la geometría productiva v2 para columnas
 * simples y reserva rails/rungs para columnas cuyo riesgo se puede medir.
 * Nunca se selecciona desde `preparar()` mientras el gate experimental siga
 * abierto.
 */
export const EMBROIDERY_PROFILE_HYBRID_V4: EmbroideryProfile = Object.freeze({
	...EMBROIDERY_PROFILE_V3,
	version: "experimental-hybrid-v4-2026-09-06",
	quality: {
		...EMBROIDERY_PROFILE_V3.quality,
		// El baseline v3 mostró que dividir satins de 7+ mm en dos carriles crea
		// cruces y overlap; v4 los deja caer al fill ya existente.
		maxAutoSplitSatinWidthMm: 6,
		// Un rail adaptativo conserva checkpoints internos; no necesita cortar
		// cada 80° y repetir rungs/underlay en cada pedazo.
		maxColumnLengthMm: 100,
		maxAccumulatedTurnDeg: 360,
	},
	hybrid: {
		// P75 de las columnas visualmente estables del baseline, redondeado hacia
		// abajo. Los gates se combinan; ninguno decide por sí solo.
		maxCurvatureDegPerMm: 0.8,
		maxCurvaturePeakDegPerMm: 3,
		maxAccumulatedTurnDeg: 14,
		maxDirectionDeltaDeg: 9,
		maxWidthVariationRatio: 0.08,
		maxRailSlopeMmPerMm: 0.08,
		maxFanRisk: 0.35,
		maxSharpTurns: 0,
		// Menor que la tolerancia visual/física del pipeline (0.2 mm), pero evita
		// muestrear una recta a intervalos fijos de 2 mm.
		simplificationErrorMm: 0.16,
		minAdaptiveSpacingMm: 0.8,
		maxAdaptiveSpacingMm: 8,
		joinToleranceMm: 0.2,
	},
});

export function profileByVersion(version: string): EmbroideryProfile | null {
	if (version === EMBROIDERY_PROFILE_HYBRID_V4.version)
		return EMBROIDERY_PROFILE_HYBRID_V4;
	if (version === EMBROIDERY_PROFILE_V3.version) return EMBROIDERY_PROFILE_V3;
	if (version === EMBROIDERY_PROFILE_V2.version) return EMBROIDERY_PROFILE_V2;
	if (version === EMBROIDERY_PROFILE_V1.version) return EMBROIDERY_PROFILE_V1;
	return null;
}
