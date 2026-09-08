import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { vectorizarAdaptativo, vectorizarBaselineActual } from "./vectorizador-adaptativo.mjs";

const fixtures = path.join(import.meta.dirname, "fixtures");
const salidas = path.join(import.meta.dirname, "salidas");
const salidasBaseline = path.join(import.meta.dirname, "salidas-baseline");
await mkdir(salidas, { recursive: true });
await mkdir(salidasBaseline, { recursive: true });
const manifiesto = JSON.parse(await readFile(path.join(fixtures, "manifest.json"), "utf8"));
const resultados = [];

for (const caso of manifiesto) {
  process.stdout.write(`${caso.archivo} ... `);
  try {
    const resultado = await vectorizarAdaptativo(path.join(fixtures, caso.archivo));
    const baseline = await vectorizarBaselineActual(path.join(fixtures, caso.archivo), caso.esperado);
    const seleccionado = resultado.candidatos.find((c) => c.nombre === resultado.seleccionado);
    const base = path.basename(caso.archivo, path.extname(caso.archivo));
    await writeFile(path.join(salidas, `${base}.svg`), seleccionado.svg);
    await sharp(Buffer.from(seleccionado.svg)).flatten({ background: "#ffffff" }).png().toFile(path.join(salidas, `${base}.png`));
    await writeFile(path.join(salidasBaseline, `${base}.svg`), baseline.svg);
    await sharp(Buffer.from(baseline.svg)).flatten({ background: "#ffffff" }).png().toFile(path.join(salidasBaseline, `${base}.png`));
    resultados.push({
      caso: caso.archivo,
      descripcion: caso.descripcion,
      esperado: caso.esperado,
      clasificado: resultado.clasificacion.clase,
      clasificacionCorrecta: caso.esperado === resultado.clasificacion.clase,
      confianzaClasificacion: resultado.clasificacion.confianza,
      ambiguo: resultado.clasificacion.ambigua,
      scoresClase: resultado.clasificacion.scores,
      metricas: resultado.metricas,
      dimensionesVector: resultado.dimensionesVector,
      seleccionado: resultado.seleccionado,
      score: resultado.score,
      confianza: resultado.confianza,
      candidatos: resultado.candidatos.map(({ nombre, validacion, evaluacion, milisegundos }) => ({
        nombre, validacion, evaluacion, milisegundos,
      })),
      baselineActual: {
        perfil: baseline.clasificacion.perfil,
        senales: baseline.clasificacion,
        dimensionesVector: baseline.dimensionesVector,
        validacion: baseline.validacion,
        evaluacion: baseline.evaluacion,
        milisegundos: baseline.milisegundos,
      },
    });
    console.log(`${resultado.clasificacion.clase} / ${resultado.seleccionado} / ${resultado.score}`);
  } catch (error) {
    resultados.push({ caso: caso.archivo, descripcion: caso.descripcion, esperado: caso.esperado, error: String(error?.stack ?? error) });
    console.log(`ERROR: ${error.message}`);
  }
}

const exitosos = resultados.filter((r) => !r.error);
const resumen = {
  fecha: new Date().toISOString(),
  motor: "vtracer-wasm 0.1.0 vendorizado; ejecución Node del mismo WASM usado en browser",
  fixtures: resultados.length,
  ejecutados: exitosos.length,
  clasificacionesCorrectas: exitosos.filter((r) => r.clasificacionCorrecta).length,
  svgValidos: exitosos.filter((r) => r.candidatos.find((c) => c.nombre === r.seleccionado)?.validacion.valida).length,
  scorePromedio: Number((exitosos.reduce((s, r) => s + r.score, 0) / Math.max(1, exitosos.length)).toFixed(2)),
  confianzaPromedio: Number((exitosos.reduce((s, r) => s + r.confianza, 0) / Math.max(1, exitosos.length)).toFixed(3)),
  scorePromedioBaseline: Number((exitosos.reduce((s, r) => s + (r.baselineActual?.evaluacion.score ?? 0), 0) / Math.max(1, exitosos.length)).toFixed(2)),
  resultados,
};
await writeFile(path.join(import.meta.dirname, "resultados.json"), `${JSON.stringify(resumen, null, 2)}\n`);

console.log(`\n${resumen.ejecutados}/${resumen.fixtures} ejecutados; ${resumen.clasificacionesCorrectas}/${resumen.ejecutados} clases; ${resumen.svgValidos}/${resumen.ejecutados} SVG válidos; score ${resumen.scorePromedio}`);
