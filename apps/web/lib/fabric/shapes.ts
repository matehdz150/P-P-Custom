// Formas vectoriales. Cada una se define con un path SVG en un espacio
// 0..100, así el thumbnail y el objeto del canvas usan la MISMA geometría.

export interface ShapeDef {
	id: string;
	name: string;
	/** path SVG en viewBox 0 0 100 100 */
	d: string;
}

// ── helpers de geometría ────────────────────────────────────────────────────
function pts(points: [number, number][]): string {
	return (
		points
			.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
			.join(" ") + " Z"
	);
}

function regularPolygon(sides: number, r = 46, cx = 50, cy = 50): string {
	const p: [number, number][] = [];
	for (let i = 0; i < sides; i++) {
		const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
		p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
	}
	return pts(p);
}

function star(
	points: number,
	rOuter = 48,
	rInner = rOuter * 0.42,
	cx = 50,
	cy = 50,
): string {
	const p: [number, number][] = [];
	for (let i = 0; i < points * 2; i++) {
		const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
		const r = i % 2 === 0 ? rOuter : rInner;
		p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
	}
	return pts(p);
}

export const SHAPES: ShapeDef[] = [
	{ id: "star5", name: "Estrella", d: star(5, 48, 20) },
	{
		id: "heart",
		name: "Corazón",
		d: "M50 86 C18 62 8 44 8 30 C8 16 19 8 30 8 C39 8 46 13 50 22 C54 13 61 8 70 8 C81 8 92 16 92 30 C92 44 82 62 50 86 Z",
	},
	{ id: "line", name: "Línea", d: "M8 46 H92 V54 H8 Z" },
	{ id: "triangle", name: "Triángulo", d: "M50 8 L92 88 L8 88 Z" },
	{
		id: "circle",
		name: "Círculo",
		d: "M50 4 A46 46 0 1 0 50 96 A46 46 0 1 0 50 4 Z",
	},
	{ id: "square", name: "Cuadrado", d: "M8 8 H92 V92 H8 Z" },
	{ id: "burst10", name: "Destello", d: star(10, 48, 26) },
	{
		id: "sparkle",
		name: "Brillo",
		d: "M50 6 C54 32 68 46 94 50 C68 54 54 68 50 94 C46 68 32 54 6 50 C32 46 46 32 50 6 Z",
	},
	{
		id: "semicircle",
		name: "Semicírculo",
		d: "M6 68 A44 44 0 0 1 94 68 Z",
	},
	{
		id: "arch",
		name: "Arco",
		d: "M8 74 A42 42 0 0 1 92 74 L72 74 A22 22 0 0 0 28 74 Z",
	},
	{ id: "star8", name: "Roseta", d: star(8, 48, 30) },
	{ id: "hexagon", name: "Hexágono", d: regularPolygon(6) },
	{ id: "pentagon", name: "Pentágono", d: regularPolygon(5) },
	{ id: "diamond", name: "Rombo", d: pts([[50, 6], [90, 50], [50, 94], [10, 50]]) },
];
