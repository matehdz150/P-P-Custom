/**
 * Cuánto se parece cada imagen del banco a "unas pocas tintas planas".
 *
 * Se mide DESPUÉS de cuantizar y no antes: la concentración de colores crudos
 * dice que un logo con antialias son novecientos colores, que es cierto y es
 * irrelevante. Lo que decide si algo se borda es si esos novecientos caben en
 * seis hilos sin que se note.
 */
import path from "node:path";
import sharp from "sharp";
import { aLab } from "@/lib/impresion/mascara";

declare const __dirname: string;
const fixtures = path.resolve(
	__dirname,
	"../../vectorizacion-adaptativa/fixtures",
);
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
	cubos: { llave: number; cuenta: number; lab: number[]; rgb: number[] }[],
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
	let suma = 0,
		total = 0,
		cerca = 0,
		medio = 0;
	for (const c of cubos) {
		let md = Infinity;
		for (const ce of centros) md = Math.min(md, dE(c.lab, ce));
		suma += md * c.cuenta;
		total += c.cuenta;
		if (md <= 6) cerca += c.cuenta;
		if (md <= 12) medio += c.cuenta;
	}
	return {
		deltaMedio: suma / total,
		planitud6: cerca / total,
		planitud12: medio / total,
	};
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
		const { data, info } = await sharp(path.join(fixtures, archivo))
			.resize(1400, null, { fit: "inside" })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const hist = new Map<number, number>();
		let n = 0;
		for (let p = 0; p < info.width * info.height; p++) {
			if (data[p * 4 + 3] < 128) continue;
			n++;
			const k = llaveDe(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
			hist.set(k, (hist.get(k) ?? 0) + 1);
		}
		const cubos = [...hist.entries()]
			.sort((a, b) => b[1] - a[1] || a[0] - b[0])
			.map(([llave, cuenta]) => {
				const rgb = deLlave(llave);
				return { llave, cuenta, rgb, lab: aLab(rgb[0], rgb[1], rgb[2]) };
			});
		const linea = [2, 3, 4, 6, 8].map((k) => {
			const r = kmedias(cubos, k);
			return `k${k}: dE=${r.deltaMedio.toFixed(1)} p6=${(r.planitud6 * 100).toFixed(1)}% p12=${(r.planitud12 * 100).toFixed(1)}%`;
		});
		console.log(
			`${archivo.padEnd(32)} cubos=${String(cubos.length).padStart(5)}`,
		);
		for (const l of linea) console.log(`    ${l}`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
