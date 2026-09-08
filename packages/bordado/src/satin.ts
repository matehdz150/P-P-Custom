import type { Rama } from "./esqueleto";
import { decidirRepresentacionSatin } from "./hybrid";
import type { EmbroideryProfile } from "./profile";

export type SegmentoSatin = {
	d: string;
	puntos: Array<[number, number]>;
	quality: {
		minWidthMm: number;
		maxWidthMm: number;
		averageWidthMm: number;
		widthVariance: number;
		angleVariance: number;
		maxAngleDeltaDeg: number;
		junctionCount: number;
		segmentIndex: number;
		segmentCount: number;
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
	};
};

type Muestra = {
	centro: [number, number];
	ancho: number;
	angulo: number;
	normal: [number, number];
};

const n = (value: number) => Number(value.toFixed(3)).toString();
const punto = ([x, y]: [number, number], primero: boolean) =>
	`${primero ? "M" : "L"}${n(x)} ${n(y)}`;

function deltaAngulo(a: number, b: number) {
	let delta = Math.abs(a - b) % Math.PI;
	if (delta > Math.PI / 2) delta = Math.PI - delta;
	return Math.abs(delta);
}

function interpolarCamino(
	puntos: Array<[number, number]>,
	anchos: number[],
	espaciado: number,
	cerrada: boolean,
) {
	if (puntos.length < 2) return { puntos: [...puntos], anchos: [...anchos] };
	const base = [...puntos];
	const widths = [...anchos];
	if (
		cerrada &&
		Math.hypot(base[0][0] - base.at(-1)![0], base[0][1] - base.at(-1)![1]) >
			1e-6
	) {
		base.push(base[0]);
		widths.push(widths[0]);
	}
	const acumulado = [0];
	for (let i = 1; i < base.length; i++)
		acumulado.push(
			acumulado[i - 1] +
				Math.hypot(base[i][0] - base[i - 1][0], base[i][1] - base[i - 1][1]),
		);
	const total = acumulado.at(-1) ?? 0;
	if (total <= 1e-6) return { puntos: [base[0]], anchos: [widths[0]] };
	const cantidad = Math.max(2, Math.ceil(total / espaciado) + 1);
	const salida: Array<[number, number]> = [];
	const salidaAnchos: number[] = [];
	let segmento = 1;
	for (let i = 0; i < cantidad; i++) {
		const distancia = (i / (cantidad - 1)) * total;
		while (segmento < acumulado.length - 1 && acumulado[segmento] < distancia)
			segmento++;
		const desde = acumulado[segmento - 1];
		const largo = Math.max(1e-9, acumulado[segmento] - desde);
		const t = Math.min(1, Math.max(0, (distancia - desde) / largo));
		const a = base[segmento - 1];
		const b = base[segmento];
		salida.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
		salidaAnchos.push(
			widths[segmento - 1] + (widths[segmento] - widths[segmento - 1]) * t,
		);
	}
	return { puntos: salida, anchos: salidaAnchos };
}

function recortarExtremo(
	puntos: Array<[number, number]>,
	anchos: number[],
	distancia: number,
	desdeInicio: boolean,
) {
	if (distancia <= 0 || puntos.length < 4) return { puntos, anchos };
	const orden = desdeInicio
		? puntos.map((_, i) => i)
		: puntos.map((_, i) => puntos.length - 1 - i);
	let recorrido = 0;
	let cortar = 0;
	for (let k = 1; k < orden.length - 2; k++) {
		const a = puntos[orden[k - 1]];
		const b = puntos[orden[k]];
		recorrido += Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (recorrido >= distancia) {
			cortar = k;
			break;
		}
	}
	if (!cortar) return { puntos, anchos };
	return desdeInicio
		? { puntos: puntos.slice(cortar), anchos: anchos.slice(cortar) }
		: { puntos: puntos.slice(0, -cortar), anchos: anchos.slice(0, -cortar) };
}

/**
 * Acorta una rama que entra a un cruce. El mismo objeto se usa para calcular
 * la cobertura, de modo que el nudo recortado reaparece como sobrante y puede
 * recibir un único fill en vez de tres satins superpuestos.
 */
