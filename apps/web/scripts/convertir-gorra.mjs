/**
 * Convierte el GLB de la gorra al binario que carga el editor.
 *
 * QUÉ TIENE DE MALO EL ARCHIVO DE ORIGEN. Es una descarga de Sketchfab de
 * 71 MB, de los cuales 68 son TRES TEXTURAS de 4K. No sirven aquí: la gorra se
 * tiñe con el color del producto y el estampado se pinta encima, igual que la
 * playera. La geometría son 3 MB.
 *
 * QUÉ SE TIRA
 *
 *   · Las texturas, las cámaras y las luces del export. La escena la monta el
 *     componente.
 *   · Las correas del cierre trasero (`plastic`): 48 768 triángulos, el 52 %
 *     del modelo, para dos piezas de plástico de un par de centímetros. Se
 *     puede volver a meter decimadas si se echan de menos.
 *
 * CÓMO QUEDA MAPEADO. La gorra sólo tiene un lado imprimible —`front`, 9 × 5
 * cm— así que basta con una región texturizada: el PANEL DELANTERO, proyectado
 * de frente igual que el pecho de la playera. Todo lo demás va con tela lisa,
 * que es lo que aprendimos con las mangas: una cara que gira casi de canto no
 * se puede texturizar con proyección plana sin embarrar el dibujo.
 *
 *   node apps/web/scripts/convertir-gorra.mjs <archivo.glb>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

/** Ancho real de una gorra de adulto, para poder hablar en centímetros. */
const ANCHO_CM = 19;
/** A cuánto se lleva el ancho del modelo en el mundo del editor. */
const ANCHO = 1.2;

/* Cuándo un triángulo mira lo bastante al frente como para que la proyección
   plana lo texturice bien. Mismo criterio que en la playera, y por lo mismo:
   por debajo de esto el dibujo se estira en una cuña de color. */
const UMBRAL_FRENTE = 0.5;

/** Piezas que no se llevan al editor. Ver la cabecera. */
const FUERA = /^plastic$/i;

const entrada = process.argv[2];
if (!entrada) {
	console.error("falta el .glb");
	process.exit(1);
}

// ---- Lectura del GLB de origen ---------------------------------------------

const bruto = readFileSync(entrada);
const largoJson = bruto.readUInt32LE(12);
const gltf = JSON.parse(bruto.toString("utf8", 20, 20 + largoJson));
const inicioBin = 20 + largoJson + 8;

const COMPONENTES = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const ANCHURAS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/**
 * Lee un accesor.
 *
 * Se honra `byteStride`: tres de las siete vistas del archivo lo traen, y
 * leerlas como si fueran compactas devuelve coordenadas mezcladas de dos
 * atributos distintos. Sale una malla de picos, no un error.
 */
function leer(indice) {
	const acc = gltf.accessors[indice];
	const vista = gltf.bufferViews[acc.bufferView];
	const Tipo = COMPONENTES[acc.componentType];
	const ancho = ANCHURAS[acc.type];
	const base = inicioBin + (vista.byteOffset ?? 0) + (acc.byteOffset ?? 0);
	const paso = vista.byteStride || ancho * Tipo.BYTES_PER_ELEMENT;
	const salida = new Tipo(acc.count * ancho);
	for (let i = 0; i < acc.count; i++) {
		const o = base + i * paso;
		for (let c = 0; c < ancho; c++)
			salida[i * ancho + c] =
				Tipo === Float32Array
					? bruto.readFloatLE(o + c * 4)
					: Tipo === Uint32Array
						? bruto.readUInt32LE(o + c * 4)
						: Tipo === Uint16Array
							? bruto.readUInt16LE(o + c * 2)
							: bruto.readUInt8(o + c);
	}
	return salida;
}

// ---- Matrices: el export trae jerarquía y transformaciones -----------------

const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiplicar(a, b) {
	const m = new Array(16).fill(0);
	for (let f = 0; f < 4; f++)
		for (let c = 0; c < 4; c++)
			for (let k = 0; k < 4; k++) m[c * 4 + f] += a[k * 4 + f] * b[c * 4 + k];
	return m;
}

