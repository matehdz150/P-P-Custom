export const EMBROIDERY_SCHEMA_VERSION = 1 as const;
export const INKSTITCH_ENGINE_VERSION = "inkstitch-3.3.0" as const;

export const EMBROIDERY_STATUSES = [
	"QUEUED",
	"PROCESSING",
	"READY",
	"REVIEW",
	"REJECTED",
	"FAILED",
] as const;
export type EmbroideryStatus = (typeof EMBROIDERY_STATUSES)[number];
export type EmbroideryDecision = "accept" | "review" | "reject";

export type EmbroideryMetrics = {
	alphaCoverage?: number;
	colorEntropy?: number;
	edgeDensity?: number;
	texture?: number;
	gradientRatio?: number;
	componentCount: number;
	nodeCount: number;
	stitchCount?: number;
	colorCount?: number;
	colorChanges?: number;
	jumps?: number;
	trims?: number;
	widthMm?: number;
	heightMm?: number;
};

export type EmbroideryObject = {
	id: string;
	sourceObjectId: string;
	sourceType: "text" | "vector" | "raster";
	classification: "text" | "logo" | "icon" | "illustration" | "photo";
	colorId: string;
	geometry: {
		kind: "path";
		/** SVG path commands whose coordinates are already millimetres. */
		d: string;
		fillRule?: "nonzero" | "evenodd";
	};
	stitch: {
		type: "running" | "satin" | "fill";
		/** v2 usa un stroke. v3 usa dos rails y rungs dentro del mismo path. */
		satinMode?: "stroke" | "rails";
		strokeWidthMm?: number;
		angleDeg?: number;
		spacingMm?: number;
		maxStitchLengthMm?: number;
		underlay?: boolean;
		pullCompensationMm?: number;
		trimAfter?: boolean;
	};
	/** Diagnóstico geométrico previo al motor; no es una validación física. */
	quality?: {
		minWidthMm?: number;
		maxWidthMm?: number;
		averageWidthMm?: number;
		widthVariance?: number;
		widthVariationRatio?: number;
		angleVariance?: number;
		maxAngleDeltaDeg?: number;
		maxDirectionDeltaDeg?: number;
		junctionCount?: number;
		segmentIndex?: number;
		segmentCount?: number;
		representationDecision?: "stroke-v2" | "rails-v3";
		representationReasons?: string[];
		lengthMm?: number;
		curvatureDegPerMm?: number;
		maxCurvatureDegPerMm?: number;
		accumulatedTurningAngleDeg?: number;
		branchCount?: number;
		endpointTaper?: number;
		selfIntersectionRisk?: number;
		fanRisk?: number;
		railDivergenceMmPerMm?: number;
		railConvergenceMmPerMm?: number;
		numberOfSharpTurns?: number;
		rawCenterlineNodes?: number;
		rawRailNodes?: number;
		finalRailNodes?: number;
		rungsBefore?: number;
		rungsAfter?: number;
		underlayLayers?: number;
		estimatedUnderlayStitches?: number;
		join?: {
			gapMm: number;
			overlapMm: number;
			directionDeltaDeg: number;
			jumpIntroduced: boolean;
		};
	};
	/** Dependencias de capa que el optimizador de travel nunca puede cruzar. */
	dependencies?: string[];
	bounds: { xMm: number; yMm: number; widthMm: number; heightMm: number };
	nodeCount: number;
};

/**
 * Qué se le hizo al original para poder bordarlo.
 *
 * NO ES TELEMETRÍA. Es la prueba de que un raster pasó por preparación: sin
 * este bloque, `validateDesign` sigue rechazando cualquier objeto `raster`.
 * También es lo único que permite responder "por qué salió así" cuando un
 * taller devuelva una prenda dentro de seis meses, porque el PNG original no se
 * guarda junto al diseño.
 */
export type EmbroideryPreparation = {
	profileVersion: string;
	raster?: {
		/** Colores distintos del original, antes de tocar nada. */
		sourceColorCount: number;
		reducedColorCount: number;
		/** Cuánto se desvió la paleta reducida del original, en ΔE medio. */
		quantizationDeltaE: number;
		classification: "logo" | "illustration" | "photo";
		/** Regiones eliminadas por caer bajo el área mínima. */
		removedRegions: number;
		removedAreaMm2: number;
		hadAlpha: boolean;
		mmPorPx: number;
	};
	texto?: {
		satinColumns: number;
		runningPaths: number;
		fillAreas: number;
	};
	issues: EmbroideryIssue[];
};

export type EmbroideryDesign = {
	schemaVersion: typeof EMBROIDERY_SCHEMA_VERSION;
	sourceSnapshotHash: string;
	productId: string;
	sideId: string;
	physical: { widthMm: number; heightMm: number };
	bounds: { xMm: number; yMm: number; widthMm: number; heightMm: number };
	colors: Array<{
		id: string;
		sourceHex: string;
		displayHex: string;
		order: number;
	}>;
	objects: EmbroideryObject[];
	metrics: EmbroideryMetrics;
	preparation?: EmbroideryPreparation;
	profileVersion: string;
	engineVersion: string;
};

export type EmbroideryIssue = {
	code: string;
	message: string;
	severity: "review" | "reject";
};

export type EmbroideryJobPublic = {
	jobId: string;
	designHash: string;
	status: EmbroideryStatus;
	decision?: EmbroideryDecision;
	confidence?: number;
	previewUrl?: string;
	issues: EmbroideryIssue[];
	metrics?: EmbroideryMetrics;
};
