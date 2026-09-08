import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

export const NODOS_MAXIMOS = 20_000;
const PIXELES_MAXIMOS = 3_000_000;

const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const round = (v, n = 4) => Number(v.toFixed(n));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const LINEAL = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LINEAL[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const labF = (t) => t > 0.008856451679 ? Math.cbrt(t) : 7.787037 * t + 16 / 116;
const aLab = (r, g, b) => {
  const R = LINEAL[r], G = LINEAL[g], B = LINEAL[b];
  const x = labF((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
  const y = labF(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
  const z = labF((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
};
const deltaLab = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function otsu(hist, total) {
  let suma = 0;
  for (let i = 0; i < 256; i++) suma += i * hist[i];
  let sumaB = 0, pesoB = 0, mejor = -1, umbral = 127;
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    sumaB += t * hist[t];
    const entre = pesoB * pesoF * (sumaB / pesoB - (suma - sumaB) / pesoF) ** 2;
    if (entre > mejor) [mejor, umbral] = [entre, t];
  }
  return umbral;
}

function mediana(valores) {
  valores.sort((a, b) => a - b);
  return valores[valores.length >> 1] ?? 255;
}

function borde(datos, ancho, alto) {
  const grosor = Math.max(1, Math.round(Math.min(ancho, alto) * 0.025));
  const rs = [], gs = [], bs = [], alphas = [];
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    if (x >= grosor && y >= grosor && x < ancho - grosor && y < alto - grosor) continue;
    const i = (y * ancho + x) * 4;
    rs.push(datos[i]); gs.push(datos[i + 1]); bs.push(datos[i + 2]); alphas.push(datos[i + 3]);
  }
  return { rgb: [mediana(rs), mediana(gs), mediana(bs)], alphas };
}

function componentes(mask, ancho, alto, valor = 1, areaMinima = 1) {
  const vistos = new Uint8Array(mask.length);
  const areas = [];
  const cola = new Int32Array(mask.length);
  for (let inicio = 0; inicio < mask.length; inicio++) {
    if (vistos[inicio] || Number(mask[inicio]) !== valor) continue;
    let cabeza = 0, fin = 0, area = 0;
    cola[fin++] = inicio; vistos[inicio] = 1;
    while (cabeza < fin) {
      const p = cola[cabeza++], x = p % ancho, y = (p / ancho) | 0;
      area++;
      if (x && !vistos[p - 1] && Number(mask[p - 1]) === valor) { vistos[p - 1] = 1; cola[fin++] = p - 1; }
      if (x + 1 < ancho && !vistos[p + 1] && Number(mask[p + 1]) === valor) { vistos[p + 1] = 1; cola[fin++] = p + 1; }
      if (y && !vistos[p - ancho] && Number(mask[p - ancho]) === valor) { vistos[p - ancho] = 1; cola[fin++] = p - ancho; }
      if (y + 1 < alto && !vistos[p + ancho] && Number(mask[p + ancho]) === valor) { vistos[p + ancho] = 1; cola[fin++] = p + ancho; }
    }
    if (area >= areaMinima) areas.push(area);
  }
  return areas;
}

async function rawReducido(archivo, lado) {
  const meta = await sharp(archivo).metadata();
  const escala = Math.min(1, lado / Math.max(meta.width, meta.height));
  const width = Math.max(1, Math.round(meta.width * escala));
  const height = Math.max(1, Math.round(meta.height * escala));
  const { data, info } = await sharp(archivo)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { datos: new Uint8ClampedArray(data), ancho: info.width, alto: info.height };
}

function mascaraProvisional(datos, ancho, alto, alphaFuerte) {
  const n = ancho * alto;
  const gris = new Uint8Array(n);
  if (alphaFuerte) {
    for (let p = 0; p < n; p++) gris[p] = 255 - datos[p * 4 + 3];
    return gris;
  }
  const fondoLab = aLab(...borde(datos, ancho, alto).rgb);
  const distancias = new Float32Array(n);
  let maxima = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const d = deltaLab(aLab(datos[i], datos[i + 1], datos[i + 2]), fondoLab);
    distancias[p] = d; maxima = Math.max(maxima, d);
  }
  if (!maxima) return gris.fill(255);
  const hist = new Uint32Array(256);
  for (const d of distancias) hist[Math.min(255, Math.round(d / maxima * 255))]++;
  const corte = Math.max(1, otsu(hist, n)) / 255 * maxima;
  for (let p = 0; p < n; p++) gris[p] = Math.round(clamp(255 - clamp(distancias[p] / corte, 0, 2) * 128, 0, 255));
  return gris;
}

export async function analizarInput(archivo) {
  const { datos, ancho, alto } = await rawReducido(archivo, 320);
  const n = ancho * alto;
  let transparentes = 0, parciales = 0, opacos = 0;
  const colores = new Map();
  const luminancias = new Float32Array(n);
  let visibles = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4, a = datos[i + 3];
    if (a < 250) transparentes++; else opacos++;
    if (a > 5 && a < 250) parciales++;
    const af = a / 255;
    const r = datos[i] * af + 255 * (1 - af);
    const g = datos[i + 1] * af + 255 * (1 - af);
    const b = datos[i + 2] * af + 255 * (1 - af);
    luminancias[p] = luma(r, g, b);
    if (a > 16) {
      visibles++;
      const k = ((datos[i] >> 4) << 8) | ((datos[i + 1] >> 4) << 4) | (datos[i + 2] >> 4);
      colores.set(k, (colores.get(k) ?? 0) + 1);
    }
  }
  const alphaFuerte = transparentes / n > 0.02;
  const frecuencias = [...colores.values()].sort((a, b) => b - a);
  const top1 = (frecuencias[0] ?? 0) / Math.max(1, visibles);
  const top8 = frecuencias.slice(0, 8).reduce((a, b) => a + b, 0) / Math.max(1, visibles);
  let entropia = 0;
  for (const f of frecuencias) { const p = f / Math.max(1, visibles); entropia -= p * Math.log2(p); }

  let pares = 0, gradientesSuaves = 0, bordes = 0, lap = 0, interiores = 0;
  for (let y = 1; y < alto - 1; y++) for (let x = 1; x < ancho - 1; x++) {
    const p = y * ancho + x;
    const gx = -luminancias[p - ancho - 1] - 2 * luminancias[p - 1] - luminancias[p + ancho - 1]
      + luminancias[p - ancho + 1] + 2 * luminancias[p + 1] + luminancias[p + ancho + 1];
    const gy = -luminancias[p - ancho - 1] - 2 * luminancias[p - ancho] - luminancias[p - ancho + 1]
      + luminancias[p + ancho - 1] + 2 * luminancias[p + ancho] + luminancias[p + ancho + 1];
    const magnitud = Math.hypot(gx, gy);
    if (magnitud > 100) bordes++;
    lap += Math.abs(4 * luminancias[p] - luminancias[p - 1] - luminancias[p + 1] - luminancias[p - ancho] - luminancias[p + ancho]);
    interiores++;
    const d = Math.abs(luminancias[p] - luminancias[p + 1]);
    if (d > 1 && d < 24) gradientesSuaves++;
    pares++;
  }

  const marco = borde(datos, ancho, alto);
  let uniformes = 0;
  const fondoLab = aLab(...marco.rgb);
  const grosor = Math.max(1, Math.round(Math.min(ancho, alto) * 0.025));
  let muestrasBorde = 0;
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    if (x >= grosor && y >= grosor && x < ancho - grosor && y < alto - grosor) continue;
    const i = (y * ancho + x) * 4;
    if (alphaFuerte ? datos[i + 3] < 25 : deltaLab(aLab(datos[i], datos[i + 1], datos[i + 2]), fondoLab) < 8) uniformes++;
    muestrasBorde++;
  }

  const gris = mascaraProvisional(datos, ancho, alto, alphaFuerte);
  const binaria = Uint8Array.from(gris, (v) => v < 128 ? 1 : 0);
  const areas = componentes(binaria, ancho, alto, 1, 2);
  const pequenos = areas.filter((a) => a <= Math.max(6, n * 0.0002));
  const areaPequena = pequenos.reduce((a, b) => a + b, 0);

  const metricas = {
    anchoOriginal: (await sharp(archivo).metadata()).width,
    altoOriginal: (await sharp(archivo).metadata()).height,
    alpha: {
      transparente: round(transparentes / n),
      parcial: round(parciales / n),
      opaco: round(opacos / n),
      fuerte: alphaFuerte,
    },
    color: {
      top1: round(top1),
      top8: round(top8),
      entropiaBits: round(entropia),
      entropiaNormalizada: round(entropia / 12),
      bins: colores.size,
    },
    tonoContinuo: round(clamp(gradientesSuaves / Math.max(1, pares) * 3.2)),
    densidadBordes: round(clamp(bordes / Math.max(1, interiores) * 4)),
    uniformidadFondoBorde: round(uniformes / Math.max(1, muestrasBorde)),
    textura: round(clamp((lap / Math.max(1, interiores)) / 45)),
    componentes: {
      total: areas.length,
      pequenos: pequenos.length,
      fraccionAreaPequena: round(areaPequena / Math.max(1, binaria.reduce((a, b) => a + b, 0))),
    },
  };
  return metricas;
}

export function clasificar(metricas) {
  // Doce bits es el máximo teórico de los 4096 bins, pero una foto real a
  // 320 px rara vez los ocupa uniformemente. Para evidencia de clase se usa
  // la entropía efectiva sobre seis bits; la métrica cruda sigue reportándose.
  const e = clamp(metricas.color.entropiaBits / 6);
  const plano = metricas.color.top8;
  const tono = metricas.tonoContinuo;
  const textura = metricas.textura;
  const borde = metricas.densidadBordes;
  const fondo = metricas.uniformidadFondoBorde;
  const comps = metricas.componentes.total;
  const pocosComponentes = 1 - clamp((comps - 1) / 20);
  const geometriaPlana = pocosComponentes * (1 - borde) * (1 - textura) * clamp((1 - e) * 1.5);
  const complejidadMedia = 1 - clamp(Math.abs(comps - 18) / 25);

  const scores = {
    "logo-line-art": 0.30 * plano + 0.20 * fondo + 0.19 * (1 - tono) + 0.14 * (1 - textura) + 0.17 * borde,
    "icono-geometrico": 0.29 * plano + 0.20 * fondo + 0.18 * (1 - tono) + 0.14 * (1 - textura) + 0.19 * geometriaPlana,
    ilustracion: 0.20 * (1 - Math.abs(e - 0.48)) + 0.18 * (1 - Math.abs(plano - 0.76)) + 0.22 * borde + 0.16 * fondo + 0.14 * complejidadMedia + 0.10 * (1 - textura * 0.5),
    fotografia: 0.30 * e + 0.38 * tono + 0.17 * textura + 0.15 * (1 - plano),
  };

  // Las formas grandes y planas son la única separación adicional entre un
  // icono y un logo: alpha por sí solo no da ningún punto de clase.
  if (comps <= 5 && plano > 0.9 && metricas.color.entropiaBits < 1.5 && borde < 0.28 && textura < 0.18) scores["icono-geometrico"] += 0.10;
  if (comps >= 6) scores["logo-line-art"] += Math.min(0.08, Math.log2(comps) / 80);
  // Entropía y gradientes juntos son evidencia de tono real. Esta interacción
  // evita que una foto recortada se vuelva icono por tener un solo componente.
  scores["logo-line-art"] -= 0.45 * tono * e;
  scores["icono-geometrico"] -= 0.50 * tono * e;
  scores.fotografia += 0.30 * tono * e;
  scores.ilustracion -= 0.30 * tono * e;
  scores["logo-line-art"] += 0.22 * borde * (1 - tono);
  // Ilustración por regiones: varios colores planos, componentes moderados y
  // poca continuidad tonal. Ninguna de estas señales basta por separado.
  if (plano >= 0.90 && plano <= 0.97 && metricas.color.entropiaBits >= 1.5 && metricas.color.entropiaBits <= 3 && tono < 0.40 && borde > 0.25) {
    scores.ilustracion += 0.22;
  } else if (comps >= 6 && comps <= 60 && plano >= 0.60 && plano <= 0.97 && metricas.color.entropiaBits >= 1.5 && tono < 0.55) {
    scores.ilustracion += 0.18;
  }
  if (tono > 0.65 && metricas.color.entropiaBits > 2.4 && plano < 0.90) scores.fotografia += 0.12;

  const orden = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const margen = orden[0][1] - orden[1][1];
  return {
    clase: orden[0][0],
    confianza: round(clamp(0.45 + margen * 2.8)),
    ambigua: margen < 0.09,
    scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, round(v)])),
    margen: round(margen),
  };
}

