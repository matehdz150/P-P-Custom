import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const raiz = path.resolve(import.meta.dirname, "../..");
const destino = path.join(import.meta.dirname, "fixtures");
await mkdir(destino, { recursive: true });

const svg = (ancho, alto, contenido, fondo = "") => Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
  ${fondo ? `<rect width="100%" height="100%" fill="${fondo}"/>` : ""}
  ${contenido}
</svg>`);

const guardarSvg = async (nombre, ancho, alto, contenido, fondo = "") => {
  await sharp(svg(ancho, alto, contenido, fondo)).png().toFile(path.join(destino, nombre));
};

// El caso conocido queda como una fixture más, exactamente con los píxeles
// que llegaron al editor durante el diagnóstico.
const discovery = path.join(raiz, "pruebas/vectorizacion-discovery/01-original.png");
await copyFile(discovery, path.join(destino, "01-logo-color-alpha.png"));
await sharp(discovery)
  .flatten({ background: "#ffffff" })
  .png()
  .toFile(path.join(destino, "02-logo-color-sin-alpha.png"));

await guardarSvg(
  "03-logo-blanco-negro.png",
  760,
  300,
  `<g fill="#101010">
    <path fill-rule="evenodd" d="M70 55h190a55 55 0 0 1 0 110H145v75H70zm75 45v25h105a12.5 12.5 0 0 0 0-25z"/>
    <circle cx="365" cy="147" r="91"/><circle cx="365" cy="147" r="37" fill="#fff"/>
    <path d="M470 58h220v48H530v42h135v46H530v48h165v48H470z"/>
  </g>`,
  "#ffffff",
);

await guardarSvg(
  "04-wordmark-texto-pequeno.png",
  680,
  150,
  `<text x="24" y="65" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="700" letter-spacing="2" fill="#111">KUSTTO</text>
   <text x="27" y="107" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="600" letter-spacing="4" fill="#111">HECHO PARA TI</text>
   <text x="28" y="132" font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#111">México · edición 2026</text>`,
  "#ffffff",
);

await guardarSvg(
  "05-icono-geometrico.png",
  420,
  420,
  `<g fill="#1769ff">
    <rect x="52" y="52" width="316" height="316" rx="76"/>
    <path d="M128 214l58 58 112-128 31 28-141 161-91-90z" fill="#fff"/>
    <circle cx="308" cy="111" r="20" fill="#ffcc00"/>
  </g>`,
);

await guardarSvg(
  "06-ilustracion.png",
  700,
  520,
  `<g stroke-linecap="round" stroke-linejoin="round">
    <path d="M92 438C130 338 192 280 280 258c80-20 132-80 177-171 5 86 40 143 111 183 46 26 73 83 82 168z" fill="#f5c542" stroke="#222" stroke-width="8"/>
    <path d="M218 291c-9-92 37-151 125-177 24 82-8 145-91 190" fill="#54b87a" stroke="#222" stroke-width="8"/>
    <path d="M347 259c54-68 122-82 205-42-35 75-99 105-190 77" fill="#4a91e2" stroke="#222" stroke-width="8"/>
    <path d="M153 410c72-43 143-52 211-27 68 25 132 20 191-14" fill="none" stroke="#222" stroke-width="8"/>
    <g fill="#e85656" stroke="#222" stroke-width="6"><circle cx="286" cy="351" r="17"/><circle cx="392" cy="350" r="14"/><circle cx="466" cy="381" r="19"/></g>
  </g>`,
  "#fffaf0",
);

// Retrato sin alpha: mismo tipo de contenido que una foto subida por cliente,
// aplanado sobre blanco para que no comparta la señal alpha con el siguiente.
const retrato = path.join(raiz, "apps/web/public/products/tshirt.png");
await sharp(retrato)
  .resize({ width: 620, height: 760, fit: "inside" })
  .flatten({ background: "#ffffff" })
  .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
  .toFile(path.join(destino, "07-retrato.jpg"));

await sharp(retrato)
  .resize({ width: 620, height: 760, fit: "inside" })
  .png()
  .toFile(path.join(destino, "08-fotografia-alpha.png"));

await guardarSvg(
  "09-degradados.png",
  720,
  440,
  `<defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071a52"/><stop offset=".48" stop-color="#6d36c9"/><stop offset="1" stop-color="#f7d154"/></linearGradient>
    <radialGradient id="r"><stop stop-color="#fff"/><stop offset=".35" stop-color="#f96"/><stop offset="1" stop-color="#8b164f"/></radialGradient>
  </defs>
  <rect x="0" y="0" width="720" height="440" fill="url(#g)"/>
  <circle cx="360" cy="220" r="145" fill="url(#r)" opacity=".9"/>
  <path d="M0 350Q170 260 350 345T720 320V440H0z" fill="#07111f" opacity=".72"/>`,
);

// Una foto con textura real, reducida y recomprimida varias veces para añadir
// ruido de bloque/ringing sin depender de una descarga o de un servicio.
const foto = path.join(raiz, "apps/web/public/event2.png");
const primera = await sharp(foto)
  .resize(640, 640, { fit: "cover" })
  .jpeg({ quality: 28, chromaSubsampling: "4:2:0" })
  .toBuffer();
await sharp(primera)
  .jpeg({ quality: 22, chromaSubsampling: "4:2:0" })
  .toFile(path.join(destino, "10-jpeg-ruido-compresion.jpg"));

const manifiesto = [
  ["01-logo-color-alpha.png", "logo-line-art", "Logo color con transparencia (Discovery Park)"],
  ["02-logo-color-sin-alpha.png", "logo-line-art", "Logo color sin transparencia"],
  ["03-logo-blanco-negro.png", "logo-line-art", "Logo blanco/negro"],
  ["04-wordmark-texto-pequeno.png", "logo-line-art", "Wordmark con texto pequeño"],
  ["05-icono-geometrico.png", "icono-geometrico", "Icono geométrico"],
  ["06-ilustracion.png", "ilustracion", "Ilustración por regiones"],
  ["07-retrato.jpg", "fotografia", "Retrato"],
  ["08-fotografia-alpha.png", "fotografia", "Fotografía recortada con alpha"],
  ["09-degradados.png", "fotografia", "Imagen con degradados/tono continuo"],
  ["10-jpeg-ruido-compresion.jpg", "fotografia", "JPEG con ruido y compresión"],
].map(([archivo, esperado, descripcion]) => ({ archivo, esperado, descripcion }));

await writeFile(
  path.join(destino, "manifest.json"),
  `${JSON.stringify(manifiesto, null, 2)}\n`,
);

console.log(`Generadas ${manifiesto.length} fixtures en ${destino}`);
