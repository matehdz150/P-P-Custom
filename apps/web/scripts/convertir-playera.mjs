/**
 * Convierte el OBJ de la playera al binario que carga el editor.
 *
 * POR QUÉ NO SE CARGA EL OBJ DIRECTAMENTE. Son 786 KB de texto que habría que
 * parsear en el móvil del comprador en cada visita. Esto lo deja en un GLB
 * indexado que el navegador sube a la GPU tal cual.
 *
 * POR QUÉ SE TIRAN LAS UV DEL MODELO. El atlas del OBJ es el patrón de
 * costura —frente a la derecha, espalda a la izquierda, mangas solapadas—, y
 * aprovecharlo obligaría a rehacer entera la colocación del arte. Se generan
 * por PROYECCIÓN PLANA, con la misma fórmula que ya usaba la geometría
 * procedural, y así el teñido, los anclajes de manga y las dos texturas por
 * lado siguen funcionando sin tocarse.
 *
 *   node apps/web/scripts/convertir-playera.mjs <archivo.obj>
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ANCHO = 1.2;
const ALTO = (1.2 * 1984) / 2144;
/** La etiqueta de composición: ocho caras con UV fuera de rango. No se usa. */
const DESCARTAR = /Patch/i;

const entrada = process.argv[2];
if (!entrada) {
	console.error("falta el .obj");
	process.exit(1);
}

const v = [];
const vn = [];
const tris = [];
let material = "";

for (const linea of readFileSync(entrada, "utf8").split("\n")) {
	if (linea.startsWith("v ")) {
		const [, a, b, c] = linea.split(/\s+/);
		v.push([+a, +b, +c]);
	} else if (linea.startsWith("vn ")) {
		const [, a, b, c] = linea.split(/\s+/);
		vn.push([+a, +b, +c]);
	} else if (linea.startsWith("usemtl")) {
		material = linea.split(/\s+/)[1] ?? "";
	} else if (linea.startsWith("f ")) {
		if (DESCARTAR.test(material)) continue;
		const cara = linea
			.trim()
			.split(/\s+/)
			.slice(1)
			.map((t) => {
				const p = t.split("/");
				return { v: +p[0] - 1, n: p[2] ? +p[2] - 1 : -1 };
			});
		// Los quads se parten en abanico; el modelo trae 5095 quads y 2 tris.
		for (let k = 1; k < cara.length - 1; k++)
			tris.push([cara[0], cara[k], cara[k + 1]]);
	}
}

// Centrar y llevar a la escala del editor: el OBJ viene a altura de avatar.
let minX = 1e18, maxX = -1e18, minY = 1e18, maxY = -1e18, minZ = 1e18, maxZ = -1e18;
for (const [x, y, z] of v) {
	if (x < minX) minX = x; if (x > maxX) maxX = x;
	if (y < minY) minY = y; if (y > maxY) maxY = y;
	if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
}
const escala = ANCHO / (maxX - minX);
const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
const P = v.map(([x, y, z]) => [
	(x - cx) * escala,
	(y - cy) * escala,
	(z - cz) * escala,
]);

/* LAS MANGAS SON SU PROPIA MALLA, y esto es lo que arregla el estampado de
   manga.

   El cuerpo se proyecta en Z —de frente— y eso funciona en pecho y espalda.
   En la manga no: su cara exterior mira hacia el COSTADO (±X), o sea casi
   paralela al eje de proyección, así que en UV se aplasta hasta desaparecer y
   el dibujo sale embarrado a lo largo del costado en vez de asentarse en la
   manga. Se veía en la captura: la manga en blanco y el arte estirado por el
   torso.

   Así que la manga se proyecta en X, de perfil, que es exactamente cómo se
   mira un estampado de manga.

   El corte va por POSICIÓN y no por normal: el cuerpo llega hasta |x| ≈ 0.30
   —ahí tiene su costura de costado, que también mira a ±X— y la manga empieza
   justo después. Medido sobre la malla, franja a franja. */
