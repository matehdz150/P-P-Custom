/**
 * Compila el worker de bordado a `public/` antes de construir el sitio.
 *
 * POR QUÉ NO SE DEJA QUE LO EMPAQUETE NEXT. Con `new Worker(new URL("./x.ts",
 * import.meta.url))` y `output: "export"`, Next NO compila el archivo: lo copia
 * como asset estático y deja la URL apuntando al `.ts` crudo. En producción eso
 * es peor que un error de compilación, porque el build pasa: S3 sirve el
 * TypeScript tal cual —con `content-type: video/mp2t`, porque `.ts` también es
 * MPEG transport stream— y `new Worker()` revienta al primer clic. El panel
 * parecía funcionar en el editor y no hacía nada.
 *
 * Es el mismo camino que ya siguió el WASM de VTracer, por la misma razón: lo
 * que el bundler no sabe tratar se compila aparte y se sirve como un archivo
 * más.
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(aqui, "..");
const raiz = path.resolve(web, "../..");
const salida = path.join(web, "public/bordado/bordado.worker.js");

await mkdir(path.dirname(salida), { recursive: true });

/** Resuelve `@/...` y el paquete del workspace sin arrastrar la app entera. */
const rutas = {
	name: "rutas",
	setup(build) {
		build.onResolve({ filter: /^@kustto\/bordado$/ }, () => ({
			path: path.join(raiz, "packages/bordado/src/index.ts"),
		}));
		build.onResolve({ filter: /^@\// }, (args) => {
			const base = path.join(web, args.path.slice(2));
			for (const sufijo of [".ts", ".tsx", "/index.ts", ""]) {
				if (existsSync(base + sufijo)) return { path: base + sufijo };
			}
			return { path: base };
		});
	},
};

await esbuild.build({
	entryPoints: [path.join(web, "lib/bordado/bordado.worker.ts")],
	outfile: salida,
	bundle: true,
	minify: true,
	// Clásico, no módulo: no necesita imports en tiempo de ejecución y así el
	// `new Worker()` no depende del soporte de módulos en workers.
	format: "iife",
	target: "es2022",
	plugins: [rutas],
	logLevel: "warning",
});

console.log(`worker de bordado -> ${path.relative(raiz, salida)}`);
