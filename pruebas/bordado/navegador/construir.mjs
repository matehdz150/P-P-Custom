/**
 * Empaqueta el worker de bordado y una página que lo pone a prueba de verdad.
 *
 * POR QUÉ NO BASTA EL BANCO DE NODE. En node el pipeline termina, y eso es todo
 * lo que demuestra: que termina. Lo que hay que probar aquí es otra cosa —que
 * mientras termina, el hilo principal SIGUE VIVO— y eso sólo se puede ver en un
 * navegador de verdad, contando fotogramas. Es exactamente la trampa contra la
 * que avisa CLAUDE.md: una captura no compone los fotogramas intermedios.
 *
 * La página no es la aplicación: es el worker real con el pipeline real y un
 * medidor de fotogramas al lado. Prueba el mecanismo, no el editor entero.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "../../..");
const salida = path.join(aqui, "publico");
await mkdir(salida, { recursive: true });

const alias = {
	"@": path.join(raiz, "apps/web"),
	"@kustto/bordado": path.join(raiz, "packages/bordado/src/index.ts"),
};

/** Resuelve `@/...` y el paquete del workspace sin arrastrar todo Next. */
const rutas = {
	name: "rutas",
	setup(build) {
		build.onResolve({ filter: /^@kustto\/bordado$/ }, () => ({
			path: alias["@kustto/bordado"],
		}));
		build.onResolve({ filter: /^@\// }, (args) => {
			// esbuild no adivina la extensión de una ruta absoluta: hay que darla.
			const base = path.join(alias["@"], args.path.slice(2));
			for (const sufijo of [".ts", ".tsx", "/index.ts", ""]) {
				if (existsSync(base + sufijo)) return { path: base + sufijo };
			}
			return { path: base };
		});
	},
};

await esbuild.build({
	entryPoints: [path.join(raiz, "apps/web/lib/bordado/bordado.worker.ts")],
	outfile: path.join(salida, "bordado.worker.js"),
	bundle: true,
	format: "iife",
	target: "es2022",
	plugins: [rutas],
	logLevel: "warning",
});

await writeFile(
	path.join(salida, "index.html"),
	await readFile(path.join(aqui, "pagina.html"), "utf8"),
);

console.log("empaquetado en", salida);