const UMBRAL_MANGA = 0.31;

/* Dentro del cuerpo el corte frente/espalda SÍ va por la normal del
   TRIÁNGULO: un vértice del costado pertenece a las dos caras y por posición
   caería en una franja indecisa. */
const grupos = {
	frente: [], espalda: [],
	mangaIzqFuera: [], mangaIzqDentro: [],
	mangaDerFuera: [], mangaDerDentro: [],
};

/* Cuándo un triángulo del cuerpo está lo bastante de frente como para que la
   proyección plana lo texturice bien.

   NO se usa para apartar caras —eso se intentó y salió peor: el umbral atrapa
   también los PLIEGUES del pecho, así que un diseño grande aparecía con
   grietas blancas donde la tela se dobla—. Se usa sólo para MEDIR hasta dónde
   llega la zona de confianza, y ahí es donde se recorta el arte. */
const UMBRAL_PLANO = 0.45;

/* Primero se separan las mangas del cuerpo; el reparto fuera/dentro necesita
   conocer antes el eje de cada manga, así que va en dos pasadas. */
const mangaCruda = { Izq: [], Der: [] };
for (const t of tris) {
	const cx = t.reduce((s, i) => s + P[i.v][0], 0) / 3;
	if (cx > UMBRAL_MANGA) mangaCruda.Izq.push(t);
	else if (cx < -UMBRAL_MANGA) mangaCruda.Der.push(t);
	else {
		const nz = t.reduce((s, i) => s + (vn[i.n]?.[2] ?? 0), 0) / 3;
		grupos[nz >= 0 ? "frente" : "espalda"].push(t);
	}
}

/**
 * Eje de la manga, por mínimos cuadrados: x = a·y + b.
 *
 * POR POSICIÓN Y NO POR NORMAL, que fue el primer intento y salió cortado. Una
 * manga CUELGA: por debajo de su línea más ancha la tela ya curva hacia el
 * brazo, así que su normal apunta hacia dentro aunque esa zona se siga viendo
 * de perfil. Repartiendo por la normal, media manga visible se iba al forro y
 * el estampado aparecía partido por la mitad.
 *
 * El eje se inclina con la manga —baja a la vez que se abre—, de ahí el ajuste
 * contra `y` en vez de una vertical fija.
 */
function ejeDe(lista) {
	let sy = 0, sx = 0, syy = 0, sxy = 0, n = 0;
	for (const t of lista)
		for (const { v: iv } of t) {
			const [x, y] = P[iv];
			sy += y; sx += x; syy += y * y; sxy += x * y; n++;
		}
	const den = n * syy - sy * sy;
	const a = den === 0 ? 0 : (n * sxy - sy * sx) / den;
	return { a, b: (sx - a * sy) / n };
}

for (const lado of ["Izq", "Der"]) {
	const eje = ejeDe(mangaCruda[lado]);
	for (const t of mangaCruda[lado]) {
		const cx = t.reduce((s, i) => s + P[i.v][0], 0) / 3;
		const cy = t.reduce((s, i) => s + P[i.v][1], 0) / 3;
		const afuera = cx - (eje.a * cy + eje.b);
		/* La mitad que da al exterior: para la manga izquierda es la de x mayor
		   que el eje; para la derecha, al revés. Sólo esa lleva el arte. */
		const fuera = lado === "Izq" ? afuera >= 0 : afuera <= 0;
		grupos[`manga${lado}${fuera ? "Fuera" : "Dentro"}`].push(t);
	}
}

/**
 * Caja de una lista de triángulos, para normalizar la UV de cada manga a su
 * propio tamaño en vez de a la prenda entera.
 *
 * POR PERCENTILES Y NO POR MÍNIMO Y MÁXIMO. El vuelo del bajo cruza el umbral
 * de |x| en un puñado de vértices —unos veinte de dos mil—, y con el extremo
 * crudo esa falda estiraba la caja de una manga de 33 a 46 cm de alto. La UV
 * se normaliza contra la caja, así que el estampado salía a la mitad de
 * tamaño y descolgado. Recortando el 2 % de cada punta la caja vuelve a ser
 * la manga y esos triángulos sueltos se quedan con UV fuera de rango, que en
 * el borde de la textura es el color de la prenda: invisible.
 */
