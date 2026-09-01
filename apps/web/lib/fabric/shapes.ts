// Formas vectoriales. Cada una se define con paths SVG en un espacio 0..100,
// así el thumbnail y el objeto del canvas usan la MISMA geometría.
//
// Hay dos familias, y la diferencia importa:
//
//   FORMAS   un solo trazo, sin color propio. Entran en negro y el cliente
//            las recolorea desde el panel de propiedades.
//   GRÁFICOS varios trazos con su color. Entran como grupo y se ven bien de
//            entrada, pero el selector de color de una figura sencilla ya no
//            aplica: para cambiarlos hay que desagrupar.

export interface ShapePath {
	d: string;
	/** Sin color = hereda el de la forma (negro al insertar). */
	fill?: string;
}

export interface ShapeDef {
	id: string;
	name: string;
	/** Trazo único de las formas monocromas. */
	d?: string;
	/** Trazos con color de los gráficos. */
	paths?: ShapePath[];
}

// ── helpers de geometría ────────────────────────────────────────────────────
function pts(points: [number, number][]): string {
	const trazo = points
		.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
		.join(" ");
	return `${trazo} Z`;
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

/** Círculo como path cerrado. `horario: false` lo invierte para hacer huecos. */
function circle(cx: number, cy: number, r: number, horario = true): string {
	const f = horario ? 1 : 0;
	return `M${cx} ${cy - r} A${r} ${r} 0 1 ${f} ${cx} ${cy + r} A${r} ${r} 0 1 ${f} ${cx} ${cy - r} Z`;
}

/** Corazón centrado, para reusarlo en varios gráficos. */
function heart(cx: number, cy: number, s: number): string {
	const p = (x: number, y: number) =>
		`${(cx + x * s).toFixed(2)} ${(cy + y * s).toFixed(2)}`;
	return `M${p(0, 0.44)} C${p(-0.42, 0.14)} ${p(-0.52, -0.1)} ${p(-0.52, -0.24)} C${p(-0.52, -0.42)} ${p(-0.36, -0.52)} ${p(-0.24, -0.52)} C${p(-0.12, -0.52)} ${p(-0.04, -0.44)} ${p(0, -0.34)} C${p(0.04, -0.44)} ${p(0.12, -0.52)} ${p(0.24, -0.52)} C${p(0.36, -0.52)} ${p(0.52, -0.42)} ${p(0.52, -0.24)} C${p(0.52, -0.1)} ${p(0.42, 0.14)} ${p(0, 0.44)} Z`;
}

// Paleta de los gráficos. No son los colores de la marca: son del diseño del
// cliente, así que buscan verse bien impresos sobre prenda clara u oscura.
const ROJO = "#e23b4e";
const ROSA = "#f5849b";
const NARANJA = "#f5883c";
const AMARILLO = "#f7c33f";
const VERDE = "#3fa96a";
const VERDE_CLARO = "#7ac74f";
const AZUL = "#3b7dd8";
const CELESTE = "#63c2e8";
const MORADO = "#8b5cd6";
const CREMA = "#f4ead6";
const CAFE = "#8a5a34";

export const SHAPES: ShapeDef[] = [
	// ── básicas ───────────────────────────────────────────────────────────
	{ id: "circle", name: "Círculo", d: circle(50, 50, 46) },
	{ id: "square", name: "Cuadrado", d: "M8 8 H92 V92 H8 Z" },
	{ id: "triangle", name: "Triángulo", d: "M50 8 L92 88 L8 88 Z" },
	{
		id: "diamond",
		name: "Rombo",
		d: pts([
			[50, 6],
			[90, 50],
			[50, 94],
			[10, 50],
		]),
	},
	{ id: "pentagon", name: "Pentágono", d: regularPolygon(5) },
	{ id: "hexagon", name: "Hexágono", d: regularPolygon(6) },
	{ id: "line", name: "Línea", d: "M8 46 H92 V54 H8 Z" },
	{ id: "semicircle", name: "Semicírculo", d: "M6 68 A44 44 0 0 1 94 68 Z" },
	{
		id: "arch",
		name: "Arco",
		d: "M6 94 V50 A44 44 0 0 1 94 50 V94 H70 V50 A24 24 0 0 0 30 50 V94 Z",
	},
	{
		id: "ring",
		name: "Aro",
		d: `${circle(50, 50, 46)} ${circle(50, 50, 30, false)}`,
	},

	// ── estrellas y destellos ─────────────────────────────────────────────
	{ id: "star5", name: "Estrella", d: star(5, 48, 20) },
	{ id: "star4", name: "Chispa", d: star(4, 48, 13) },
	{ id: "burst10", name: "Destello", d: star(10, 48, 26) },
	{ id: "star8", name: "Roseta", d: star(8, 48, 30) },
	{
		id: "sparkle",
		name: "Brillo",
		d: "M50 6 C54 32 68 46 94 50 C68 54 54 68 50 94 C46 68 32 54 6 50 C32 46 46 32 50 6 Z",
	},

	// ── símbolos ──────────────────────────────────────────────────────────
	{ id: "heart", name: "Corazón", d: heart(50, 50, 92) },
	{
		id: "plus",
		name: "Cruz",
		d: "M38 8 H62 V38 H92 V62 H62 V92 H38 V62 H8 V38 H38 Z",
	},
	{
		id: "bolt",
		name: "Rayo",
		d: "M58 4 L20 56 H44 L38 96 L80 40 H54 L58 4 Z",
	},
	{
		id: "drop",
		name: "Gota",
		d: "M50 6 C50 6 84 44 84 62 A34 34 0 0 1 16 62 C16 44 50 6 50 6 Z",
	},
	{
		id: "flame",
		name: "Llama",
		d: "M50 96 C28 96 18 80 18 62 C18 40 38 30 42 4 C48 18 56 26 56 38 C56 46 52 50 52 56 C52 62 58 64 62 58 C64 54 64 48 62 44 C76 54 82 62 82 62 C82 82 72 96 50 96 Z",
	},
	{
		id: "crown",
		name: "Corona",
		d: "M8 76 L14 26 L34 48 L50 16 L66 48 L86 26 L92 76 Z",
	},
	{
		id: "shield",
		name: "Escudo",
		d: "M50 6 L88 20 V52 C88 74 72 88 50 96 C28 88 12 74 12 52 V20 Z",
	},
	{
		id: "leaf",
		name: "Hoja",
		d: "M86 12 C40 12 12 40 12 74 C12 82 16 88 20 92 C24 60 46 40 82 34 C52 44 34 62 30 92 C64 92 88 62 86 12 Z",
	},
	{
		id: "flower",
		name: "Flor",
		d: [
			circle(50, 24, 21),
			circle(78, 44, 21),
			circle(67, 76, 21),
			circle(33, 76, 21),
			circle(22, 44, 21),
			circle(50, 52, 19),
		].join(" "),
	},
	{
		id: "music",
		name: "Nota",
		d: "M78 6 L38 18 V64 A16 16 0 1 0 48 78 V34 L68 28 V52 A16 16 0 1 0 78 66 Z",
	},

	// ── contenedores y flechas ────────────────────────────────────────────
	{
		id: "bubble",
		name: "Globo de texto",
		d: "M14 14 H86 A8 8 0 0 1 94 22 V62 A8 8 0 0 1 86 70 H46 L26 92 V70 H14 A8 8 0 0 1 6 62 V22 A8 8 0 0 1 14 14 Z",
	},
	{
		id: "banner",
		name: "Listón",
		d: "M4 30 H96 L82 50 L96 70 H4 L18 50 Z",
	},
	{
		id: "ticket",
		name: "Boleto",
		d: "M8 24 H92 V42 A8 8 0 0 0 92 58 V76 H8 V58 A8 8 0 0 0 8 42 Z",
	},
	{
		id: "arrow",
		name: "Flecha",
		d: "M4 38 H58 V18 L96 50 L58 82 V62 H4 Z",
	},
	{
		id: "chevron",
		name: "Galón",
		d: "M22 8 L74 50 L22 92 L6 78 L44 50 L6 22 Z",
	},
	{
		id: "wave",
		name: "Onda",
		d: "M0 46 C14 14 36 14 50 46 C60 68 70 68 80 50 L100 62 C84 96 58 96 44 62 C34 38 24 38 16 60 Z",
	},
	{
		id: "cloud",
		name: "Nube",
		d: "M28 76 A20 20 0 0 1 30 36 A24 24 0 0 1 74 42 A18 18 0 0 1 76 76 Z",
	},
];

export const GRAPHICS: ShapeDef[] = [
	{
		id: "corazones",
		name: "Corazones",
		paths: [
			{ d: heart(30, 62, 54), fill: ROSA },
			{ d: heart(70, 60, 46), fill: NARANJA },
			{ d: heart(50, 34, 62), fill: ROJO },
		],
	},
	{
		id: "corazon-doble",
		name: "Corazón doble",
		paths: [
			{ d: heart(50, 50, 96), fill: ROJO },
			{ d: heart(50, 52, 52), fill: ROSA },
		],
	},
	{
		id: "corazon-latido",
		name: "Latido",
		paths: [
			{ d: heart(50, 48, 92), fill: ROJO },
			// El pulso va DENTRO del corazón: en crema sobre blanco no se veía.
			{
				d: "M14 46 H32 L38 32 L48 66 L58 42 L63 46 H86 V56 H58 L49 82 L38 48 L27 56 H14 Z",
				fill: CREMA,
			},
		],
	},
	{
		id: "flor-color",
		name: "Flor",
		paths: [
			{ d: circle(50, 18, 17), fill: ROSA },
			{ d: circle(80, 40, 17), fill: ROSA },
			{ d: circle(68, 76, 17), fill: ROSA },
			{ d: circle(32, 76, 17), fill: ROSA },
			{ d: circle(20, 40, 17), fill: ROSA },
			{ d: circle(50, 50, 16), fill: AMARILLO },
		],
	},
	{
		id: "ramo",
		name: "Ramito",
		paths: [
			{
				d: "M48 96 C48 60 44 40 30 22 L36 18 C50 36 54 60 54 96 Z",
				fill: VERDE,
			},
			{ d: circle(30, 22, 13), fill: MORADO },
			{ d: circle(62, 34, 13), fill: ROSA },
			{ d: circle(44, 44, 12), fill: AMARILLO },
			{
				d: "M52 62 C68 58 78 46 80 32 C64 36 54 48 52 62 Z",
				fill: VERDE_CLARO,
			},
		],
	},
	{
		id: "sol",
		name: "Sol",
		paths: [
			{ d: star(12, 48, 34), fill: NARANJA },
			{ d: circle(50, 50, 28), fill: AMARILLO },
		],
	},
	{
		id: "arcoiris",
		name: "Arcoíris",
		paths: [
			{ d: "M4 84 A46 46 0 0 1 96 84 H82 A32 32 0 0 0 18 84 Z", fill: ROJO },
			{
				d: "M18 84 A32 32 0 0 1 82 84 H68 A18 18 0 0 0 32 84 Z",
				fill: AMARILLO,
			},
			{ d: "M32 84 A18 18 0 0 1 68 84 H54 A4 4 0 0 0 46 84 Z", fill: AZUL },
		],
	},
	{
		id: "globos",
		name: "Globos",
		paths: [
			// Los hilos primero, para que los globos los tapen en el nudo.
			{
				d: "M28 50 C32 68 40 80 46 98 L50 96 C44 78 36 66 32 49 Z",
				fill: CAFE,
			},
			{
				d: "M68 54 C66 70 58 82 50 98 L54 99 C62 82 70 70 72 53 Z",
				fill: CAFE,
			},
			{
				d: "M48 72 C48 82 48 90 49 98 L52 97 C51 88 51 80 51 72 Z",
				fill: CAFE,
			},
			{ d: circle(28, 28, 22), fill: ROJO },
			{ d: circle(70, 32, 19), fill: CELESTE },
			{ d: circle(50, 58, 15), fill: AMARILLO },
		],
	},
	{
		id: "confeti",
		name: "Confeti",
		paths: [
			{ d: "M12 10 H26 V22 H12 Z", fill: ROJO },
			{ d: "M74 6 H88 V18 H74 Z", fill: CELESTE },
			{ d: circle(50, 20, 8), fill: AMARILLO },
			{ d: "M20 44 H34 V56 H20 Z", fill: MORADO },
			{ d: circle(80, 48, 8), fill: VERDE_CLARO },
			{ d: star(4, 14, 4, 52, 54), fill: NARANJA },
			{ d: "M8 76 H22 V88 H8 Z", fill: VERDE },
			{ d: circle(44, 86, 8), fill: ROSA },
			{ d: star(4, 14, 4, 78, 82), fill: AZUL },
		],
	},
	{
		id: "estrellas",
		name: "Estrellas",
		paths: [
			{ d: star(5, 34, 14, 38, 38), fill: AMARILLO },
			{ d: star(5, 22, 9, 74, 30), fill: NARANJA },
			{ d: star(5, 18, 7, 62, 76), fill: AMARILLO },
			{ d: star(4, 12, 3, 22, 78), fill: NARANJA },
		],
	},
	{
		id: "pastel",
		name: "Pastel",
		paths: [
			{ d: "M48 12 H52 V30 H48 Z", fill: NARANJA },
			{ d: "M50 4 C56 10 56 16 50 16 C44 16 44 10 50 4 Z", fill: AMARILLO },
			{ d: "M20 30 H80 V52 H20 Z", fill: ROSA },
			{ d: "M14 52 H86 V78 H14 Z", fill: CREMA },
			{ d: "M14 78 H86 V92 H14 Z", fill: CAFE },
		],
	},
	{
		id: "regalo",
		name: "Regalo",
		paths: [
			{ d: "M10 38 H90 V52 H10 Z", fill: ROJO },
			{ d: "M16 52 H84 V92 H16 Z", fill: ROSA },
			{ d: "M44 38 H56 V92 H44 Z", fill: AMARILLO },
			{
				d: "M50 38 C34 38 22 30 26 20 C30 12 44 16 50 34 C56 16 70 12 74 20 C78 30 66 38 50 38 Z",
				fill: AMARILLO,
			},
		],
	},
	{
		id: "hojas",
		name: "Ramas",
		paths: [
			{ d: "M48 96 V26 H52 V96 Z", fill: CAFE },
			{ d: "M50 30 C68 26 80 34 82 46 C66 50 54 44 50 30 Z", fill: VERDE },
			{
				d: "M50 48 C32 44 20 52 18 64 C34 68 46 62 50 48 Z",
				fill: VERDE_CLARO,
			},
			{ d: "M50 60 C68 56 80 64 82 76 C66 80 54 74 50 60 Z", fill: VERDE },
		],
	},
	{
		id: "ola",
		name: "Ola",
		paths: [
			{
				d: "M4 40 C18 20 32 20 46 40 C60 60 74 60 88 40 L96 52 C78 76 60 76 46 56 C32 36 22 36 12 52 Z",
				fill: AZUL,
			},
			{
				d: "M4 62 C18 42 32 42 46 62 C60 82 74 82 88 62 L96 74 C78 96 60 96 46 76 C32 56 22 56 12 74 Z",
				fill: CELESTE,
			},
		],
	},
];
