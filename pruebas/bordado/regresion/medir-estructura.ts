/**
 * Qué queda de cada imagen cuando se le exige que sea bordable.
 *
 * La pregunta no es "¿esto es una foto?" sino "¿cuánto de esto sobrevive a la
 * regla de que una región de menos de 0.75 mm2 no se puede bordar?". Un logo
 * conserva casi todo su tinta en unas pocas regiones grandes; una fotografía se
 * deshace en miles de motas, y ninguna cantidad de planitud de color arregla
 * eso.
 */
import path from "node:path";
import { componentes, EMBROIDERY_PROFILE_V2 } from "@kustto/bordado";
import sharp from "sharp";
import { aLab } from "@/lib/impresion/mascara";

declare const __dirname: string;
const fixtures = path.resolve(
	__dirname,
	"../../vectorizacion-adaptativa/fixtures",
);
const MM_POR_PX = 0.05;
const MIN_AREA = EMBROIDERY_PROFILE_V2.geometria.minAreaMm2;
const BITS = 5;
const llaveDe = (r: number, g: number, b: number) => {
	const s = 8 - BITS;
	return ((r >> s) << (BITS * 2)) | ((g >> s) << BITS) | (b >> s);
};
const deLlave = (k: number): [number, number, number] => {
	const s = 8 - BITS,
		m = (1 << BITS) - 1,
		h = 1 << (s - 1);
	return [
		(((k >> (BITS * 2)) & m) << s) + h,
		(((k >> BITS) & m) << s) + h,
		((k & m) << s) + h,
	];
};
const dE = (a: number[], b: number[]) =>
	Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function kmedias(
	cubos: { llave: number; cuenta: number; lab: number[] }[],
	k: number,
) {
	const semillas = [cubos[0]];
	const cand = cubos.slice(0, 256);
	while (semillas.length < Math.min(k, cubos.length)) {
		let mejor = cand[0],
			mejorD = -1;
		for (const c of cand) {
			let cerca = Infinity;
			for (const s of semillas) cerca = Math.min(cerca, dE(c.lab, s.lab));
			const p = cerca * Math.log1p(c.cuenta);
			if (p > mejorD) {
				mejorD = p;
				mejor = c;
			}
		}
		if (semillas.includes(mejor)) break;
		semillas.push(mejor);
	}
	let centros = semillas.map((s) => [...s.lab]);
	for (let v = 0; v < 12; v++) {
		const sum = centros.map(() => [0, 0, 0, 0]);
		for (const c of cubos) {
			let m = 0,
				md = Infinity;
			for (let i = 0; i < centros.length; i++) {
				const d = dE(c.lab, centros[i]);
				if (d < md) {
					md = d;
					m = i;
				}
			}
			sum[m][0] += c.lab[0] * c.cuenta;
			sum[m][1] += c.lab[1] * c.cuenta;
			sum[m][2] += c.lab[2] * c.cuenta;
			sum[m][3] += c.cuenta;
		}
		centros = centros.map((c, i) =>
			sum[i][3]
				? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]]
				: c,
		);
	}
	const asign = new Map<number, number>();
	let suma = 0,
		total = 0;
	for (const c of cubos) {
		let m = 0,
			md = Infinity;
		for (let i = 0; i < centros.length; i++) {
			const d = dE(c.lab, centros[i]);
			if (d < md) {
				md = d;
				m = i;
			}
		}
		asign.set(c.llave, m);
		suma += md * c.cuenta;
		total += c.cuenta;
	}
	return { centros, asign, deltaMedio: suma / total };
}

const casos = [
	"01-logo-color-alpha.png",
	"02-logo-color-sin-alpha.png",
	"03-logo-blanco-negro.png",
	"04-wordmark-texto-pequeno.png",
	"05-icono-geometrico.png",
	"06-ilustracion.png",
	"07-retrato.jpg",
	"08-fotografia-alpha.png",
	"09-degradados.png",
	"10-jpeg-ruido-compresion.jpg",
];

async function main() {
	for (const archivo of casos) {
		const anchoPx = Math.round(70 / MM_POR_PX);
		const { data, info } = await sharp(path.join(fixtures, archivo))
			.resize(anchoPx, null, { fit: "inside" })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const n = info.width * info.height;
		const primer = new Uint8Array(n);
		const hist = new Map<number, number>();
		let dis = 0;
		for (let p = 0; p < n; p++) {
			if (data[p * 4 + 3] < 128) continue;
			primer[p] = 1;
			dis++;
			const k = llaveDe(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
			hist.set(k, (hist.get(k) ?? 0) + 1);
		}
		const cubos = [...hist.entries()]
			.sort((a, b) => b[1] - a[1] || a[0] - b[0])
			.map(([llave, cuenta]) => {
				const rgb = deLlave(llave);
				return { llave, cuenta, lab: aLab(rgb[0], rgb[1], rgb[2]) };
			});

		const filas: string[] = [];
		for (const k of [2, 3, 4, 6]) {
			const { centros, asign, deltaMedio } = kmedias(cubos, k);
			let areaGrande = 0,
				regiones = 0,
				motas = 0;
			for (let c = 0; c < centros.length; c++) {
				const m = new Uint8Array(n);
				for (let p = 0; p < n; p++)
					if (
						primer[p] &&
						asign.get(
							llaveDe(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]),
						) === c
					)
						m[p] = 1;
				for (const comp of componentes({
					datos: m,
					ancho: info.width,
					alto: info.height,
					mmPorPx: MM_POR_PX,
				})) {
					const area = comp.pixeles.length * MM_POR_PX * MM_POR_PX;
					if (area >= MIN_AREA) {
						areaGrande += comp.pixeles.length;
						regiones++;
					} else motas++;
				}
			}
			filas.push(
				`k${k}: dE=${deltaMedio.toFixed(1)} conserva=${((areaGrande / dis) * 100).toFixed(1)}% regiones=${regiones} motas=${motas}`,
			);
		}
		console.log(
			`${archivo.padEnd(32)} cubos=${String(cubos.length).padStart(5)}`,
		);
		for (const f of filas) console.log(`    ${f}`);
	}
}
main().catch((e) => {
	console.error(e);
	process.exit(1);
});