/** TRS a matriz, para los nodos que no traen `matrix`. */
function deTRS(n) {
	if (n.matrix) return n.matrix;
	const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
	const [sx, sy, sz] = n.scale ?? [1, 1, 1];
	const [tx, ty, tz] = n.translation ?? [0, 0, 0];
	const r = [
		1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
		2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
		2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
	];
	return [
		r[0] * sx, r[1] * sx, r[2] * sx, 0,
		r[3] * sy, r[4] * sy, r[5] * sy, 0,
		r[6] * sz, r[7] * sz, r[8] * sz, 0,
		tx, ty, tz, 1,
	];
}

const punto = (m, [x, y, z]) => [
	m[0] * x + m[4] * y + m[8] * z + m[12],
	m[1] * x + m[5] * y + m[9] * z + m[13],
	m[2] * x + m[6] * y + m[10] * z + m[14],
];

/* La normal se gira SIN la traslación. Con escala uniforme —lo que trae este
   archivo— la parte 3×3 basta; con escala no uniforme haría falta la inversa
   traspuesta y las normales saldrían torcidas. */
function normal(m, [x, y, z]) {
	const v = [
		m[0] * x + m[4] * y + m[8] * z,
		m[1] * x + m[5] * y + m[9] * z,
		m[2] * x + m[6] * y + m[10] * z,
	];
	const l = Math.hypot(...v) || 1;
	return [v[0] / l, v[1] / l, v[2] / l];
}

// ---- Recorrer la escena y recoger triángulos en mundo ----------------------

const V = [];
const N = [];
/* La UV ORIGINAL del modelo. No se usa para el arte —para eso se genera una
   proyección plana— pero SÍ para el mapa de normales, que es donde viven las
   costuras, los ojales y el pespunte de la visera. Sin ella la gorra sale como
   una pieza de plástico liso. */
const UV0 = [];
const tris = [];
let descartados = 0;

function recorrer(indice, padre) {
	const n = gltf.nodes[indice];
	const m = multiplicar(padre, deTRS(n));
	if (n.mesh != null) {
		const malla = gltf.meshes[n.mesh];
		const salta = FUERA.test(malla.name ?? "");
		for (const prim of malla.primitives) {
			const pos = leer(prim.attributes.POSITION);
			const nor = prim.attributes.NORMAL != null ? leer(prim.attributes.NORMAL) : null;
			const tex = prim.attributes.TEXCOORD_0 != null ? leer(prim.attributes.TEXCOORD_0) : null;
			const idx = leer(prim.indices);
			if (salta) {
				descartados += idx.length / 3;
				continue;
			}
			const base = V.length;
			for (let i = 0; i < pos.length; i += 3) {
				V.push(punto(m, [pos[i], pos[i + 1], pos[i + 2]]));
				N.push(nor ? normal(m, [nor[i], nor[i + 1], nor[i + 2]]) : [0, 0, 1]);
				const k = (i / 3) * 2;
				UV0.push(tex ? [tex[k], tex[k + 1]] : [0, 0]);
			}
			for (let t = 0; t < idx.length; t += 3)
				tris.push([base + idx[t], base + idx[t + 1], base + idx[t + 2]]);
		}
	}
	for (const h of n.children ?? []) recorrer(h, m);
}

for (const raiz of gltf.scenes[gltf.scene ?? 0].nodes) recorrer(raiz, IDENT);

// ---- Centrar y escalar -----------------------------------------------------

const caja = { min: [1e18, 1e18, 1e18], max: [-1e18, -1e18, -1e18] };
for (const v of V)
	for (let c = 0; c < 3; c++) {
		if (v[c] < caja.min[c]) caja.min[c] = v[c];
		if (v[c] > caja.max[c]) caja.max[c] = v[c];
	}
const escala = ANCHO / (caja.max[0] - caja.min[0]);
const centro = caja.min.map((v, c) => (v + caja.max[c]) / 2);
const P = V.map((v) => v.map((x, c) => (x - centro[c]) * escala));

/* La visera sale hacia +Z en este modelo, así que el frente mira a +Z y la
   proyección va en ese eje —la misma que el pecho de la playera, con el signo
   que le toca. */
const uv = (x, y) => [0.5 + x / ANCHO, 0.5 + y / ALTO()];
function ALTO() {
	return (caja.max[1] - caja.min[1]) * escala;
}

// ---- Repartir: panel delantero contra el resto -----------------------------

const matNormales = gltf.materials.find((m) => m.normalTexture);
const relieveDelMaterial = matNormales?.normalTexture?.scale ?? 1;

