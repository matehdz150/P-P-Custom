import type { Rama } from "./esqueleto";
import type { EmbroideryProfile } from "./profile";

export type RepresentationDecision = "stroke-v2" | "rails-v3" | "fill";

export type MetricasComplejidadColumna = {
	lengthMm: number;
	averageWidthMm: number;
	minWidthMm: number;
	maxWidthMm: number;
	widthVariance: number;
	widthVariationRatio: number;
	curvatureDegPerMm: number;
	maxCurvatureDegPerMm: number;
	accumulatedTurningAngleDeg: number;
	maxDirectionDeltaDeg: number;
	junctionCount: number;
	branchCount: number;
	endpointTaper: number;
	selfIntersectionRisk: number;
	fanRisk: number;
	railDivergenceMmPerMm: number;
	railConvergenceMmPerMm: number;
	numberOfSharpTurns: number;
};

export type DecisionRepresentacion = {
	representationDecision: RepresentationDecision;
	reasons: string[];
	metrics: MetricasComplejidadColumna;
};

const grados = (radianes: number) => (radianes * 180) / Math.PI;

function deltaOrientacion(a: number, b: number) {
	let delta = Math.abs(a - b) % Math.PI;
	if (delta > Math.PI / 2) delta = Math.PI - delta;
	return Math.abs(grados(delta));
}

function promedio(valores: number[]) {
	return valores.length
		? valores.reduce((suma, valor) => suma + valor, 0) / valores.length
		: 0;
}

