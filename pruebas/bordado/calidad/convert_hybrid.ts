import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	construirSatinManualAdaptativo,
	decidirRepresentacionSatin,
	EMBROIDERY_PROFILE_HYBRID_V4,
	recortarRamaEnJunctions,
	type DecisionRepresentacion,
	type EmbroideryDesign,
	type EmbroideryObject,
	type Rama,
} from "@kustto/bordado";

const here = path.dirname(fileURLToPath(import.meta.url));
const inputRoot = path.join(here, "fixtures");
const outputRoot = path.join(here, "fixtures-hybrid-v4");

type Subpath = { puntos: Array<[number, number]>; cerrada: boolean };
type Unit = {
	object: EmbroideryObject;
	path: Subpath;
	width: number;
	junctionStart: boolean;
	junctionEnd: boolean;
	decision?: DecisionRepresentacion;
};

function parsePath(d: string): Subpath[] {
	const tokens =
		d.match(/[MLCZmlcz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
	const paths: Subpath[] = [];
	let command = "";
	let current: Subpath | undefined;
	let point: [number, number] = [0, 0];
	let index = 0;
	const number = () => Number(tokens[index++]);
	while (index < tokens.length) {
		if (/^[A-Za-z]$/.test(tokens[index])) command = tokens[index++].toUpperCase();
		if (command === "M") {
			point = [number(), number()];
			current = { puntos: [point], cerrada: false };
			paths.push(current);
			command = "L";
		} else if (command === "L") {
			point = [number(), number()];
			current?.puntos.push(point);
		} else if (command === "C") {
			if (!current) throw new Error("C sin M");
			const start = point;
			const c1: [number, number] = [number(), number()];
			const c2: [number, number] = [number(), number()];
			const end: [number, number] = [number(), number()];
			for (let step = 1; step <= 16; step++) {
				const t = step / 16;
				const u = 1 - t;
				current.puntos.push([
					u ** 3 * start[0] + 3 * u ** 2 * t * c1[0] + 3 * u * t ** 2 * c2[0] + t ** 3 * end[0],
					u ** 3 * start[1] + 3 * u ** 2 * t * c1[1] + 3 * u * t ** 2 * c2[1] + t ** 3 * end[1],
				]);
			}
			point = end;
		} else if (command === "Z") {
			if (current) current.cerrada = true;
			command = "";
		} else if (command) throw new Error(`Comando no soportado: ${command}`);
	}
	return paths.filter((item) => item.puntos.length >= 2);
}

function length(points: Array<[number, number]>) {
	return points.slice(1).reduce(
		(sum, point, index) =>
			sum + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]),
		0,
	);
}

function distancePointSegment(
	p: [number, number],
	a: [number, number],
	b: [number, number],
) {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const length2 = dx * dx + dy * dy;
	if (!length2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
	const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length2));
	return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

function touches(point: [number, number], line: Array<[number, number]>, tolerance: number) {
	return line.slice(1).some((end, i) => distancePointSegment(point, line[i], end) <= tolerance);
}

function rama(unit: Unit): Rama {
	return {
		puntos: unit.path.puntos,
		anchosMm: unit.path.puntos.map(() => unit.width),
		pixeles: unit.path.puntos.map((_, i) => i),
		largoMm: length(unit.path.puntos),
		grosorMedianoMm: unit.width,
		grosorMinimoMm: unit.width,
		grosorMaximoMm: unit.width,
		uniformidad: 1,
		cerrada: unit.path.cerrada,
		junctionInicio: unit.junctionStart,
		junctionFin: unit.junctionEnd,
	};
}

const n = (value: number) => Number(value.toFixed(3));
function pathOf(subpath: Subpath) {
	return `${subpath.puntos.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`).join("")}${subpath.cerrada ? "Z" : ""}`;
}

function outline(points: Array<[number, number]>, width: number, closed: boolean) {
	const left: Array<[number, number]> = [];
	const right: Array<[number, number]> = [];
	for (let i = 0; i < points.length; i++) {
		const a = points[Math.max(0, i - 1)];
		const b = points[Math.min(points.length - 1, i + 1)];
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const norm = Math.hypot(dx, dy) || 1;
		left.push([points[i][0] - (dy / norm) * width / 2, points[i][1] + (dx / norm) * width / 2]);
		right.push([points[i][0] + (dy / norm) * width / 2, points[i][1] - (dx / norm) * width / 2]);
	}
	const line = (items: Array<[number, number]>) =>
		items.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`).join("");
	return closed
		? `${line(left)}Z${line([...right].reverse())}Z`
		: `${line([...left, ...right.reverse()])}Z`;
}