export function recortarRamaEnJunctions(
	rama: Rama,
	profile: EmbroideryProfile,
): Rama {
	if (rama.cerrada || (!rama.junctionInicio && !rama.junctionFin)) return rama;
	let puntos = rama.puntos;
	let anchos = rama.anchosMm;
	const inset = rama.grosorMedianoMm * profile.quality.junctionInsetRatio;
	if (rama.junctionInicio)
		({ puntos, anchos } = recortarExtremo(puntos, anchos, inset, true));
	if (rama.junctionFin)
		({ puntos, anchos } = recortarExtremo(puntos, anchos, inset, false));
	const pasoPxMm = rama.largoMm / Math.max(1, rama.pixeles.length - 1);
	const quitar = Math.max(0, Math.round(inset / Math.max(pasoPxMm, 0.01)));
	const desde = rama.junctionInicio
		? Math.min(quitar, rama.pixeles.length - 2)
		: 0;
	const hasta = rama.junctionFin
		? Math.max(desde + 2, rama.pixeles.length - quitar)
		: rama.pixeles.length;
	return {
		...rama,
		puntos,
		anchosMm: anchos,
		pixeles: rama.pixeles.slice(desde, hasta),
		largoMm: Math.max(
			0,
			rama.largoMm -
				(rama.junctionInicio ? inset : 0) -
				(rama.junctionFin ? inset : 0),
		),
	};
}

function suavizar(valores: number[], radio = 2) {
	return valores.map((_, i) => {
		let suma = 0;
		let cuenta = 0;
		for (
			let j = Math.max(0, i - radio);
			j <= Math.min(valores.length - 1, i + radio);
			j++
		) {
			suma += valores[j];
			cuenta++;
		}
		return suma / cuenta;
	});
}

function orientar(
	puntos: Array<[number, number]>,
	anchos: number[],
): Muestra[] {
	const salida: Muestra[] = [];
	let normalAnterior: [number, number] | undefined;
	for (let i = 0; i < puntos.length; i++) {
		const a = puntos[Math.max(0, i - 2)];
		const b = puntos[Math.min(puntos.length - 1, i + 2)];
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const norma = Math.hypot(dx, dy) || 1;
		let normal: [number, number] = [-dy / norma, dx / norma];
		if (
			normalAnterior &&
			normal[0] * normalAnterior[0] + normal[1] * normalAnterior[1] < 0
		)
			normal = [-normal[0], -normal[1]];
		normalAnterior = normal;
		salida.push({
			centro: puntos[i],
			ancho: anchos[i],
			angulo: Math.atan2(dy, dx),
			normal,
		});
	}
	return salida;
}

/** Elimina controles redundantes sin mover rails: conserva cambios de ancho,
 * giro de 4 grados o un control cada 8 mm como red de seguridad. */
function compactarMuestras(muestras: Muestra[]) {
	if (muestras.length < 3) return muestras;
	const salida = [muestras[0]];
	let recorrido = 0;
	for (let i = 1; i < muestras.length - 1; i++) {
		recorrido += Math.hypot(
			muestras[i].centro[0] - muestras[i - 1].centro[0],
			muestras[i].centro[1] - muestras[i - 1].centro[1],
		);
		const ultimo = salida.at(-1) as Muestra;
		const giro =
			(deltaAngulo(ultimo.angulo, muestras[i].angulo) * 180) / Math.PI;
		if (
			giro >= 4 ||
			Math.abs(ultimo.ancho - muestras[i].ancho) >= 0.1 ||
			recorrido >= 8
		) {
			salida.push(muestras[i]);
			recorrido = 0;
		}
	}
	salida.push(muestras.at(-1) as Muestra);
	return salida;
}

