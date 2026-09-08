import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	construirSatinManual,
	EMBROIDERY_PROFILE_V3,
	recortarRamaEnJunctions,
	type EmbroideryDesign,
	type EmbroideryObject,
	type Rama,
} from "@kustto/bordado";

const here = path.dirname(fileURLToPath(import.meta.url));
const inputRoot = path.join(here, "fixtures");
const outputRoot = path.join(here, "fixtures-v3");

type Subpath = { puntos: Array<[number, number]>; cerrada: boolean };

function parsePath(d: string): Subpath[] {
	const tokens =
		d.match(/[MLCZmlcz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
	const paths: Subpath[] = [];
	let command = "";
	let current: Subpath | undefined;
	let point: [number, number] = [0, 0];
	let i = 0;
	const number = () => Number(tokens[i++]);
	while (i < tokens.length) {
		if (/^[A-Za-z]$/.test(tokens[i])) command = tokens[i++];
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
			for (let step = 1; step <= 12; step++) {
				const t = step / 12;
				const u = 1 - t;
				current.puntos.push([
					u ** 3 * start[0] +
						3 * u ** 2 * t * c1[0] +
						3 * u * t ** 2 * c2[0] +
						t ** 3 * end[0],
					u ** 3 * start[1] +
						3 * u ** 2 * t * c1[1] +
						3 * u * t ** 2 * c2[1] +
						t ** 3 * end[1],
				]);
			}
			point = end;
		} else if (command === "Z") {
			if (current) current.cerrada = true;
			command = "";
		} else if (command) {
			throw new Error(`Comando no soportado en fixture: ${command}`);
		}
	}
	return paths.filter((item) => item.puntos.length >= 2);
}

function length(points: Array<[number, number]>) {
	let total = 0;
	for (let i = 1; i < points.length; i++)
		total += Math.hypot(
			points[i][0] - points[i - 1][0],
			points[i][1] - points[i - 1][1],
		);
	return total;
}

function touches(
	point: [number, number],
	line: Array<[number, number]>,
	tolerance: number,
) {
	return line.some(
		(candidate) =>
			Math.hypot(point[0] - candidate[0], point[1] - candidate[1]) <= tolerance,
	);
}

function outline(
	points: Array<[number, number]>,
	width: number,
	closed: boolean,
) {
	const left: Array<[number, number]> = [];
	const right: Array<[number, number]> = [];
	for (let i = 0; i < points.length; i++) {
		const a = points[Math.max(0, i - 1)];
		const b = points[Math.min(points.length - 1, i + 1)];
		const dx = b[0] - a[0];
		const dy = b[1] - a[1];
		const norm = Math.hypot(dx, dy) || 1;
		const nx = -dy / norm;
		const ny = dx / norm;
		left.push([
			points[i][0] + (nx * width) / 2,
			points[i][1] + (ny * width) / 2,
		]);
		right.push([
			points[i][0] - (nx * width) / 2,
			points[i][1] - (ny * width) / 2,
		]);
	}
	const n = (v: number) => Number(v.toFixed(3));
	const pathOf = (items: Array<[number, number]>) =>
		items.map(([x, y], i) => `${i ? "L" : "M"}${n(x)} ${n(y)}`).join("");
	return closed
		? `${pathOf(left)}Z${pathOf([...right].reverse())}Z`
		: `${pathOf([...left, ...right.reverse()])}Z`;
}

type Unit = {
	object: EmbroideryObject;
	path: Subpath;
	width: number;
	junctionStart: boolean;
	junctionEnd: boolean;
};

function convert(design: EmbroideryDesign): EmbroideryDesign {
	const units: Unit[] = [];
	for (const object of design.objects) {
		if (object.stitch.type !== "satin") continue;
		const width = object.stitch.strokeWidthMm ?? 2.2;
		for (const subpath of parsePath(object.geometry.d))
			units.push({
				object,
				path: subpath,
				width,
				junctionStart: false,
				junctionEnd: false,
			});
	}
	for (let i = 0; i < units.length; i++) {
		if (units[i].path.cerrada) continue;
		for (let j = 0; j < units.length; j++) {
			if (i === j) continue;
			const tolerance = Math.max(units[i].width, units[j].width) * 0.6;
			units[i].junctionStart ||= touches(
				units[i].path.puntos[0],
				units[j].path.puntos,
				tolerance,
			);
			units[i].junctionEnd ||= touches(
				units[i].path.puntos.at(-1)!,
				units[j].path.puntos,
				tolerance,
			);
		}
	}

	const converted: EmbroideryObject[] = design.objects
		.filter((item) => item.stitch.type !== "satin")
		.map((item) => ({ ...item }));
	const issues = [...(design.preparation?.issues ?? [])];
	for (const [unitIndex, unit] of units.entries()) {
		if (unit.width > EMBROIDERY_PROFILE_V3.quality.maxAutoSplitSatinWidthMm) {
			const d = outline(unit.path.puntos, unit.width, unit.path.cerrada);
			converted.push({
				...unit.object,
				id: `${unit.object.id}-v3-fill-${unitIndex}`,
				geometry: { kind: "path", d, fillRule: "evenodd" },
				stitch: {
					type: "fill",
					spacingMm: EMBROIDERY_PROFILE_V3.stitches.fillSpacingMm,
					maxStitchLengthMm:
						EMBROIDERY_PROFILE_V3.quality.maxFillStitchLengthMm,
					underlay: true,
					pullCompensationMm: EMBROIDERY_PROFILE_V3.stitches.pullCompensationMm,
				},
				nodeCount: (d.match(/[ML]/g) ?? []).length,
			});
			issues.push({
				code: "SATIN_TOO_WIDE",
				message: `Columna de ${unit.width.toFixed(1)} mm convertida a fill.`,
				severity: "review",
			});
			continue;
		}
		let branch: Rama = {
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
		branch = recortarRamaEnJunctions(branch, EMBROIDERY_PROFILE_V3);
		const segments = construirSatinManual(branch, EMBROIDERY_PROFILE_V3);
		for (const [segmentIndex, segment] of segments.entries()) {
			const id = `${unit.object.id}-v3-${unitIndex}-${segmentIndex}`;
			converted.push({
				...unit.object,
				id,
				geometry: { kind: "path", d: segment.d },
				stitch: {
					type: "satin",
					satinMode: "rails",
					spacingMm: EMBROIDERY_PROFILE_V3.stitches.satinSpacingMm,
					pullCompensationMm: EMBROIDERY_PROFILE_V3.stitches.pullCompensationMm,
					underlay: true,
				},
				quality: segment.quality,
				dependencies: segmentIndex
					? [`${unit.object.id}-v3-${unitIndex}-${segmentIndex - 1}`]
					: unit.object.dependencies,
				nodeCount: (segment.d.match(/[ML]/g) ?? []).length,
			});
		}
	}
	// La conversión no tiene permiso para reagrupar por tipo: hacerlo cambió de
	// 6 a 8 bloques de color en Discovery. Cada derivado vuelve a la posición
	// de su objeto fuente y sólo se ordena dentro de esa posición.
	const originalOrder = new Map(
		design.objects.map((object, index) => [object.id, index]),
	);
	const sourceIndex = (object: EmbroideryObject) => {
		if (originalOrder.has(object.id))
			return originalOrder.get(object.id) as number;
		for (const [id, index] of originalOrder)
			if (object.id.startsWith(`${id}-v3-`)) return index;
		return design.objects.length;
	};
	converted.sort((a, b) => sourceIndex(a) - sourceIndex(b));
	return {
		...design,
		objects: converted,
		metrics: {
			...design.metrics,
			componentCount: converted.length,
			nodeCount: converted.reduce((sum, item) => sum + item.nodeCount, 0),
		},
		profileVersion: EMBROIDERY_PROFILE_V3.version,
		preparation: design.preparation
			? {
					...design.preparation,
					profileVersion: EMBROIDERY_PROFILE_V3.version,
					issues,
				}
			: undefined,
	};
}

fs.mkdirSync(outputRoot, { recursive: true });
const manifest = JSON.parse(
	fs.readFileSync(path.join(inputRoot, "manifest.json"), "utf8"),
);
for (const fixture of manifest.fixtures) {
	const sourceDir = path.join(inputRoot, fixture.slug);
	const targetDir = path.join(outputRoot, fixture.slug);
	fs.mkdirSync(targetDir, { recursive: true });
	fs.copyFileSync(
		path.join(sourceDir, "input.svg"),
		path.join(targetDir, "input.svg"),
	);
	const source = JSON.parse(
		fs.readFileSync(path.join(sourceDir, "design.json"), "utf8"),
	) as EmbroideryDesign;
	const result = convert(source);
	fs.writeFileSync(
		path.join(targetDir, "design.json"),
		JSON.stringify(result, null, 2),
	);
	fixture.objects = result.objects.length;
}
manifest.profileVersion = EMBROIDERY_PROFILE_V3.version;
fs.writeFileSync(
	path.join(outputRoot, "manifest.json"),
	JSON.stringify(manifest, null, 2),
);
console.log(
	JSON.stringify({ generated: manifest.fixtures.length, output: outputRoot }),
);