function qualityForStroke(unit: Unit) {
	const decision = unit.decision as DecisionRepresentacion;
	return {
		...decision.metrics,
		representationDecision: "stroke-v2" as const,
		representationReasons: [] as string[],
		rawCenterlineNodes: unit.path.puntos.length,
		rawRailNodes: 0,
		finalRailNodes: 0,
		rungsBefore: 0,
		rungsAfter: 0,
		underlayLayers: 1,
		estimatedUnderlayStitches: Math.ceil(decision.metrics.lengthMm / 2.2),
	};
}

function convert(design: EmbroideryDesign) {
	const units: Unit[] = [];
	for (const object of design.objects) {
		if (object.stitch.type !== "satin") continue;
		const width = object.stitch.strokeWidthMm ?? 2.2;
		for (const subpath of parsePath(object.geometry.d))
			units.push({ object, path: subpath, width, junctionStart: false, junctionEnd: false });
	}
	for (const unit of units) {
		if (!unit.path.cerrada) {
			for (const other of units) {
				if (unit === other) continue;
				const tolerance = Math.max(unit.width, other.width) * 0.18;
				unit.junctionStart ||= touches(unit.path.puntos[0], other.path.puntos, tolerance);
				unit.junctionEnd ||= touches(unit.path.puntos.at(-1)!, other.path.puntos, tolerance);
			}
		}
		unit.decision = decidirRepresentacionSatin(rama(unit), EMBROIDERY_PROFILE_HYBRID_V4);
	}

	const output: EmbroideryObject[] = [];
	const joins: Array<Record<string, unknown>> = [];
	for (const object of design.objects) {
		if (object.stitch.type !== "satin") {
			output.push({ ...object });
			continue;
		}
		const own = units.filter((unit) => unit.object.id === object.id);
		const simple = own.filter((unit) => unit.decision?.representationDecision === "stroke-v2");
		const complex = own.filter((unit) => unit.decision?.representationDecision === "rails-v3");
		/* Las columnas anchas van en su propio grupo. Cuando el detector empezo a
		   devolver "fill" como tercer estado, estas dejaron de caer en `simple` y
		   en `complex` a la vez, y el converter las tiraba: los dos fixtures
		   anchos llegaban a Ink/Stitch con el documento vacio y fallaban con
		   "no objects ... to work with". */
		const anchas = own.filter((unit) => unit.decision?.representationDecision === "fill");

		/* UNA COLUMNA, UN UNDERLAY, Y EN EL TRAMO QUE MAS CUBRE.
		 *
		 * `underlayYaPuesto` ya evitaba duplicarlo, pero lo dejaba SIEMPRE en la
		 * parte stroke por el mero hecho de emitirse primero. En una columna
		 * mixta esa parte suele ser el resto corto: en `resend-4-n-0` el stroke
		 * son 88 puntadas y los rails 123. El resultado era lo peor de las dos
		 * opciones —el underlay denso concentrado en el trozo pequeño, con su
		 * ratio de solape disparado (602/1000), y la mayor parte de la columna
		 * SIN soporte—.
		 *
		 * La politica correcta no depende del orden de emision sino de la
		 * geometria: el underlay va donde hay mas columna que sostener. Los
		 * demas tramos de la MISMA columna original no lo repiten. */
		const largoDe = (unidad: (typeof own)[number]) =>
			unidad.decision?.metrics.lengthMm ?? 0;
		const largoSimple = simple.reduce((suma, u) => suma + largoDe(u), 0);
		const largoComplejo = complex.reduce((suma, u) => suma + largoDe(u), 0);
		/* Los fill llevan el suyo siempre: un relleno sin underlay se hunde en la
		   tela y ademas no comparte recorrido con ningun satin de la columna. */
		const underlayEnStroke =
			simple.length > 0 && (complex.length === 0 || largoSimple >= largoComplejo);
		const underlayEnRails = complex.length > 0 && !underlayEnStroke;
		if (simple.length === own.length) {
			const metrics = simple.map(qualityForStroke);
			output.push({
				...object,
				stitch: { ...object.stitch, satinMode: "stroke" },
				quality: {
					...metrics[0],
					lengthMm: n(metrics.reduce((sum, item) => sum + item.lengthMm, 0)),
					rawCenterlineNodes: metrics.reduce((sum, item) => sum + item.rawCenterlineNodes, 0),
					estimatedUnderlayStitches: metrics.reduce((sum, item) => sum + item.estimatedUnderlayStitches, 0),
				},
			});
			continue;
		}
		if (simple.length) {
			const d = simple.map((unit) => pathOf(unit.path)).join("");
			const metrics = simple.map(qualityForStroke);
			output.push({
				...object,
				id: `${object.id}-hybrid-stroke`,
				geometry: { kind: "path", d },
				stitch: {
					...object.stitch,
					satinMode: "stroke",
					underlay: underlayEnStroke,
				},
				quality: {
					...metrics[0],
					lengthMm: n(metrics.reduce((sum, item) => sum + item.lengthMm, 0)),
					rawCenterlineNodes: metrics.reduce((sum, item) => sum + item.rawCenterlineNodes, 0),
					estimatedUnderlayStitches: metrics.reduce((sum, item) => sum + item.estimatedUnderlayStitches, 0),
				},
				nodeCount: (d.match(/[ML]/g) ?? []).length,
			});
		}
		for (const [unitIndex, unit] of [...anchas, ...complex].entries()) {
			if (
				unit.decision?.representationDecision === "fill" ||
				unit.width > EMBROIDERY_PROFILE_HYBRID_V4.quality.maxAutoSplitSatinWidthMm
			) {
				const d = outline(unit.path.puntos, unit.width, unit.path.cerrada);
				output.push({
					...object,
					id: `${object.id}-hybrid-fill-${unitIndex}`,
					geometry: { kind: "path", d, fillRule: "evenodd" },
					stitch: {
						type: "fill",
						spacingMm: EMBROIDERY_PROFILE_HYBRID_V4.stitches.fillSpacingMm,
						maxStitchLengthMm: EMBROIDERY_PROFILE_HYBRID_V4.quality.maxFillStitchLengthMm,
						underlay: true,
						pullCompensationMm: EMBROIDERY_PROFILE_HYBRID_V4.stitches.pullCompensationMm,
					},
					quality: {
						...unit.decision!.metrics,
						representationReasons: ["WIDE_COLUMN_FILL_FALLBACK"],
						underlayLayers: 1,
					},
					nodeCount: (d.match(/[ML]/g) ?? []).length,
				});
				continue;
			}
			const trimmed = recortarRamaEnJunctions(rama(unit), EMBROIDERY_PROFILE_HYBRID_V4);
			const segments = construirSatinManualAdaptativo(trimmed, EMBROIDERY_PROFILE_HYBRID_V4);
			for (const [segmentIndex, segment] of segments.entries()) {
				const id = `${object.id}-hybrid-rails-${unitIndex}-${segmentIndex}`;
				output.push({
					...object,
					id,
					geometry: { kind: "path", d: segment.d },
					stitch: {
						type: "satin",
						satinMode: "rails",
						spacingMm: EMBROIDERY_PROFILE_HYBRID_V4.stitches.satinSpacingMm,
						pullCompensationMm: EMBROIDERY_PROFILE_HYBRID_V4.stitches.pullCompensationMm,
						underlay: segmentIndex === 0 && underlayEnRails,
					},
					quality: segment.quality,
					dependencies: segmentIndex ? [`${object.id}-hybrid-rails-${unitIndex}-${segmentIndex - 1}`] : object.dependencies,
					nodeCount: (segment.d.match(/[ML]/g) ?? []).length,
				});
			}
		}
		if (simple.length && complex.length) {
			const join = {
				sourceObjectId: object.id,
				gapMm: 0,
				overlapMm: 0,
				directionDeltaDeg: 0,
				jumpIntroduced: true,
				measurement: "logical-boundary; DST jump is verified after digitization",
			};
			joins.push(join);
			const target = output.find((item) => item.id === `${object.id}-hybrid-stroke`);
			if (target?.quality) target.quality.join = join;
		}
	}
	const issues = [...(design.preparation?.issues ?? [])];
	return {
		...design,
		objects: output,
		metrics: {
			...design.metrics,
			componentCount: output.length,
			nodeCount: output.reduce((sum, item) => sum + item.nodeCount, 0),
		},
		profileVersion: EMBROIDERY_PROFILE_HYBRID_V4.version,
		preparation: design.preparation
			? { ...design.preparation, profileVersion: EMBROIDERY_PROFILE_HYBRID_V4.version, issues }
			: undefined,
		debug: { hybridJoins: joins },
	};
}

fs.mkdirSync(outputRoot, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(inputRoot, "manifest.json"), "utf8"));
for (const fixture of manifest.fixtures) {
	const sourceDir = path.join(inputRoot, fixture.slug);
	const targetDir = path.join(outputRoot, fixture.slug);
	fs.mkdirSync(targetDir, { recursive: true });
	fs.copyFileSync(path.join(sourceDir, "input.svg"), path.join(targetDir, "input.svg"));
	const source = JSON.parse(fs.readFileSync(path.join(sourceDir, "design.json"), "utf8")) as EmbroideryDesign;
	const result = convert(source);
	fs.writeFileSync(path.join(targetDir, "design.json"), JSON.stringify(result, null, 2));
	fixture.objects = result.objects.length;
}
manifest.profileVersion = EMBROIDERY_PROFILE_HYBRID_V4.version;
fs.writeFileSync(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ generated: manifest.fixtures.length, output: outputRoot }));