const grupos = { frente: [], resto: [] };
for (const t of tris) {
	const nz = t.reduce((s, i) => s + N[i][2], 0) / 3;
	const cz = t.reduce((s, i) => s + P[i][2], 0) / 3;
	/* Delantero = mira al frente Y está en la mitad de delante. Lo segundo hace
	   falta: el forro interior también tiene caras que miran a +Z, pero desde
	   dentro y por detrás del panel. */
	if (nz >= UMBRAL_FRENTE && cz > 0) grupos.frente.push(t);
	else grupos.resto.push(t);
}

function malla(lista, conUV) {
	const mapa = new Map();
	const pos = [], nor = [], tex = [], tex1 = [], idx = [];
	for (const t of lista)
		for (const i of t) {
			let k = mapa.get(i);
			if (k === undefined) {
				k = mapa.size;
				mapa.set(i, k);
				pos.push(...P[i]);
				nor.push(...N[i]);
				tex.push(...(conUV ? uv(P[i][0], P[i][1]) : [0, 0]));
				tex1.push(...UV0[i]);
			}
			idx.push(k);
		}
	return { pos, nor, uv: tex, uv1: tex1, idx };
}

const mallas = [
	["frente", malla(grupos.frente, true)],
	["resto", malla(grupos.resto, false)],
];

/* Hasta dónde llega el panel delantero en el lienzo. El arte se recorta a
   esto: fuera, la gorra ya gira y sólo saldría la cuña estirada. */
const us = [], vs = [];
for (const t of grupos.frente)
	for (const i of t) {
		const [u, v] = uv(P[i][0], P[i][1]);
		us.push(u);
		vs.push(v);
	}
us.sort((a, b) => a - b);
vs.sort((a, b) => a - b);
const pc = (arr, q) => arr[Math.floor((arr.length - 1) * q)];

// ---- Escribir el GLB -------------------------------------------------------

const trozos = [];
let offset = 0;
const vistas = [], accesos = [];

function guardar(datos, tipo, componente, cuenta, objetivo) {
	const bytes = Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength);
	const relleno = (4 - (bytes.length % 4)) % 4;
	trozos.push(bytes, Buffer.alloc(relleno));
	const vista = vistas.length;
	vistas.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(objetivo ? { target: objetivo } : {}) });
	offset += bytes.length + relleno;
	const min = [], max = [];
	if (tipo === "VEC3")
		for (let c = 0; c < 3; c++) {
			let a = 1e18, b = -1e18;
			for (let i = c; i < datos.length; i += 3) { if (datos[i] < a) a = datos[i]; if (datos[i] > b) b = datos[i]; }
			min.push(a); max.push(b);
		}
	accesos.push({ bufferView: vista, componentType: componente, count: cuenta, type: tipo, ...(min.length ? { min, max } : {}) });
	return accesos.length - 1;
}

const primitivas = mallas.map(([nombre, m]) => ({
	nombre,
	prim: {
		attributes: {
			POSITION: guardar(new Float32Array(m.pos), "VEC3", 5126, m.pos.length / 3, 34962),
			NORMAL: guardar(new Float32Array(m.nor), "VEC3", 5126, m.nor.length / 3, 34962),
			TEXCOORD_0: guardar(new Float32Array(m.uv), "VEC2", 5126, m.uv.length / 2, 34962),
			/* La UV del modelo, para el mapa de normales. Va como segundo juego
			   porque el primero lo ocupa la proyección plana del arte. */
			TEXCOORD_1: guardar(new Float32Array(m.uv1), "VEC2", 5126, m.uv1.length / 2, 34962),
		},
		indices: guardar(new Uint32Array(m.idx), "SCALAR", 5125, m.idx.length, 34963),
	},
}));

