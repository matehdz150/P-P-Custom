/* Puente para poder usar VTracer sin pasar por el empaquetador.
   `vtracer.js` es un módulo ESM y Turbopack intentaría resolverlo si se
   importara por ruta; cargado como <script type="module"> desde nuestro
   propio origen, ni lo mira. Ver lib/impresion/vectorizar.ts. */
import init, { to_svg } from "./vtracer.js";
window.__vtracer = { init, to_svg };
