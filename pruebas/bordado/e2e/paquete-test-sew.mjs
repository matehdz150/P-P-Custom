/**
 * Arma el paquete que se le manda al taller.
 *
 * TODO SALE DE LOS ARTEFACTOS REALES. El DST, la vista previa y el metadata son
 * los que produjo el worker en AWS; las instrucciones se escriben leyendo el
 * diseño y el metadata, y lo que no esté ahí se deja en blanco con un "no
 * disponible" explícito. Inventar una densidad o una tensión para que la ficha
 * quede bonita sería justo lo que arruina un test sew: el taller ajustaría la
 * máquina a un número que nadie midió.
 */

import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const artefactos = path.join(aqui, "artefactos");
const disenos = path.join(aqui, "disenos");
const destino = path.join(aqui, "../test-sew");

const NOMBRES = {
	"01-texto-simple": "Texto grande en satin",
	"08-texto-variante": "Texto cerca del limite minimo",
	"02-logo-monocromo": "Logo monocromo",
	"03-logo-multicolor": "Logo multicolor",
	"05-ilustracion": "Ilustracion (revision)",
	"04-discovery": "Logo complejo (Discovery)",
};

const nd = "no disponible";

function mm(valor) {
	return typeof valor === "number" ? `${valor.toFixed(2)} mm` : nd;
}

function ficha(caso, design, meta, dst) {
	const objetos = design.objects ?? [];
	const porTipo = {};
	for (const objeto of objetos) {
		const t = objeto.stitch.type;
		porTipo[t] = (porTipo[t] ?? 0) + 1;
	}
	const anchoSatin = objetos
		.filter((o) => o.stitch.type === "satin" && o.stitch.strokeWidthMm)
		.map((o) => o.stitch.strokeWidthMm);
	const espaciados = [
		...new Set(objetos.map((o) => o.stitch.spacingMm).filter(Boolean)),
	];
	const compensaciones = [
		...new Set(objetos.map((o) => o.stitch.pullCompensationMm).filter(Boolean)),
	];
	const conUnderlay = objetos.filter((o) => o.stitch.underlay === true).length;
	const metricas = meta?.metrics ?? {};
	const prep = design.preparation ?? {};

	const hilos = (design.colors ?? [])
		.map(
			(color, i) =>
				`| ${i + 1} | \`${color.sourceHex}\` | ${objetos.filter((o) => o.colorId === color.id).length} |`,
		)
		.join("\n");

	return `# ${NOMBRES[caso] ?? caso}

Caso \`${caso}\`. Generado automaticamente a partir de los artefactos reales del
trabajo en AWS. **Los valores en blanco son valores que el sistema no produce
todavia**; no se han rellenado a ojo.

## Medidas

| | |
|---|---|
| Area del lado | ${mm(design.physical?.widthMm)} x ${mm(design.physical?.heightMm)} |
| Diseno (caja) | ${mm(design.bounds?.widthMm)} x ${mm(design.bounds?.heightMm)} |
| Medido en el DST | ${dst ? `${dst.anchoMm} mm x ${dst.altoMm} mm` : nd} |
| Puntadas (metadata) | ${metricas.stitchCount ?? nd} |
| Puntadas (leidas del DST) | ${dst?.puntadas ?? nd} |
| Saltos / cortes | ${metricas.jumps ?? nd} / ${metricas.trims ?? nd} |

## Hilos, en orden de bordado

| # | Color de origen | Objetos |
|---|---|---|
${hilos || "| - | - | - |"}

> Los colores son los del diseno del comprador, no referencias de un catalogo
> comercial de hilos: **la equivalencia la elige el taller**.

## Puntadas

| tipo | objetos |
|---|---|
| satin | ${porTipo.satin ?? 0} |
| running | ${porTipo.running ?? 0} |
| relleno | ${porTipo.fill ?? 0} |

- Ancho de columna satin: ${anchoSatin.length ? `${Math.min(...anchoSatin).toFixed(2)}–${Math.max(...anchoSatin).toFixed(2)} mm` : nd}
- Separacion (density): ${espaciados.length ? `${espaciados.map((v) => `${v} mm`).join(", ")}` : nd}
- Compensacion de tiro (pull compensation): ${compensaciones.length ? compensaciones.map((v) => `${v} mm`).join(", ") : nd}
- Underlay: ${conUnderlay} de ${objetos.length} objetos
- Longitud maxima de puntada: ${[...new Set(objetos.map((o) => o.stitch.maxStitchLengthMm).filter(Boolean))].map((v) => `${v} mm`).join(", ") || nd}

## Origen

| | |
|---|---|
| Tipo de fuente | ${[...new Set(objetos.map((o) => o.sourceType))].join(", ") || nd} |
| Clasificacion | ${[...new Set(objetos.map((o) => o.classification))].join(", ") || nd} |
| Tipografia y tamano | ${objetos.some((o) => o.sourceType === "text") ? "geometria de prueba, no una tipografia comercial" : "no aplica"} |
| Colores del original | ${prep.raster?.sourceColorCount ?? nd} |
| Colores tras reducir | ${prep.raster?.reducedColorCount ?? nd} |
| Perdida al cuantizar | ${prep.raster ? `${prep.raster.quantizationDeltaE} dE medio` : nd} |
| Regiones eliminadas | ${prep.raster ? `${prep.raster.removedRegions} (${prep.raster.removedAreaMm2} mm2)` : nd} |
| Avisos | ${(prep.issues ?? []).map((i) => i.code).join(", ") || "ninguno"} |

## Versiones

| | |
|---|---|
| profileVersion | \`${design.profileVersion}\` |
| engineVersion | \`${design.engineVersion}\` |
| schemaVersion | ${design.schemaVersion} |
| physicallyValidated | **false** |

> \`physicallyValidated: false\` significa que **ninguno** de los numeros de
> arriba se ha comprobado cosiendo. Eso es exactamente lo que viene a decidir
> esta prueba.
`;
}

async function main() {
	await mkdir(destino, { recursive: true });
	const orden = [
		"01-texto-simple",
		"08-texto-variante",
		"02-logo-monocromo",
		"03-logo-multicolor",
		"05-ilustracion",
		"04-discovery",
	];

	let informe = JSON.parse(
		await readFile(path.join(aqui, "artefactos.json"), "utf8"),
	);
	informe = Object.fromEntries(informe.map((x) => [x.caso, x]));

	const incluidos = [];
	let numero = 0;
	for (const caso of orden) {
		const datos = informe[caso];
		if (!datos) {
			console.log(`${caso}: sin artefactos, se omite`);
			continue;
		}
		numero++;
		const carpeta = path.join(destino, `caso-${String(numero).padStart(2, "0")}`);
		await mkdir(carpeta, { recursive: true });

		const origen = path.join(artefactos, caso);
		for (const archivo of await readdir(origen)) {
			await copyFile(path.join(origen, archivo), path.join(carpeta, archivo));
		}

		const design = JSON.parse(
			await readFile(path.join(disenos, `${caso}.json`), "utf8"),
		);
		await writeFile(
			path.join(carpeta, "instrucciones.md"),
			ficha(caso, design, datos.metadata, datos.dst),
		);
		incluidos.push({ carpeta: path.basename(carpeta), caso, jobId: datos.jobId });
		console.log(`${path.basename(carpeta)}: ${caso}`);
	}

	await writeFile(
		path.join(destino, "contenido.json"),
		`${JSON.stringify(incluidos, null, 2)}\n`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