const bin = Buffer.concat(trozos);
const json = {
	asset: { version: "2.0", generator: "kustto convertir-gorra" },
	scene: 0,
	scenes: [
		{
			nodes: primitivas.map((_, i) => i),
			/* Lo que el editor necesita para dimensionar el estampado en
			   centímetros y para saber dónde puede pintar. Viaja en el GLB y no
			   como constantes en el código, igual que en la playera. */
			extras: {
				cmPorUnidad: ANCHO_CM / ANCHO,
				/* El alto del modelo en el mundo. El lienzo tiene que llevar esta
				   proporción o un círculo del diseño saldría ovalado. */
				alto: ALTO(),
				/* LA SILUETA QUE SE VE DE FRENTE, no la caja del modelo. La caja
				   incluye el forro interior y el hueco trasero, que quedan
				   escondidos, así que su centro cae más abajo que el de lo que se
				   ve y la gorra salía descentrada. Con esto el editor encuadra
				   sobre lo que hay realmente en pantalla. */
				visible: (() => {
					const ys = [];
					for (const t of tris) {
						const nz = t.reduce((a, i) => a + N[i][2], 0) / 3;
						if (nz <= 0) continue;
						for (const i of t) ys.push(P[i][1]);
					}
					ys.sort((a, b) => a - b);
					const q = (f) => ys[Math.floor((ys.length - 1) * f)];
					return { y0: q(0.01), y1: q(0.99) };
				})(),
				/* Con cuánta fuerza aplicar el relieve. Viene del material del
				   original, no inventada. */
				relieve: relieveDelMaterial,
				panel: { u0: pc(us, 0.02), u1: pc(us, 0.98), v0: pc(vs, 0.02), v1: pc(vs, 0.98) },
			},
		},
	],
	nodes: primitivas.map((p, i) => ({ mesh: i, name: p.nombre })),
	meshes: primitivas.map((p) => ({ name: p.nombre, primitives: [p.prim] })),
	accessors: accesos,
	bufferViews: vistas,
	buffers: [{ byteLength: bin.length }],
};

const jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
const jsonPad = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
const binPad = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
const total = 12 + 8 + jsonPad.length + 8 + binPad.length;
const glb = Buffer.alloc(total);
glb.write("glTF", 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(total, 8);
glb.writeUInt32LE(jsonPad.length, 12); glb.write("JSON", 16);
jsonPad.copy(glb, 20);
glb.writeUInt32LE(binPad.length, 20 + jsonPad.length); glb.write("BIN\0", 24 + jsonPad.length);
binPad.copy(glb, 28 + jsonPad.length);

const salida = path.join(process.cwd(), "apps/web/public/modelos/gorra.glb");
mkdirSync(path.dirname(salida), { recursive: true });
writeFileSync(salida, glb);

/* El mapa de normales del original es de 4096 px y pesa 31 MB. A 1024 en JPEG
   son 282 KB y las costuras se siguen leyendo: es relieve, no color, así que
   aguanta la compresión mucho mejor que una textura de albedo. */
/* Por tener mapa de normales, no por nombre: cada export de Sketchfab llama
   a sus materiales como quiere y buscar "baseballCap" reventaba con otro
   modelo. */
const mat = gltf.materials.find((m) => m.normalTexture);
const imagen = gltf.images[gltf.textures[mat.normalTexture.index].source];
const vistaImg = gltf.bufferViews[imagen.bufferView];
const iniImg = inicioBin + (vistaImg.byteOffset ?? 0);
const jpg = await sharp(bruto.subarray(iniImg, iniImg + vistaImg.byteLength))
	.resize(1024, 1024)
	.jpeg({ quality: 92 })
	.toBuffer();
writeFileSync(path.join(path.dirname(salida), "gorra-normal.jpg"), jpg);

console.log(`origen     : ${(bruto.length / 1048576).toFixed(1)} MB`);
console.log(`normales   : gorra-normal.jpg  ${(jpg.length / 1024).toFixed(0)} KB (escala ${relieveDelMaterial.toFixed(2)})`);
console.log(`descartados: ${descartados} tris de las correas`);
for (const [n, m] of mallas)
	console.log(`  ${n.padEnd(7)} ${String(m.idx.length / 3).padStart(6)} tris · ${String(m.pos.length / 3).padStart(6)} vértices`);
console.log(`escala     : ×${escala.toFixed(5)} · ${(ANCHO_CM / ANCHO).toFixed(2)} cm por unidad`);
console.log(`panel      : u ${json.scenes[0].extras.panel.u0.toFixed(3)}–${json.scenes[0].extras.panel.u1.toFixed(3)} · v ${json.scenes[0].extras.panel.v0.toFixed(3)}–${json.scenes[0].extras.panel.v1.toFixed(3)}`);
console.log(`salida     : public/modelos/gorra.glb  ${(glb.length / 1024).toFixed(0)} KB`);
