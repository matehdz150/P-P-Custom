/**
 * Abre la página en Chrome de verdad y lee lo que midió.
 *
 * Headless, pero con `--headless=new`, que sí ejecuta rAF y compone fotogramas.
 * Se conecta por CDP porque es lo que hay disponible en esta máquina.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const publico = path.join(aqui, "publico");

const servidor = createServer(async (req, res) => {
  const nombre = (req.url === "/" ? "/index.html" : req.url).split("?")[0];
  try {
    const cuerpo = await readFile(path.join(publico, nombre));
    res.writeHead(200, {
      "content-type": nombre.endsWith(".js") ? "text/javascript" : "text/html",
    });
    res.end(cuerpo);
  } catch {
    res.writeHead(404).end("no");
  }
});
await new Promise((r) => servidor.listen(0, r));
const puerto = servidor.address().port;

const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--remote-debugging-port=9333", "--no-first-run",
  "--disable-gpu", "--user-data-dir=/tmp/chrome-bordado",
  `http://127.0.0.1:${puerto}/`,
], { stdio: "ignore" });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
await esperar(2500);

async function cdp() {
  const lista = await (await fetch("http://127.0.0.1:9333/json/list")).json();
  const pagina = lista.find((t) => t.type === "page" && t.url.includes(String(puerto)));
  if (!pagina) throw new Error("no encontré la página");
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pendientes = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id); }
  };
  return {
    enviar: (method, params) =>
      new Promise((r) => { const i = ++id; pendientes.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }),
    cerrar: () => ws.close(),
  };
}

const c = await cdp();
let resultado = null;
for (let i = 0; i < 90; i++) {
  const r = await c.enviar("Runtime.evaluate", {
    expression: "JSON.stringify(window.__resultado ?? null)", returnByValue: true,
  });
  const v = r.result?.result?.value;
  if (v && v !== "null") { resultado = JSON.parse(v); break; }
  await esperar(1000);
}
const texto = await c.enviar("Runtime.evaluate", {
  expression: "document.getElementById('salida').textContent", returnByValue: true,
});
console.log(texto.result?.result?.value ?? "(sin salida)");
console.log("__RESULTADO__", JSON.stringify(resultado));

c.cerrar();
chrome.kill();
servidor.close();
process.exit(resultado ? 0 : 1);