function orientacion(
	a: [number, number],
	b: [number, number],
): number {
	return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

function seCruzan(
	a: [number, number],
	b: [number, number],
	c: [number, number],
	d: [number, number],
) {
	const cruz = (p: [number, number], q: [number, number], r: [number, number]) =>
		(q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
	const abC = cruz(a, b, c);
	const abD = cruz(a, b, d);
	const cdA = cruz(c, d, a);
	const cdB = cruz(c, d, b);
	return abC * abD < -1e-7 && cdA * cdB < -1e-7;
}

/** Mide una columna antes de decidir cómo representarla en SVG. */
export function medirComplejidadColumna(
	rama: Rama,
): MetricasComplejidadColumna {
	const widths =
		rama.anchosMm.length === rama.puntos.length
			? rama.anchosMm
			: rama.puntos.map(() => rama.grosorMedianoMm);
	const averageWidthMm = promedio(widths);
	const widthVariance = promedio(
		widths.map((width) => (width - averageWidthMm) ** 2),
	);
	const lengths: number[] = [];
	const angles: number[] = [];
	for (let i = 1; i < rama.puntos.length; i++) {
		const a = rama.puntos[i - 1];
		const b = rama.puntos[i];
		lengths.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
		angles.push(orientacion(a, b));
	}
	const deltas = angles.slice(1).map((angle, index) =>
		deltaOrientacion(angle, angles[index]),
	);
	const accumulatedTurningAngleDeg = deltas.reduce(
		(suma, value) => suma + value,
		0,
	);
	const lengthMm = lengths.reduce((suma, value) => suma + value, 0);
	const curvaturePeaks = deltas.map(
		(delta, index) =>
			delta /
			Math.max(0.01, (lengths[index] + lengths[index + 1]) / 2),
	);
	let intersections = 0;
	for (let i = 1; i < rama.puntos.length; i++)
		for (let j = i + 2; j < rama.puntos.length; j++) {
			if (!rama.cerrada && i === 1 && j === rama.puntos.length - 1) continue;
			if (
				seCruzan(
					rama.puntos[i - 1],
					rama.puntos[i],
					rama.puntos[j - 1],
					rama.puntos[j],
				)
			)
				intersections++;
		}
	let divergence = 0;
	let convergence = 0;
	for (let i = 1; i < widths.length; i++) {
		const slope = (widths[i] - widths[i - 1]) / Math.max(0.01, lengths[i - 1] ?? 0.01);
		divergence = Math.max(divergence, slope);
		convergence = Math.max(convergence, -slope);
	}
	const endpoints = rama.cerrada
		? [averageWidthMm, averageWidthMm]
		: [widths[0] ?? averageWidthMm, widths.at(-1) ?? averageWidthMm];
	const endpointTaper = averageWidthMm
		? Math.max(0, 1 - Math.min(...endpoints) / averageWidthMm)
		: 0;
	const maxDirectionDeltaDeg = Math.max(0, ...deltas);
	const curvatureDegPerMm =
		accumulatedTurningAngleDeg / Math.max(0.01, lengthMm);
	const widthVariationRatio = averageWidthMm
		? Math.sqrt(widthVariance) / averageWidthMm
		: 0;
	const fanRisk = Math.min(
		1,
		Math.max(
			maxDirectionDeltaDeg / 40,
			(curvatureDegPerMm * averageWidthMm) / 12,
			widthVariationRatio / 0.25,
		),
	);
	const junctionCount =
		Number(rama.junctionInicio) + Number(rama.junctionFin);
	return {
		lengthMm: Number(lengthMm.toFixed(3)),
		averageWidthMm: Number(averageWidthMm.toFixed(3)),
		minWidthMm: Number(Math.min(...widths).toFixed(3)),
		maxWidthMm: Number(Math.max(...widths).toFixed(3)),
		widthVariance: Number(widthVariance.toFixed(5)),
		widthVariationRatio: Number(widthVariationRatio.toFixed(5)),
		curvatureDegPerMm: Number(curvatureDegPerMm.toFixed(4)),
		maxCurvatureDegPerMm: Number(Math.max(0, ...curvaturePeaks).toFixed(4)),
		accumulatedTurningAngleDeg: Number(accumulatedTurningAngleDeg.toFixed(3)),
		maxDirectionDeltaDeg: Number(maxDirectionDeltaDeg.toFixed(3)),
		junctionCount,
		branchCount: 1 + junctionCount,
		endpointTaper: Number(endpointTaper.toFixed(4)),
		selfIntersectionRisk: intersections ? 1 : 0,
		fanRisk: Number(fanRisk.toFixed(4)),
		railDivergenceMmPerMm: Number(divergence.toFixed(4)),
		railConvergenceMmPerMm: Number(convergence.toFixed(4)),
		numberOfSharpTurns: deltas.filter((delta) => delta > 25).length,
	};
}

/** Gates combinados, deterministas y sin conocimiento de fixture/glifo. */
export function decidirRepresentacionSatin(
	rama: Rama,
	profile: EmbroideryProfile,
): DecisionRepresentacion {
	if (!profile.hybrid)
		throw new Error("El perfil no define thresholds híbridos");
	const metrics = medirComplejidadColumna(rama);
	const limits = profile.hybrid;
	const reasons: string[] = [];
	const signals: string[] = [];
	const hardReasons: string[] = [];
	if (rama.cerrada) signals.push("CLOSED_COLUMN");
	/* UN JUNCTION NO BASTA POR SI SOLO.
	   Era `hardReason`, y en un wordmark casi toda columna toca un cruce: el
	   81.8 % de las columnas de `01-resend` acababa en rails y sus nodos
	   pasaban de 31 a 296. Lo que necesita tratamiento especial es la UNION,
	   no el asta recta que llega a ella: un asta uniforme y sin curvatura se
	   representa igual de bien con el stroke de v2, y el manejo del cruce se
	   hace en el borde del segmento. Sigue contando como senal, asi que una
	   columna con cruce Y curvatura Y anchura variable si va a rails. */
	if (metrics.junctionCount) signals.push("JUNCTION");
	if (metrics.curvatureDegPerMm > limits.maxCurvatureDegPerMm)
		signals.push("HIGH_CURVATURE");
	if (metrics.maxCurvatureDegPerMm > limits.maxCurvaturePeakDegPerMm)
		signals.push("CURVATURE_PEAK");
	if (metrics.accumulatedTurningAngleDeg > limits.maxAccumulatedTurnDeg)
		signals.push("ACCUMULATED_TURN");
	if (metrics.maxDirectionDeltaDeg > limits.maxDirectionDeltaDeg)
		signals.push("DIRECTION_CHANGE");
	if (metrics.widthVariationRatio > limits.maxWidthVariationRatio)
		signals.push("WIDTH_VARIANCE");
	if (
		metrics.railDivergenceMmPerMm > limits.maxRailSlopeMmPerMm ||
		metrics.railConvergenceMmPerMm > limits.maxRailSlopeMmPerMm
	)
		signals.push("RAIL_NON_PARALLEL");
	if (metrics.endpointTaper > 0.1) signals.push("ENDPOINT_TAPER");
	if (metrics.selfIntersectionRisk) hardReasons.push("SELF_INTERSECTION_RISK");
	if (metrics.fanRisk > limits.maxFanRisk) signals.push("FAN_RISK");
	if (metrics.numberOfSharpTurns > limits.maxSharpTurns)
		signals.push("SHARP_TURN");
	/* DEMASIADO ANCHA PARA SATIN -> FILL, no rails.
	   Antes esto empujaba a rails, que es justo lo contrario de lo que hace
	   falta: partir una columna ancha en carriles paralelos hace que los rails
	   interiores se replieguen y se crucen. Medido sobre `15-circulo-grueso`
	   (anillo cerrado de 7.4 mm): 1478 cruces con carriles, 228 con fill, y la
	   puntada mas larga cayo de 7.8 mm a 4.8 mm. */
	if (metrics.maxWidthMm > profile.quality.maxSatinWidthMm)
		return {
			representationDecision: "fill",
			reasons: ["WIDTH_TOO_LARGE"],
			metrics,
		};
	// Una señal aislada (por ejemplo una curva muy larga pero suave) no basta.
	// En columnas estrechas el stroke v2 del baseline nunca excedió el límite;
	// los rails sólo aportaron nodos. Las cerradas estrechas también quedaron
	// estables (la O), mientras una cerrada ancha ya entra por WIDE_COLUMN.
	const compositeRisk =
		!rama.cerrada &&
		metrics.averageWidthMm >= 2.2 &&
		signals.length >= 3;
	/* Una columna que ademas de tocar un cruce se curva o cambia de ancho si
	   necesita rails aunque sea estrecha: ahi el stroke unico se abre en
	   abanico. Es el caso de la panza de la `g` y de la curva de la `d`. */
	const junctionConRiesgo =
		metrics.junctionCount > 0 &&
		signals.some((senal) => senal !== "JUNCTION" && senal !== "CLOSED_COLUMN");
	if (hardReasons.length || compositeRisk || junctionConRiesgo)
		reasons.push(...hardReasons, ...signals);
	return {
		representationDecision: reasons.length ? "rails-v3" : "stroke-v2",
		reasons,
		metrics,
	};
}