function rangos(
	muestras: Muestra[],
	profile: EmbroideryProfile,
	maxTurnDeg = profile.quality.maxAccumulatedTurnDeg,
) {
	const salida: Array<[number, number]> = [];
	let inicio = 0;
	let largo = 0;
	let giro = 0;
	for (let i = 1; i < muestras.length; i++) {
		largo += Math.hypot(
			muestras[i].centro[0] - muestras[i - 1].centro[0],
			muestras[i].centro[1] - muestras[i - 1].centro[1],
		);
		giro +=
			(deltaAngulo(muestras[i].angulo, muestras[i - 1].angulo) * 180) / Math.PI;
		if (
			i - inicio >= 4 &&
			(largo >= profile.quality.maxColumnLengthMm ||
				giro >= maxTurnDeg)
		) {
			salida.push([inicio, i]);
			inicio = i;
			largo = 0;
			giro = 0;
		}
	}
	if (muestras.length - 1 - inicio < 3 && salida.length) {
		salida[salida.length - 1][1] = muestras.length - 1;
	} else {
		salida.push([inicio, muestras.length - 1]);
	}
	return salida;
}

function varianza(valores: number[]) {
	if (!valores.length) return 0;
	const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
	return (
		valores.reduce((suma, value) => suma + (value - promedio) ** 2, 0) /
		valores.length
	);
}

function promedio(valores: number[]) {
	return valores.length
		? valores.reduce((suma, value) => suma + value, 0) / valores.length
		: 0;
}

/**
 * Construye satins manuales: dos rails en el mismo sentido y rungs que cruzan
 * ambos rails. Cada rail se deriva de la normal LOCAL del centerline.
 */
export function construirSatinManual(
	rama: Rama,
	profile: EmbroideryProfile,
): SegmentoSatin[] {
	if (
		rama.grosorMedianoMm > profile.quality.maxSatinWidthMm &&
		rama.grosorMedianoMm <= profile.quality.maxAutoSplitSatinWidthMm
	) {
		const base = orientar(rama.puntos, rama.anchosMm);
		const crearCarril = (signo: number): Rama => ({
			...rama,
			puntos: base.map((m) => [
				m.centro[0] + m.normal[0] * m.ancho * 0.25 * signo,
				m.centro[1] + m.normal[1] * m.ancho * 0.25 * signo,
			]),
			anchosMm: rama.anchosMm.map((width) => width / 2),
			grosorMedianoMm: rama.grosorMedianoMm / 2,
			grosorMinimoMm: rama.grosorMinimoMm / 2,
			grosorMaximoMm: rama.grosorMaximoMm / 2,
		});
		return [
			...construirSatinManual(crearCarril(-1), profile),
			...construirSatinManual(crearCarril(1), profile),
		];
	}
	let { puntos, anchos } = interpolarCamino(
		rama.puntos,
		rama.anchosMm.length === rama.puntos.length
			? rama.anchosMm
			: rama.puntos.map(() => rama.grosorMedianoMm),
		profile.quality.railSampleSpacingMm,
		rama.cerrada,
	);
	if (puntos.length < 3) return [];

	anchos = suavizar(anchos).map((value, i) => {
		let factor = 1;
		if (!rama.cerrada && !rama.junctionInicio)
			factor = Math.min(
				factor,
				0.42 +
					0.58 *
						Math.min(
							1,
							(i * profile.quality.railSampleSpacingMm) /
								profile.quality.taperLengthMm,
						),
			);
		if (!rama.cerrada && !rama.junctionFin)
			factor = Math.min(
				factor,
				0.42 +
					0.58 *
						Math.min(
							1,
							((anchos.length - 1 - i) * profile.quality.railSampleSpacingMm) /
								profile.quality.taperLengthMm,
						),
			);
		return Math.min(
			profile.quality.maxSatinWidthMm,
			Math.max(0.65, value * factor),
		);
	});
	const muestras = compactarMuestras(orientar(puntos, anchos));
	const cortes = rangos(muestras, profile);
	const total = cortes.length;

	return cortes.map(([desde, hasta], segmentIndex) => {
		const tramo = muestras.slice(desde, hasta + 1);
		const izquierda = tramo.map(
			(m) =>
				[
					m.centro[0] + (m.normal[0] * m.ancho) / 2,
					m.centro[1] + (m.normal[1] * m.ancho) / 2,
				] as [number, number],
		);
		const derecha = tramo.map(
			(m) =>
				[
					m.centro[0] - (m.normal[0] * m.ancho) / 2,
					m.centro[1] - (m.normal[1] * m.ancho) / 2,
				] as [number, number],
		);
		const rail = (lista: Array<[number, number]>) =>
			lista.map((p, i) => punto(p, i === 0)).join("");
		const indices = [
			...new Set([0, Math.floor((tramo.length - 1) / 2), tramo.length - 1]),
		];
		const rungs = indices.map((i) => {
			const extension = 0.12;
			const normal = tramo[i].normal;
			const a: [number, number] = [
				izquierda[i][0] + normal[0] * extension,
				izquierda[i][1] + normal[1] * extension,
			];
			const b: [number, number] = [
				derecha[i][0] - normal[0] * extension,
				derecha[i][1] - normal[1] * extension,
			];
			return `${punto(a, true)}${punto(b, false)}`;
		});
		const widths = tramo.map((m) => m.ancho);
		const angles = tramo.map((m) => m.angulo);
		const deltas = angles
			.slice(1)
			.map((angle, i) => (deltaAngulo(angle, angles[i]) * 180) / Math.PI);
		return {
			d: [rail(izquierda), rail(derecha), ...rungs].join(""),
			puntos: [...izquierda, ...derecha],
			quality: {
				minWidthMm: Number(Math.min(...widths).toFixed(3)),
				maxWidthMm: Number(Math.max(...widths).toFixed(3)),
				averageWidthMm: Number(
					(widths.reduce((a, b) => a + b, 0) / widths.length).toFixed(3),
				),
				widthVariance: Number(varianza(widths).toFixed(5)),
				angleVariance: Number(varianza(deltas).toFixed(5)),
				maxAngleDeltaDeg: Number(Math.max(0, ...deltas).toFixed(3)),
				junctionCount:
					Number(segmentIndex === 0 && rama.junctionInicio) +
					Number(segmentIndex === total - 1 && rama.junctionFin),
				segmentIndex,
				segmentCount: total,
			},
		};
	});
}

