// Diseños de texto predefinidos. Cada preset es una composición de líneas:
// líneas planas (Textbox) o curvadas (CurvedText cuando curvature != 0).

export interface PresetElement {
	text: string;
	font: string;
	/** tamaño relativo en px (se escala al área editable) */
	size: number;
	weight?: string | number;
	italic?: boolean;
	/** -100 (arch up) … 0 (plano) … 100 (arch down) */
	curvature?: number;
	/** desplazamiento vertical desde el centro, en px relativos */
	dy: number;
	/** desplazamiento horizontal desde el centro */
	dx?: number;
	spacing?: number;
}

export interface TextPreset {
	id: string;
	name: string;
	elements: PresetElement[];
}

export const TEXT_PRESETS: TextPreset[] = [
	{
		id: "sarcasm-university",
		name: "Sarcasm University",
		elements: [
			{
				text: "SARCASM",
				font: "Anton",
				size: 52,
				curvature: -42,
				dy: -38,
				spacing: 1,
			},
			{ text: "UNIVERSITY", font: "Bebas Neue", size: 26, dy: 28, spacing: 6 },
		],
	},
	{
		id: "real-apparel",
		name: "Real Apparel Co.",
		elements: [
			{
				text: "19      90",
				font: "Playfair Display",
				size: 16,
				dy: -86,
				spacing: 4,
			},
			{
				text: "REAL",
				font: "Playfair Display",
				size: 46,
				weight: 700,
				dy: -46,
			},
			{
				text: "APPAREL",
				font: "Playfair Display",
				size: 46,
				weight: 700,
				dy: 0,
			},
			{ text: "CO.", font: "Playfair Display", size: 46, weight: 700, dy: 46 },
			{
				text: "PREMIUM SHIRTS",
				font: "Bebas Neue",
				size: 18,
				dy: 96,
				spacing: 4,
			},
		],
	},
	{
		id: "progress-perfection",
		name: "Progress",
		elements: [
			{ text: "Progress", font: "Pacifico", size: 56, dy: -24 },
			{
				text: "OVER",
				font: "Bebas Neue",
				size: 22,
				dy: 28,
				dx: 30,
				spacing: 3,
			},
			{
				text: "PERFECTION",
				font: "Bebas Neue",
				size: 22,
				dy: 54,
				dx: 30,
				spacing: 3,
			},
		],
	},
	{
		id: "wholeness",
		name: "Wholeness",
		elements: [
			{
				text: "WHOLENESS",
				font: "Playfair Display",
				size: 44,
				weight: 700,
				curvature: -35,
				dy: -20,
				spacing: 2,
			},
			{ text: "EST. 1995", font: "Bebas Neue", size: 18, dy: 40, spacing: 5 },
		],
	},
	{
		id: "sweet-dreams",
		name: "Sweet Dreams",
		elements: [
			{
				text: "CUSTOM SLEEPWEAR",
				font: "Bebas Neue",
				size: 16,
				curvature: -40,
				dy: -70,
				spacing: 3,
			},
			{ text: "SWEET", font: "Anton", size: 60, dy: -16 },
			{ text: "DREAMS", font: "Anton", size: 60, dy: 40 },
			{
				text: "... ARE MADE OF FLEECE",
				font: "Bebas Neue",
				size: 15,
				dy: 86,
				spacing: 3,
			},
		],
	},
	{
		id: "new-day",
		name: "New Day",
		elements: [
			{ text: "IT'S A", font: "Bebas Neue", size: 20, dy: -78, spacing: 6 },
			{ text: "NEW", font: "Anton", size: 72, dy: -28 },
			{ text: "DAY", font: "Anton", size: 72, dy: 36 },
			{
				text: "RISE N' SHINE",
				font: "Bebas Neue",
				size: 18,
				dy: 92,
				spacing: 5,
			},
		],
	},
	{
		id: "be-good",
		name: "Be Good Do Good",
		elements: [
			{
				text: "be good   do good",
				font: "Playfair Display",
				size: 34,
				italic: true,
				curvature: 40,
				dy: 0,
			},
		],
	},
	{
		id: "art-lover",
		name: "Art Lover Boutique",
		elements: [
			{ text: "art", font: "Anton", size: 44, dx: -40, dy: -44 },
			{ text: "lover", font: "Anton", size: 44, dx: -40, dy: 2 },
			{ text: "boutique", font: "Anton", size: 44, dx: -40, dy: 48 },
			{
				text: "PRINTS MADE WITH LOVE",
				font: "Bebas Neue",
				size: 13,
				curvature: -70,
				dx: 70,
				dy: -30,
				spacing: 2,
			},
		],
	},
	{
		id: "surfing-wave",
		name: "Surfing The Wave",
		elements: [
			{
				text: "SURFING THE WAVE",
				font: "Anton",
				size: 30,
				curvature: -30,
				dy: -60,
				spacing: 1,
			},
			{
				text: "SURFING THE WAVE",
				font: "Anton",
				size: 30,
				curvature: -30,
				dy: -10,
				spacing: 1,
			},
			{
				text: "SURFING THE WAVE",
				font: "Anton",
				size: 30,
				curvature: -30,
				dy: 40,
				spacing: 1,
			},
			{
				text: "circa 1990",
				font: "Bebas Neue",
				size: 14,
				dy: 86,
				dx: -90,
				spacing: 2,
			},
		],
	},
	{
		id: "generacion",
		name: "Generación",
		elements: [
			{
				text: "GENERACIÓN",
				font: "Bebas Neue",
				size: 24,
				curvature: -34,
				dy: -76,
				spacing: 7,
			},
			{ text: "2026", font: "Archivo Black", size: 86, dy: -6 },
			{ text: "LO LOGRAMOS", font: "Bebas Neue", size: 18, dy: 66, spacing: 5 },
		],
	},
	{
		id: "equipo",
		name: "Equipo",
		elements: [
			{ text: "EQUIPO", font: "Oswald", size: 30, dy: -70, spacing: 8 },
			{ text: "07", font: "Archivo Black", size: 120, dy: 6 },
			{ text: "TU APELLIDO", font: "Oswald", size: 22, dy: 84, spacing: 5 },
		],
	},
	{
		id: "nuestra-boda",
		name: "Nuestra boda",
		elements: [
			{ text: "nuestra", font: "Dancing Script", size: 40, dy: -50 },
			{ text: "boda", font: "Great Vibes", size: 78, dy: 8 },
			{
				text: "12 · 09 · 2026",
				font: "Bebas Neue",
				size: 18,
				dy: 76,
				spacing: 5,
			},
		],
	},
	{
		id: "staff",
		name: "Staff",
		elements: [
			{ text: "STAFF", font: "Black Ops One", size: 76, dy: -14 },
			{
				text: "NO PREGUNTES, YO TAMPOCO SÉ",
				font: "Space Mono",
				size: 13,
				dy: 52,
				spacing: 1,
			},
		],
	},
	{
		id: "hecho-en-mexico",
		name: "Hecho en México",
		elements: [
			{
				text: "HECHO EN",
				font: "Alfa Slab One",
				size: 34,
				dy: -40,
				spacing: 2,
			},
			{ text: "MÉXICO", font: "Alfa Slab One", size: 58, dy: 16 },
			{
				text: "CON TODO Y GANAS",
				font: "Bebas Neue",
				size: 16,
				dy: 74,
				spacing: 4,
			},
		],
	},
	{
		id: "buenas-vibras",
		name: "Buenas vibras",
		elements: [
			{ text: "buenas", font: "Shrikhand", size: 56, dx: -20, dy: -30 },
			{ text: "vibras", font: "Shrikhand", size: 56, dx: 20, dy: 34 },
			{ text: "ÚNICAMENTE", font: "Space Mono", size: 14, dy: 92, spacing: 3 },
		],
	},
	{
		id: "club-nocturno",
		name: "Club",
		elements: [
			{ text: "CLUB", font: "Monoton", size: 72, dy: -22 },
			{
				text: "DE LOS QUE SE DUERMEN TEMPRANO",
				font: "Bebas Neue",
				size: 15,
				curvature: 46,
				dy: 46,
				spacing: 2,
			},
		],
	},
	{
		id: "nota-a-mano",
		name: "Nota a mano",
		elements: [
			{ text: "acuérdate", font: "Caveat", size: 62, dy: -34 },
			{ text: "de descansar", font: "Permanent Marker", size: 40, dy: 28 },
			{ text: "— es en serio", font: "Rock Salt", size: 15, dx: 40, dy: 82 },
		],
	},
	{
		id: "est-boutique",
		name: "Est. Boutique",
		elements: [
			{
				text: "ESTABLECIDA EN",
				font: "Bebas Neue",
				size: 15,
				curvature: -60,
				dy: -78,
				spacing: 4,
			},
			{ text: "TU", font: "DM Serif Display", size: 40, dy: -30 },
			{ text: "MARCA", font: "DM Serif Display", size: 58, dy: 20 },
			{
				text: "HECHO A MANO",
				font: "Bebas Neue",
				size: 15,
				curvature: 60,
				dy: 84,
				spacing: 4,
			},
		],
	},
	{
		id: "retro-sunset",
		name: "Retro",
		elements: [
			{
				text: "CALIFORNIA",
				font: "Righteous",
				size: 40,
				curvature: -50,
				dy: -46,
				spacing: 2,
			},
			{ text: "BAJA SUR", font: "Bungee", size: 34, dy: 16 },
			{ text: "1 9 8 4", font: "Righteous", size: 20, dy: 70, spacing: 6 },
		],
	},
];