function caja(lista) {
	const ys = [], zs = [];
	for (const t of lista)
		for (const { v: iv } of t) {
			ys.push(P[iv][1]);
			zs.push(P[iv][2]);
		}
	ys.sort((a, b) => a - b);
	zs.sort((a, b) => a - b);
	const p = (arr, q) => arr[Math.min(arr.length - 1, Math.floor(arr.length * q))];
	return {
		minY: p(ys, 0.02), maxY: p(ys, 0.98),
		minZ: p(zs, 0.02), maxZ: p(zs, 0.98),
	};
}

const cajaIzq = caja(grupos.mangaIzqFuera);
const cajaDer = caja(grupos.mangaDerFuera);

/**
 * Una malla por región, sólo con los vértices que usa.
 *
 * `uvDe` cambia según la región: el cuerpo proyecta en Z y la manga en X.
 */
function malla(lista, uvDe) {
	const mapa = new Map();
	const pos = [], nor = [], uv = [], idx = [];
	for (const t of lista) {
		for (const { v: iv, n: inn } of t) {
			const clave = `${iv}/${inn}`;
			let i = mapa.get(clave);
			if (i === undefined) {
				i = mapa.size;
				mapa.set(clave, i);
				const [x, y, z] = P[iv];
				const n = vn[inn] ?? [0, 0, 1];
				pos.push(x, y, z);
				nor.push(n[0], n[1], n[2]);
				uv.push(...uvDe(x, y, z));
			}
			idx.push(i);
		}
	}
	return { pos, nor, uv, idx };
}

/* La MISMA fórmula que la geometría procedural para el cuerpo, para no mover
   el arte de pecho y espalda ni un píxel. */
const uvFrente = (x, y) => [0.5 + x / ANCHO, 0.5 + y / ALTO];
const uvEspalda = (x, y) => [0.5 - x / ANCHO, 0.5 + y / ALTO];

/* De perfil, y cada manga con el sentido de SU lado.
   Mirando la manga izquierda desde +X, la derecha de la pantalla es −Z; desde
   −X es +Z. Sin ese cambio de signo el estampado saldría espejado en una de
   las dos y el texto se leería al revés. */
const uvManga = (c, signo) => (_x, y, z) => [
	0.5 + (signo * (z - (c.minZ + c.maxZ) / 2)) / (c.maxZ - c.minZ),
	(y - c.minY) / (c.maxY - c.minY),
];

const mallas = [
	["frente", malla(grupos.frente, uvFrente)],
	["espalda", malla(grupos.espalda, uvEspalda)],
	["mangaIzqFuera", malla(grupos.mangaIzqFuera, uvManga(cajaIzq, -1))],
	["mangaDerFuera", malla(grupos.mangaDerFuera, uvManga(cajaDer, +1))],
	/* Las caras de dentro no llevan arte: su UV da igual, pero tienen que
	   existir o la manga se vería hueca por debajo. */
	["mangaIzqDentro", malla(grupos.mangaIzqDentro, uvManga(cajaIzq, -1))],
	["mangaDerDentro", malla(grupos.mangaDerDentro, uvManga(cajaDer, +1))],
];

// ---- GLB -------------------------------------------------------------------
const buffers = [];
let offset = 0;
const vistas = [], accesos = [];

function guardar(datos, tipo, componente, cuenta, objetivo) {
	const bytes = Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength);
	const relleno = (4 - (bytes.length % 4)) % 4;
	buffers.push(bytes, Buffer.alloc(relleno));
	const vista = vistas.length;
	vistas.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, ...(objetivo ? { target: objetivo } : {}) });
	offset += bytes.length + relleno;
	const acc = accesos.length;
	const min = [], max = [];
	if (tipo === "VEC3") {
		for (let c = 0; c < 3; c++) {
			let a = 1e18, b = -1e18;
			for (let i = c; i < datos.length; i += 3) { if (datos[i] < a) a = datos[i]; if (datos[i] > b) b = datos[i]; }
			min.push(a); max.push(b);
		}
	}
	accesos.push({ bufferView: vista, componentType: componente, count: cuenta, type: tipo, ...(min.length ? { min, max } : {}) });
	return acc;
}

