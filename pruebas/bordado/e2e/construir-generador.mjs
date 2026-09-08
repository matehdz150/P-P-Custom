/**
 * Empaqueta un generador de diseños que corre DENTRO del navegador.
 *
 * POR QUÉ NO EN NODE. `preparar()` rasteriza texto y vectores con
 * `OffscreenCanvas`, que en node no existe. Se podría fingir con sharp, pero
 * entonces los diseños del E2E saldrían de un camino que ningún comprador
 * recorre nunca. Generándolos en Chrome son EXACTAMENTE los que produciría el
 * editor, incluido cómo el motor de canvas del navegador rasteriza una curva.
 *
 * Las imágenes del corpus se incrustan como data URI en tiempo de compilación
 * para que la página no necesite servidor de archivos ni permisos de red.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "../../..");
const corpus = path.join(aqui, "../regresion/corpus");
const salida = path.join(aqui, "publico");
await mkdir(salida, { recursive: true });

const IMAGENES = [
	"logo-bn-simple.png",
	"logo-multicolor.png",
	"real-01-logo-color-alpha.png",
	"ilustracion-media.png",
	"real-07-retrato.jpg",
	"ambiguo-posterizada-8.png",
];

const datos = {};
for (const nombre of IMAGENES) {
	const buffer = await readFile(path.join(corpus, nombre));
	const tipo = nombre.endsWith(".jpg") ? "image/jpeg" : "image/png";
	datos[nombre] = `data:${tipo};base64,${buffer.toString("base64")}`;
}

const alias = {
	"@": path.join(raiz, "apps/web"),
	"@kustto/bordado": path.join(raiz, "packages/bordado/src/index.ts"),
};
const rutas = {
	name: "rutas",
	setup(build) {
		build.onResolve({ filter: /^@kustto\/bordado$/ }, () => ({
			path: alias["@kustto/bordado"],
		}));
		build.onResolve({ filter: /^@\// }, (args) => {
			const base = path.join(alias["@"], args.path.slice(2));
			for (const sufijo of [".ts", ".tsx", "/index.ts", ""]) {
				if (existsSync(base + sufijo)) return { path: base + sufijo };
			}
			return { path: base };
		});
	},
};

await esbuild.build({
	entryPoints: [path.join(aqui, "generador.ts")],
	outfile: path.join(salida, "generador.js"),
	bundle: true,
	format: "iife",
	target: "es2022",
	plugins: [rutas],
	define: { __IMAGENES__: JSON.stringify(datos) },
	logLevel: "warning",
});

await writeFile(
	path.join(salida, "index.html"),
	`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Generador E2E</title></head>
<body><p id="estado">generando...</p><script src="./generador.js"></script></body></html>`,
);

console.log("generador empaquetado en", salida);