function distanciaPuntoSegmento(
	p: [number, number],
	a: [number, number],
	b: [number, number],
) {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const length2 = dx * dx + dy * dy;
	if (length2 <= 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1]);
	const t = Math.max(
		0,
		Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2),
	);
	return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas-Peucker multiseñal: limita error espacial y error de ancho. */
function simplificarAdaptativo(
	muestras: Muestra[],
	desde: number,
	hasta: number,
	errorMm: number,
	maxSpacingMm: number,
	seleccionados: Set<number>,
) {
	if (hasta <= desde + 1) return;
	const a = muestras[desde];
	const b = muestras[hasta];
	let largo = 0;
	for (let i = desde + 1; i <= hasta; i++)
		largo += Math.hypot(
			muestras[i].centro[0] - muestras[i - 1].centro[0],
			muestras[i].centro[1] - muestras[i - 1].centro[1],
		);
	let peor = -1;
	let indice = -1;
	for (let i = desde + 1; i < hasta; i++) {
		const t = (i - desde) / (hasta - desde);
		const widthError = Math.abs(
			muestras[i].ancho - (a.ancho + (b.ancho - a.ancho) * t),
		);
		const spatialError = distanciaPuntoSegmento(
			muestras[i].centro,
			a.centro,
			b.centro,
		);
		const score = Math.max(
			spatialError / errorMm,
			widthError / Math.max(0.08, errorMm),
		);
		if (score > peor) {
			peor = score;
			indice = i;
		}
	}
	if (peor > 1 || largo > maxSpacingMm) {
		if (largo > maxSpacingMm && peor <= 1) indice = Math.floor((desde + hasta) / 2);
		seleccionados.add(indice);
		simplificarAdaptativo(
			muestras,
			desde,
			indice,
			errorMm,
			maxSpacingMm,
			seleccionados,
		);
		simplificarAdaptativo(
			muestras,
			indice,
			hasta,
			errorMm,
			maxSpacingMm,
			seleccionados,
		);
	}
}