const primitivas = mallas.map(([nombre, m]) => ({
	nombre,
	prim: {
		attributes: {
			POSITION: guardar(new Float32Array(m.pos), "VEC3", 5126, m.pos.length / 3, 34962),
			NORMAL: guardar(new Float32Array(m.nor), "VEC3", 5126, m.nor.length / 3, 34962),
			TEXCOORD_0: guardar(new Float32Array(m.uv), "VEC2", 5126, m.uv.length / 2, 34962),
		},
		indices: guardar(new Uint32Array(m.idx), "SCALAR", 5125, m.idx.length, 34963),
	},
}));

const bin = Buffer.concat(buffers);
const json = {
	asset: { version: "2.0", generator: "kustto convertir-playera" },
	scene: 0,
	scenes: [{ nodes: primitivas.map((_, i) => i) }],
	nodes: primitivas.map((p, i) => ({ mesh: i, name: p.nombre })),
	meshes: primitivas.map((p) => ({ name: p.nombre, primitives: [p.prim] })),
	accessors: accesos,
	bufferViews: vistas,
	buffers: [{ byteLength: bin.length }],
};

/* Lo que el editor necesita para dimensionar el estampado de manga EN
   CENTÍMETROS en vez de a ojo: cuánto mide una unidad del modelo y qué trozo
   de mundo abarca la textura de cada manga. Viaja en el GLB y no como
   constantes en el código para que cambiar de modelo no obligue a recalibrar
   a mano. */
/* Hasta dónde llega la parte del cuerpo que SÍ está bien texturizada, en
   coordenadas del lienzo. Fuera de esto el arte no se dibuja: ahí la
   superficie ya gira y sólo produciría la cuña de color estirada. */
const usCuerpo = [];
for (const t of grupos.frente) {
	const nz = t.reduce((s, i) => s + (vn[i.n]?.[2] ?? 0), 0) / 3;
	if (Math.abs(nz) < UMBRAL_PLANO) continue;
	for (const { v: iv } of t) usCuerpo.push(uvFrente(P[iv][0], P[iv][1])[0]);
}
usCuerpo.sort((a, b) => a - b);
const pc = (q) => usCuerpo[Math.floor((usCuerpo.length - 1) * q)];

json.scenes[0].extras = {
	cmPorUnidad: 0.1 / escala,
	cuerpo: { u0: pc(0.02), u1: pc(0.98) },
	mangas: {
		mangaIzqFuera: {
			anchoU: cajaIzq.maxZ - cajaIzq.minZ,
			altoU: cajaIzq.maxY - cajaIzq.minY,
		},
		mangaDerFuera: {
			anchoU: cajaDer.maxZ - cajaDer.minZ,
			altoU: cajaDer.maxY - cajaDer.minY,
		},
	},
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

const salida = path.join(process.cwd(), "apps/web/public/modelos/playera.glb");
mkdirSync(path.dirname(salida), { recursive: true });
writeFileSync(salida, glb);

console.log(`triángulos : ${tris.length}`);
for (const [n, m] of mallas) console.log(`  ${n.padEnd(8)} ${(m.idx.length / 3).toString().padStart(5)} tris · ${(m.pos.length / 3).toString().padStart(5)} vértices`);
console.log(`escala     : ×${escala.toFixed(6)}  (ancho ${ANCHO}, alto resultante ${((maxY - minY) * escala).toFixed(3)} vs PLAYERA.alto ${ALTO.toFixed(3)})`);
console.log(`salida     : public/modelos/playera.glb  ${(glb.length / 1024).toFixed(0)} KB`);
