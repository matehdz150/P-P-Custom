/** Abre el generador en Chrome y guarda los diseños que produjo. */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const publico = path.join(aqui, "publico");
const destino = path.join(aqui, "disenos");
await mkdir(destino, { recursive: true });

const servidor = createServer(async (req, res) => {
  const nombre = (req.url === "/" ? "/index.html" : req.url).split("?")[0];
  try {
    const cuerpo = await readFile(path.join(publico, nombre));
    res.writeHead(200, { "content-type": nombre.endsWith(".js") ? "text/javascript" : "text/html" });
    res.end(cuerpo);
  } catch { res.writeHead(404).end("no"); }
});
await new Promise((r) => servidor.listen(0, r));
const puerto = servidor.address().port;

const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--remote-debugging-port=9334", "--no-first-run", "--disable-gpu",
  "--user-data-dir=/tmp/chrome-e2e", `http://127.0.0.1:${puerto}/`,
], { stdio: "ignore" });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
await esperar(2500);

const lista = await (await fetch("http://127.0.0.1:9334/json/list")).json();
const pagina = lista.find((t) => t.type === "page" && t.url.includes(String(puerto)));
const ws = new WebSocket(pagina.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const enviar = (method, params) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

let crudo = null;
for (let i = 0; i < 120; i++) {
  const r = await enviar("Runtime.evaluate", { expression: "window.__disenos ? JSON.stringify(window.__disenos) : ''", returnByValue: true });
  const v = r.result?.result?.value;
  if (v) { crudo = v; break; }
  await esperar(1000);
}
ws.close(); chrome.kill(); servidor.close();
if (!crudo) { console.error("no se generó nada"); process.exit(1); }

const salida = JSON.parse(crudo);
if (salida.error) { console.error("error en la página:", salida.error); process.exit(1); }

const indice = [];
for (const [nombre, caso] of Object.entries(salida.casos)) {
  if (caso.preparado) {
    await writeFile(path.join(destino, `${nombre}.json`), JSON.stringify(caso.design, null, 2) + "\n");
    const p = {};
    for (const o of caso.design.objects) p[o.stitch.type] = (p[o.stitch.type] ?? 0) + 1;
    indice.push({ caso: nombre, espera: caso.espera, preparado: true, designHash: caso.designHash,
      objetos: caso.design.objects.length, colores: caso.design.colors.length, puntadas: p,
      msLocal: Math.round(caso.msLocal) });
    console.log(`${nombre}: ${caso.design.objects.length} objetos, ${caso.design.colors.length} hilos, ${JSON.stringify(p)}, hash ${caso.designHash.slice(0,12)}, ${Math.round(caso.msLocal)}ms`);
  } else {
    indice.push({ caso: nombre, espera: caso.espera, preparado: false, motivo: caso.motivo, msLocal: Math.round(caso.msLocal) });
    console.log(`${nombre}: NO PREPARADO (${caso.motivo}) ${Math.round(caso.msLocal)}ms`);
  }
}
await writeFile(path.join(destino, "indice.json"), JSON.stringify({ profileVersion: salida.profileVersion, casos: indice }, null, 2) + "\n");