function indicesRungs(muestras: Muestra[], maxSpacingMm: number) {
	const elegidos = new Set<number>([0, muestras.length - 1]);
	let desdeUltimo = 0;
	for (let i = 1; i < muestras.length - 1; i++) {
		desdeUltimo += Math.hypot(
			muestras[i].centro[0] - muestras[i - 1].centro[0],
			muestras[i].centro[1] - muestras[i - 1].centro[1],
		);
		const giro =
			(deltaAngulo(muestras[i - 1].angulo, muestras[i + 1].angulo) * 180) /
			Math.PI;
		const ancho = Math.abs(muestras[i + 1].ancho - muestras[i - 1].ancho);
		if (giro >= 12 || ancho >= 0.18 || desdeUltimo >= maxSpacingMm) {
			elegidos.add(i);
			desdeUltimo = 0;
		}
	}
	if (elegidos.size < 3) elegidos.add(Math.floor((muestras.length - 1) / 2));
	let indices = [...elegidos].sort((a, b) => a - b);
	// Ink/Stitch necesita correspondencia, no un rung por muestra. Siete
	// checkpoints cubren endpoints, centro y cuatro cambios locales sin volver
	// a inflar rectas/curvas suaves al tamaño de la malla cruda.
	if (indices.length > 5) {
		indices = Array.from({ length: 5 }, (_, i) =>
			indices[Math.round((i * (indices.length - 1)) / 4)],
		);
	}
	return [...new Set(indices)];
}

/**
 * Rails v4: parte de una malla fina, conserva sólo controles necesarios para
 * respetar un error físico y desacopla rungs de puntos del esqueleto.
 */