let motor;
async function cargarVTracer() {
  if (motor) return motor;
  const vendor = path.resolve(import.meta.dirname, "../../apps/web/public/vendor/vtracer");
  const modulo = await import(pathToFileURL(path.join(vendor, "vtracer.js")));
  const bytes = await readFile(path.join(vendor, "vtracer.wasm"));
  modulo.initSync({ module: bytes });
  motor = modulo;
  return motor;
}

async function rawObjetivo(archivo, clase) {
  const meta = await sharp(archivo).metadata();
  const lado = clase === "fotografia" ? 720 : clase === "ilustracion" ? 1000 : 1400;
  let escala = lado / Math.max(meta.width, meta.height);
  if (clase !== "logo-line-art") escala = Math.min(1, escala);
  escala = Math.min(3, escala, Math.sqrt(PIXELES_MAXIMOS / (meta.width * meta.height)));
  const ancho = Math.max(1, Math.round(meta.width * escala));
  const alto = Math.max(1, Math.round(meta.height * escala));
  const { data } = await sharp(archivo)
    .resize(ancho, alto, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { datos: new Uint8ClampedArray(data), ancho, alto, escala };
}

function grisLab(datos, ancho, alto) {
  return mascaraProvisional(datos, ancho, alto, false);
}

function grisAlpha(datos, ancho, alto) {
  const gris = new Uint8Array(ancho * alto);
  for (let p = 0; p < gris.length; p++) gris[p] = 255 - datos[p * 4 + 3];
  return gris;
}

function grisLuminancia(datos, ancho, alto) {
  const gris = new Uint8Array(ancho * alto);
  for (let p = 0; p < gris.length; p++) {
    const i = p * 4, a = datos[i + 3] / 255;
    gris[p] = Math.round(luma(datos[i] * a + 255 * (1 - a), datos[i + 1] * a + 255 * (1 - a), datos[i + 2] * a + 255 * (1 - a)));
  }
  return gris;
}

function rgbaDesdeGris(gris) {
  const rgba = new Uint8Array(gris.length * 4);
  for (let p = 0; p < gris.length; p++) {
    const i = p * 4; rgba[i] = rgba[i + 1] = rgba[i + 2] = gris[p]; rgba[i + 3] = 255;
  }
  return rgba;
}

const preset = (filterSpeckle, lengthThreshold, extra = {}) => ({
  mode: "polygon", binary: true, hierarchical: "cutout", filterSpeckle,
  colorPrecision: 6, layerDifference: 16, cornerThreshold: 45,
  lengthThreshold, maxIterations: 10, spliceThreshold: 45, pathPrecision: 3,
  ...extra,
});

function recolorearRegiones(svg) {
  const paths = svg.match(/<path\b[^>]*\/?\s*>/gi) ?? [];
  const conservados = paths.filter((tag) => {
    const fill = tag.match(/fill=["']#([0-9a-f]{6})["']/i)?.[1];
    if (!fill) return true;
    const r = parseInt(fill.slice(0, 2), 16), g = parseInt(fill.slice(2, 4), 16), b = parseInt(fill.slice(4, 6), 16);
    return Math.hypot(255 - r, g, 255 - b) > 35;
  }).map((tag) => tag.replace(/fill=["'][^"']+["']/i, 'fill="#000000"'));
  return svg.replace(/<path\b[^>]*\/?\s*>/gi, "").replace(/<\/svg>/i, `${conservados.join("\n")}\n</svg>`);
}

function pixelesRegiones(datos, mascara) {
  const salida = new Uint8Array(datos.length);
  for (let p = 0; p < mascara.length; p++) {
    const i = p * 4;
    if (mascara[p] >= 170) { salida[i] = 255; salida[i + 1] = 0; salida[i + 2] = 255; salida[i + 3] = 255; }
    else { salida[i] = datos[i]; salida[i + 1] = datos[i + 1]; salida[i + 2] = datos[i + 2]; salida[i + 3] = 255; }
  }
  return salida;
}

function contar(svg) {
  return {
    nodos: (svg.match(/[MmLlCcSsQqTtAaHhVv]/g) ?? []).length,
    paths: (svg.match(/<path\b/g) ?? []).length,
  };
}

function validar(svg, ancho, alto) {
  const { nodos, paths } = contar(svg);
  const dimensiones = new RegExp(`width=["']${ancho}["'][^>]*height=["']${alto}["']`, "i").test(svg);
  const errores = [];
  if (/<image\b/i.test(svg)) errores.push("image");
  if (/<text\b/i.test(svg)) errores.push("text");
  if (/\b(?:href|xlink:href)\s*=|url\s*\(/i.test(svg)) errores.push("referencia-externa");
  if (!paths || !nodos) errores.push("sin-geometria");
  if (nodos > NODOS_MAXIMOS) errores.push("complejidad");
  if (!dimensiones) errores.push("dimensiones");
  return { valida: errores.length === 0, errores, nodos, paths, dimensionesCorrectas: dimensiones };
}

function mapaBordes(mask, ancho, alto) {
  const e = new Uint8Array(mask.length);
  for (let y = 1; y < alto - 1; y++) for (let x = 1; x < ancho - 1; x++) {
    const p = y * ancho + x, v = mask[p];
    if (mask[p - 1] !== v || mask[p + 1] !== v || mask[p - ancho] !== v || mask[p + ancho] !== v) e[p] = 1;
  }
  return e;
}

function dilatar(mask, ancho, alto) {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) {
    let v = 0;
    for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1 && !v; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < ancho && yy < alto) v ||= mask[yy * ancho + xx];
    }
    out[y * ancho + x] = v;
  }
  return out;
}

function contarHuecos(mask, ancho, alto) {
  const vistos = new Uint8Array(mask.length), cola = new Int32Array(mask.length);
  let huecos = 0;
  for (let inicio = 0; inicio < mask.length; inicio++) {
    if (vistos[inicio] || mask[inicio]) continue;
    let cabeza = 0, fin = 0, area = 0, tocaBorde = false;
    cola[fin++] = inicio; vistos[inicio] = 1;
    while (cabeza < fin) {
      const p = cola[cabeza++], x = p % ancho, y = (p / ancho) | 0; area++;
      if (!x || !y || x === ancho - 1 || y === alto - 1) tocaBorde = true;
      for (const q of [x ? p - 1 : -1, x + 1 < ancho ? p + 1 : -1, y ? p - ancho : -1, y + 1 < alto ? p + ancho : -1]) {
        if (q >= 0 && !vistos[q] && !mask[q]) { vistos[q] = 1; cola[fin++] = q; }
      }
    }
    if (!tocaBorde && area >= 4) huecos++;
  }
  return huecos;
}

function recallComponentes(ref, out, ancho, alto) {
  const vistos = new Uint8Array(ref.length), cola = new Int32Array(ref.length);
  let total = 0, presentes = 0;
  for (let inicio = 0; inicio < ref.length; inicio++) {
    if (vistos[inicio] || !ref[inicio]) continue;
    let cabeza = 0, fin = 0, area = 0, solape = 0;
    cola[fin++] = inicio; vistos[inicio] = 1;
    while (cabeza < fin) {
      const p = cola[cabeza++], x = p % ancho, y = (p / ancho) | 0; area++; solape += out[p];
      for (const q of [x ? p - 1 : -1, x + 1 < ancho ? p + 1 : -1, y ? p - ancho : -1, y + 1 < alto ? p + ancho : -1]) {
        if (q >= 0 && !vistos[q] && ref[q]) { vistos[q] = 1; cola[fin++] = q; }
      }
    }
    if (area >= 4) { total++; if (solape / area >= 0.1) presentes++; }
  }
  return { total, perdidos: total - presentes, recall: total ? presentes / total : 1 };
}

async function evaluar(svg, referenciaGris, ancho, alto, validacion) {
  const raw = await sharp(Buffer.from(svg)).resize(ancho, alto, { fit: "fill" }).flatten({ background: "#ffffff" }).greyscale().raw().toBuffer();
  const ref = Uint8Array.from(referenciaGris, (v) => v < 128 ? 1 : 0);
  const out = Uint8Array.from(raw, (v) => v < 128 ? 1 : 0);
  let refFg = 0, outFg = 0, perdido = 0, anadido = 0;
  for (let p = 0; p < ref.length; p++) {
    refFg += ref[p]; outFg += out[p];
    if (ref[p] && !out[p]) perdido++;
    if (!ref[p] && out[p]) anadido++;
  }
  const refE = mapaBordes(ref, ancho, alto), outE = mapaBordes(out, ancho, alto);
  const refD = dilatar(refE, ancho, alto), outD = dilatar(outE, ancho, alto);
  let refEc = 0, outEc = 0, refMatch = 0, outMatch = 0;
  for (let p = 0; p < ref.length; p++) {
    refEc += refE[p]; outEc += outE[p];
    if (refE[p] && outD[p]) refMatch++;
    if (outE[p] && refD[p]) outMatch++;
  }
  const precision = outEc ? outMatch / outEc : 0, recall = refEc ? refMatch / refEc : 0;
  const edgeF1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  const huecosRef = contarHuecos(ref, ancho, alto), huecosOut = contarHuecos(out, ancho, alto);
  const errorHuecos = clamp(Math.abs(huecosRef - huecosOut) / Math.max(1, huecosRef || 5));
  const comp = recallComponentes(ref, out, ancho, alto);
  const lost = perdido / Math.max(1, refFg);
  // Pérdida se normaliza contra lo que debía existir; adición contra lo que
  // salió. Así ambas son tasas [0,1] y un foreground de referencia pequeño no
  // convierte unos falsos positivos en un valor artificial de 400 %.
  const added = anadido / Math.max(1, outFg);
  const visual = clamp(1 - (0.27 * lost + 0.17 * clamp(added) + 0.24 * (1 - edgeF1) + 0.16 * errorHuecos + 0.16 * (1 - comp.recall)));
  const complejidad = clamp(0.06 * (validacion.nodos / NODOS_MAXIMOS) ** 1.4 + 0.02 * (validacion.paths / 500) ** 1.2, 0, 0.12);
  const score = validacion.valida ? 100 * clamp(visual - complejidad) : 0;
  return {
    score: round(score, 2), fidelidadVisual: round(visual), penalizacionComplejidad: round(complejidad),
    foregroundPerdido: round(lost), foregroundAnadido: round(added), similitudBordesF1: round(edgeF1),
    huecosReferencia: huecosRef, huecosSalida: huecosOut, errorHuecos: round(errorHuecos),
    componentesReferencia: comp.total, componentesPerdidos: comp.perdidos, recallComponentes: round(comp.recall),
  };
}

export async function vectorizarAdaptativo(archivo) {
  const metricas = await analizarInput(archivo);
  const clasificacion = clasificar(metricas);
  const { datos, ancho, alto, escala } = await rawObjetivo(archivo, clasificacion.clase);
  const alpha = metricas.alpha.fuerte;
  let referencia = clasificacion.clase === "fotografia"
    ? grisLuminancia(datos, ancho, alto)
    : alpha ? grisAlpha(datos, ancho, alto) : grisLab(datos, ancho, alto);
  const vtracer = await cargarVTracer();
  const candidatos = [];

  const ejecutar = async (nombre, pixeles, config, transforma = (svg) => svg) => {
    const inicio = performance.now();
    let svg = transforma(vtracer.to_svg(pixeles, ancho, alto, config));
    const validacion = validar(svg, ancho, alto);
    const evaluacion = await evaluar(svg, referencia, ancho, alto, validacion);
    candidatos.push({ nombre, svg, validacion, evaluacion, milisegundos: round(performance.now() - inicio, 1) });
  };

  if (clasificacion.clase === "fotografia") {
    const luminanciaOriginal = referencia;
    const hist = new Uint32Array(256);
    for (const v of luminanciaOriginal) hist[v]++;
    const centro = otsu(hist, referencia.length);
    // El raster preparado de una foto es luminancia explícita con umbral Otsu;
    // esto es la verdad de comparación común para los tres candidatos.
    referencia = Uint8Array.from(luminanciaOriginal, (v) => clamp(v - centro + 128, 0, 255));
    for (const [nombre, umbral, speckle, largo] of [
      ["luminancia-adaptativa", centro, 8, 3],
      ["luminancia-sombras", Math.max(40, centro - 18), 12, 4],
      ["luminancia-luces", Math.min(215, centro + 18), 12, 4],
    ]) {
      const ajustado = Uint8Array.from(luminanciaOriginal, (v) => clamp(v - umbral + 128, 0, 255));
      await ejecutar(nombre, rgbaDesdeGris(ajustado), preset(speckle, largo));
    }
  } else {
    await ejecutar("mascara-detalle", rgbaDesdeGris(referencia), preset(2, 1));
    await ejecutar("mascara-balanceada", rgbaDesdeGris(referencia), preset(5, 3));
    await ejecutar(
      "regiones-color",
      pixelesRegiones(datos, referencia),
      preset(clasificacion.clase === "ilustracion" ? 5 : 2, 2, { binary: false, hierarchical: "cutout", colorPrecision: 6, layerDifference: 12 }),
      recolorearRegiones,
    );
  }

  candidatos.sort((a, b) => b.evaluacion.score - a.evaluacion.score);
  const mejor = candidatos[0], segundo = candidatos[1];
  const margen = mejor.evaluacion.score - (segundo?.evaluacion.score ?? 0);
  const confianza = round(clamp(0.50 * mejor.evaluacion.score / 100 + 0.30 * clamp(margen / 12) + 0.20 * clasificacion.confianza));
  return {
    archivo, metricas, clasificacion, dimensionesVector: { ancho, alto, escala: round(escala) },
    seleccionado: mejor.nombre, score: mejor.evaluacion.score, confianza,
    candidatos,
  };
}

async function clasificarBaseline(archivo) {
  const { datos, ancho, alto } = await rawReducido(archivo, 320);
  const cuenta = new Map();
  let medios = 0;
  for (let p = 0; p < ancho * alto; p++) {
    const i = p * 4, a = datos[i + 3] / 255;
    const r = Math.round(datos[i] * a + 255 * (1 - a));
    const g = Math.round(datos[i + 1] * a + 255 * (1 - a));
    const b = Math.round(datos[i + 2] * a + 255 * (1 - a));
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 45 && lum < 210) medios++;
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }
  const n = ancho * alto;
  const top8 = [...cuenta.values()].sort((a, b) => b - a).slice(0, 8).reduce((a, b) => a + b, 0) / n;
  return { perfil: top8 < 0.9 ? "imagen" : medios / n < 0.03 ? "icono" : "trazo", top8: round(top8), medios: round(medios / n) };
}

