import type {
	EmbroideryDesign,
	EmbroideryIssue,
	EmbroideryMetrics,
	EmbroideryPreparation,
} from "@kustto/bordado";

/**
 * Lo que cruza entre el editor y el worker de bordado.
 *
 * NADA DE FABRIC PASA POR AQUÍ. Un objeto de Fabric tiene el canvas, el DOM y
 * media librería colgando; no es serializable y no lo será. Lo que cruza son
 * píxeles y cadenas de trazado, ya en MILÍMETROS: el worker no sabe nada del
 * lienzo del editor ni de su escala, y no puede equivocarse en una conversión
 * que ya está hecha.
 *
 * LA REVISIÓN VIAJA EN LOS DOS SENTIDOS. El comprador puede mover una letra
 * mientras se prepara el diseño anterior, y entonces la respuesta que llega es
 * de un diseño que ya no existe. Aplicarla pondría en pantalla una vista previa
 * de algo que el comprador ya cambió. Con la revisión en la respuesta, el
 * cliente compara y tira lo viejo sin pensarlo.
 */

/** Una imagen ya pintada sobre la rejilla física, lista para analizar. */
export type FuenteRaster = {
	tipo: "raster";
	sourceObjectId: string;
	/** RGBA de la rejilla completa, con su margen. Se transfiere, no se copia. */
	datos: Uint8ClampedArray;
	ancho: number;
	alto: number;
	mmPorPx: number;
	desplazamientoMm: number;
};

/** Un texto ya convertido a curvas, en milímetros desde el origen del área. */
export type FuenteTexto = {
	tipo: "texto";
	sourceObjectId: string;
	d: string;
	colorHex: string;
};

/** Un vector del editor, agrupado por tinta y en milímetros. */
export type FuenteVector = {
	tipo: "vector";
	sourceObjectId: string;
	porColor: Array<{ hex: string; caminos: string[] }>;
};

export type FuenteCapturada = FuenteRaster | FuenteTexto | FuenteVector;

export type SolicitudDePreparacion = {
	revision: number;
	productId: string;
	sideId: string;
	widthMm: number;
	heightMm: number;
	/** Ya calculado en el hilo principal: necesita el JSON del lienzo. */
	sourceSnapshotHash: string;
	fuentes: FuenteCapturada[];
};

export type RespuestaDePreparacion =
	| {
			revision: number;
			estado: "listo";
			design: EmbroideryDesign;
			preparation: EmbroideryPreparation;
			metrics: EmbroideryMetrics;
			/** Cuánto tardó cada etapa. Para el taller, no para la pantalla. */
			tiempos: Record<string, number>;
	  }
	| {
			revision: number;
			estado: "rechazado";
			incidencias: EmbroideryIssue[];
			tiempos: Record<string, number>;
	  }
	| {
			revision: number;
			estado: "error";
			mensaje: string;
	  };

export type MensajeAlWorker =
	| { tipo: "preparar"; solicitud: SolicitudDePreparacion }
	/** Sube el listón: el worker descarta todo lo que sea anterior. */
	| { tipo: "olvidar"; revision: number };