export function construirSatinManualAdaptativo(
	rama: Rama,
	profile: EmbroideryProfile,
): SegmentoSatin[] {
	if (!profile.hybrid)
		throw new Error("El perfil no define muestreo híbrido");
	if (
		rama.grosorMedianoMm > profile.quality.maxSatinWidthMm &&
		rama.grosorMedianoMm <= profile.quality.maxAutoSplitSatinWidthMm
	) {
		const base = orientar(rama.puntos, rama.anchosMm);
		const crearCarril = (signo: number): Rama => ({
			...rama,
			puntos: base.map((m) => [
				m.centro[0] + m.normal[0] * m.ancho * 0.25 * signo,
				m.centro[1] + m.normal[1] * m.ancho * 0.25 * signo,
			]),
			anchosMm: rama.anchosMm.map((width) => width / 2),
			grosorMedianoMm: rama.grosorMedianoMm / 2,
			grosorMinimoMm: rama.grosorMinimoMm / 2,
			grosorMaximoMm: rama.grosorMaximoMm / 2,
		});
		return [
			...construirSatinManualAdaptativo(crearCarril(-1), profile),
			...construirSatinManualAdaptativo(crearCarril(1), profile),
		];
	}
	const decision = decidirRepresentacionSatin(rama, profile);
	let { puntos, anchos } = interpolarCamino(
		rama.puntos,
		rama.anchosMm.length === rama.puntos.length
			? rama.anchosMm
			: rama.puntos.map(() => rama.grosorMedianoMm),
		profile.hybrid.minAdaptiveSpacingMm,
		rama.cerrada,
	);
	if (puntos.length < 3) return [];
	anchos = suavizar(anchos).map((value, i) => {
		let factor = 1;
		const distanciaInicio = i * profile.hybrid!.minAdaptiveSpacingMm;
		const distanciaFin =
			(anchos.length - 1 - i) * profile.hybrid!.minAdaptiveSpacingMm;
		if (!rama.cerrada && !rama.junctionInicio)
			factor = Math.min(
				factor,
				0.42 + 0.58 * Math.min(1, distanciaInicio / profile.quality.taperLengthMm),
			);
		if (!rama.cerrada && !rama.junctionFin)
			factor = Math.min(
				factor,
				0.42 + 0.58 * Math.min(1, distanciaFin / profile.quality.taperLengthMm),
			);
		return Math.min(profile.quality.maxSatinWidthMm, Math.max(0.65, value * factor));
	});
	const densas = orientar(puntos, anchos);
	const keep = new Set<number>([0, densas.length - 1]);
	simplificarAdaptativo(
		densas,
		0,
		densas.length - 1,
		profile.hybrid.simplificationErrorMm,
		profile.hybrid.maxAdaptiveSpacingMm,
		keep,
	);
	const muestras = [...keep]
		.sort((a, b) => a - b)
		.map((index) => densas[index]);
	const cortes = rangos(muestras, profile, rama.cerrada ? 80 : undefined);
	const total = cortes.length;
	return cortes.map(([desde, hasta], segmentIndex) => {
		const tramo = muestras.slice(desde, hasta + 1);
		const izquierda = tramo.map(
			(m) =>
				[
					m.centro[0] + (m.normal[0] * m.ancho) / 2,
					m.centro[1] + (m.normal[1] * m.ancho) / 2,
				] as [number, number],
		);
		const derecha = tramo.map(
			(m) =>
				[
					m.centro[0] - (m.normal[0] * m.ancho) / 2,
					m.centro[1] - (m.normal[1] * m.ancho) / 2,
				] as [number, number],
		);
		const rail = (lista: Array<[number, number]>) =>
			lista.map((p, i) => punto(p, i === 0)).join("");
		const indices = indicesRungs(tramo, profile.hybrid!.maxAdaptiveSpacingMm);
		const rungs = indices.map((i) => {
			const normal = tramo[i].normal;
			const extension = 0.12;
			return `${punto(
				[
					izquierda[i][0] + normal[0] * extension,
					izquierda[i][1] + normal[1] * extension,
				],
				true,
			)}${punto(
				[
					derecha[i][0] - normal[0] * extension,
					derecha[i][1] - normal[1] * extension,
				],
				false,
			)}`;
		});
		const widths = tramo.map((m) => m.ancho);
		const angles = tramo.map((m) => m.angulo);
		const deltas = angles
			.slice(1)
			.map((angle, i) => (deltaAngulo(angle, angles[i]) * 180) / Math.PI);
		const segmentLength = tramo.slice(1).reduce(
			(sum, item, i) =>
				sum + Math.hypot(item.centro[0] - tramo[i].centro[0], item.centro[1] - tramo[i].centro[1]),
			0,
		);
		return {
			d: [rail(izquierda), rail(derecha), ...rungs].join(""),
			puntos: [...izquierda, ...derecha],
			quality: {
				minWidthMm: Number(Math.min(...widths).toFixed(3)),
				maxWidthMm: Number(Math.max(...widths).toFixed(3)),
				averageWidthMm: Number(promedio(widths).toFixed(3)),
				widthVariance: Number(varianza(widths).toFixed(5)),
				angleVariance: Number(varianza(deltas).toFixed(5)),
				maxAngleDeltaDeg: Number(Math.max(0, ...deltas).toFixed(3)),
				junctionCount:
					Number(segmentIndex === 0 && rama.junctionInicio) +
					Number(segmentIndex === total - 1 && rama.junctionFin),
				segmentIndex,
				segmentCount: total,
				representationDecision: "rails-v3",
				representationReasons: decision.reasons,
				lengthMm: Number(segmentLength.toFixed(3)),
				curvatureDegPerMm: decision.metrics.curvatureDegPerMm,
				maxCurvatureDegPerMm: decision.metrics.maxCurvatureDegPerMm,
				accumulatedTurningAngleDeg:
					decision.metrics.accumulatedTurningAngleDeg,
				branchCount: decision.metrics.branchCount,
				endpointTaper: decision.metrics.endpointTaper,
				selfIntersectionRisk: decision.metrics.selfIntersectionRisk,
				fanRisk: decision.metrics.fanRisk,
				railDivergenceMmPerMm: decision.metrics.railDivergenceMmPerMm,
				railConvergenceMmPerMm: decision.metrics.railConvergenceMmPerMm,
				numberOfSharpTurns: decision.metrics.numberOfSharpTurns,
				rawCenterlineNodes: rama.puntos.length,
				rawRailNodes: densas.length * 2,
				finalRailNodes: tramo.length * 2,
				rungsBefore: densas.length,
				rungsAfter: indices.length,
				underlayLayers: segmentIndex === 0 ? 1 : 0,
				estimatedUnderlayStitches:
					segmentIndex === 0 ? Math.ceil(segmentLength / 2.2) : 0,
			},
		};
	});
}