async function rawBaseline(archivo, perfil) {
  const meta = await sharp(archivo).metadata();
  const objetivo = { trazo: 2000, icono: 1400, imagen: 1000 }[perfil];
  let escala = objetivo / Math.max(meta.width, meta.height);
  escala = Math.min(escala, 3);
  if (perfil !== "trazo") escala = Math.min(escala, 1);
  escala = Math.max(0.05, Math.min(escala, Math.sqrt(6_000_000 / (meta.width * meta.height))));
  const ancho = Math.max(1, Math.round(meta.width * escala)), alto = Math.max(1, Math.round(meta.height * escala));
  const { data } = await sharp(archivo).resize(ancho, alto, { fit: "fill", kernel: sharp.kernel.lanczos3 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { datos: new Uint8ClampedArray(data), ancho, alto, escala };
}

/** Reproducción del algoritmo actual para que el banco sea una comparación A/B. */
export async function vectorizarBaselineActual(archivo, claseEsperada) {
  const clasificacion = await clasificarBaseline(archivo);
  const { datos, ancho, alto, escala } = await rawBaseline(archivo, clasificacion.perfil);
  const metricas = await analizarInput(archivo);
  let referencia;
  if (claseEsperada === "fotografia") {
    const luminancia = grisLuminancia(datos, ancho, alto), hist = new Uint32Array(256);
    for (const v of luminancia) hist[v]++;
    const umbral = otsu(hist, luminancia.length);
    referencia = Uint8Array.from(luminancia, (v) => clamp(v - umbral + 128, 0, 255));
  } else {
    referencia = metricas.alpha.fuerte ? grisAlpha(datos, ancho, alto) : grisLab(datos, ancho, alto);
  }

  let entrada;
  if (clasificacion.perfil === "imagen") {
    entrada = new Uint8Array(datos.length);
    for (let p = 0; p < ancho * alto; p++) {
      const i = p * 4, a = datos[i + 3] / 255;
      entrada[i] = Math.round(datos[i] * a + 255 * (1 - a));
      entrada[i + 1] = Math.round(datos[i + 1] * a + 255 * (1 - a));
      entrada[i + 2] = Math.round(datos[i + 2] * a + 255 * (1 - a));
      entrada[i + 3] = 255;
    }
  } else {
    const gris = metricas.alpha.fuerte ? grisAlpha(datos, ancho, alto) : grisLab(datos, ancho, alto);
    entrada = rgbaDesdeGris(gris);
  }
  const ajustes = clasificacion.perfil === "trazo" ? [2, 1] : clasificacion.perfil === "icono" ? [4, 2] : [8, 4];
  const vtracer = await cargarVTracer();
  const inicio = performance.now();
  const svg = vtracer.to_svg(entrada, ancho, alto, preset(...ajustes));
  const validacion = validar(svg, ancho, alto);
  const evaluacion = await evaluar(svg, referencia, ancho, alto, validacion);
  return { clasificacion, dimensionesVector: { ancho, alto, escala: round(escala) }, svg, validacion, evaluacion, milisegundos: round(performance.now() - inicio, 1) };
}
