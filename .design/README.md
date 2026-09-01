# Los lienzos de diseño

Aquí vive el diseño de Kustto **antes** de convertirse en componentes. Cada
carpeta es un lienzo: artboards `.dc.html` (uno por pantalla), un
`canvas.json` con su disposición, y las imágenes que usan.

Se editan con la skill `/design` y se publican como Artifact para poder
verlos y comentarlos. **La versión publicada no es la fuente de verdad: los
archivos de esta carpeta sí.** Si vas a retomar un diseño, edita aquí y
vuelve a publicar sobre la misma URL.

---

## Índice

| Carpeta | Qué es | Artboards | Artifact |
|---|---|---|---|
| `.` (raíz) | La landing, versión lima. **Implementada.** | Main, Movil | [748d600a](https://claude.ai/code/artifact/748d600a-8b5d-4898-837b-621138a4b0cd) |
| `catalogo/` | Catálogo editorial. **Implementado.** | Main, Movil | [99bd3715](https://claude.ai/code/artifact/99bd3715-7083-4f31-a852-6d5a032dffac) |
| `producto/` | Página de producto. **Implementada** (la dirección "lookbook"). | Main, Movil, Actual | [dab968f9](https://claude.ai/code/artifact/dab968f9-b1bd-4f38-8c68-78aabdf2b16f) |
| `editor/` | Rediseño del motor de diseño. **Implementado** en `components/Designer/`. | Main, Vacio, Movil | [29d9417a](https://claude.ai/code/artifact/29d9417a-1ee4-4c06-85f2-6b545c697627) |
| `proveedores/` | Landing para talleres. **Implementada** en `/proveedores`. | Main, Movil | [6879c89f](https://claude.ai/code/artifact/6879c89f-bad5-47de-b872-466c3c49e643) |
| `landing-azul/` | La landing recoloreada a la paleta azul. Una prueba de una sola vez; **no se adoptó**. | Main, Movil | [bb4f1340](https://claude.ai/code/artifact/bb4f1340-7f43-414e-a23b-56f0d0b7fb34) |

En `producto/` el artboard **Actual** es la página tal como estaba antes del
rediseño, para comparar. No es una propuesta.

---

## La marca

Los tokens viven de verdad en `apps/web/app/globals.css`. Esto es la
chuleta:

| Token | Hex | Para qué |
|---|---|---|
| tinta | `#2b2812` | texto y fondos oscuros |
| lima | `#aeff6e` | el acento de la marca |
| lima-oscuro | `#7cb944` | lima legible sobre fondo claro |
| lavanda | `#c9b8ff` | acento secundario |
| hueso | `#fffdf8` | fondo cálido |
| hueso-suave | `#efebe1` | el mismo, un paso más marcado |
| gris | `#f3f3f1` | fondo neutro |
| naranja | `#f8774d` | acciones, con cuidado |

Tipografía: **Figtree** para títulos (700/800) y **Poppins** para el cuerpo.

> Si los títulos te salen en Poppins, no es un bug del CSS: es el servidor de
> desarrollo sirviendo Tailwind viejo. Reinícialo y se arregla. Figtree
> reemplazó a Archivo Black, y el `@theme` sólo se recompila al arrancar.

El logotipo es la palabra sola. Se le quitó el símbolo a propósito. La
cabecera tiene dos variantes (`components/Kustto/Header.tsx`): `centrado`
sólo en la landing, `alineado` en todo lo demás, para que el logo comparta
eje con el contenido de la página.
