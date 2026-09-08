/**
 * Los cuatro mockups de manga, de una sola fuente.
 *
 * ESTILO TOMADO DEL ORIGINAL, no inventado: fondo #f1f3e8 y prenda #ffffff son
 * los colores muestreados del mockup de la playera que ya existe.
 *
 * EL CONTORNO TIENE QUE CERRAR. El teñido recorta por relleno desde los bordes
 * borrando lo que pase de 236 de luminancia; la tela blanca (255) sólo
 * sobrevive porque el trazo oscuro la encierra. Un hueco y la prenda se ahueca.
 */
import { writeFileSync } from "node:fs";

const FONDO = "#f1f3e8";
const TELA = "#ffffff";
const TRAZO = "#1a1a1a";
const COSTURA = "#c4c7c0";

const W = 1400, H = 1100;

/** Perfil de cada largo: hasta dónde llega el puño y cuánto se estrecha. */
const LARGOS = {
  corta: { hemX: 1075, capoY: 330, bajoY: 795, puno: 62 },
  larga: { hemX: 1235, capoY: 430, bajoY: 700, puno: 78 },
};

function manga(largo) {
  const { hemX, capoY, bajoY, puno } = LARGOS[largo];
  /* La manga tendida, con el doblez arriba: como en una ficha técnica.
     Arriba el doblez (casi recto), a la derecha el puño, abajo la costura
     interior, y a la izquierda la SISA — que es una S, no un arco: convexa en
     la copa y cóncava al bajar al sobaco. Dibujada como un solo arco salía un
     embudo. */
  const copaY = 168, sobacoY = 872;
  const d = [
    `M 300 ${copaY + 96}`,
    // copa: sube y cae hacia el hombro
    `C 318 ${copaY + 18} 402 ${copaY - 16} 470 ${copaY + 6}`,
    // doblez del hombro hasta el puño
    `L ${hemX} ${capoY}`,
    // puño
    `L ${hemX} ${bajoY}`,
    // costura interior de vuelta al sobaco
    `L 452 ${sobacoY}`,
    // sisa cóncava: del sobaco vuelve a la copa
    `C 330 ${sobacoY - 52} 286 ${copaY + 330} 300 ${copaY + 96}`,
    "Z",
  ].join(" ");
  /* Dónde cae el área imprimible. NO se dibuja en la imagen: `useFabricCanvas`
     ya la pinta como un Rect gris, y en "Probar" —donde este mockup se usa de
     respaldo porque la manga no tiene foto real— un recuadro discontinuo
     parecería parte de lo que se va a estampar. Se devuelve para calcular las
     coordenadas del lienzo, nada más. */
  const area = largo === "corta"
    ? { x: 545, y: 395, w: 372, h: 268 }
    : { x: 545, y: 430, w: 372, h: 236 };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${FONDO}"/>
  <path d="${d}" fill="${TELA}" stroke="${TRAZO}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M 352 ${copaY + 108} C 372 ${copaY + 330} 392 ${sobacoY - 66} 486 ${sobacoY - 30}"
        fill="none" stroke="${COSTURA}" stroke-width="4" stroke-dasharray="14 11"/>
  <line x1="${hemX - puno}" y1="${capoY + 16}" x2="${hemX - puno}" y2="${bajoY - 14}"
        stroke="${TRAZO}" stroke-width="5"/>
  <line x1="${hemX - puno + 18}" y1="${capoY + 22}" x2="${hemX - puno + 18}" y2="${bajoY - 20}"
        stroke="${COSTURA}" stroke-width="3.5" stroke-dasharray="13 10"/>
</svg>`;
  return { svg, area };
}

const salida = {};
for (const largo of ["corta", "larga"]) {
  const { svg, area } = manga(largo);
  // La izquierda es el espejo de la derecha: misma mano, mismo trazo.
  const espejo = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <g transform="translate(${W},0) scale(-1,1)">${svg.replace(/<\/?svg[^>]*>/g, "")}</g>
</svg>`;
  writeFileSync(`manga-${largo}-derecha.svg`, svg);
  writeFileSync(`manga-${largo}-izquierda.svg`, espejo);
  salida[largo] = { area, espejoX: W - area.x - area.w };
}
console.log(JSON.stringify(salida, null, 1));
