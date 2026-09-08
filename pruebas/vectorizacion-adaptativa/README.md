# Vectorizador adaptativo — prototipo y banco de regresión

Este directorio conserva el experimento aislado que precedió a la integración.
Usa exactamente el `vtracer.wasm` vendorizado por la aplicación; `sharp` sólo
sustituye al canvas para poder ejecutar el banco desde Node y volver a
rasterizar los SVG de forma determinista. La implementación equivalente para
navegador quedó en `apps/web/lib/impresion/adaptativo.ts` y se publicó el 5 de
septiembre de 2026.

Discovery Park es la fixture `01`, no una excepción en el algoritmo.

## Arquitectura propuesta

```text
RGBA original
   │
   ├── análisis sin modificar píxeles
   │      alpha · color · entropía · tono · bordes · fondo · textura · componentes
   │
   ├── clasificador multiseñal + confianza
   │      logo/line-art · icono geométrico · ilustración · fotografía
   │
   ├── preparación de una referencia fabricable
   │      alpha | distancia Lab al perímetro | luminancia explícita + Otsu
   │
   ├── 3 candidatos de VTracer
   │
   ├── validación estructural y rasterización inversa
   │
   └── score visual − coste de fabricación → SVG elegido + confianza
```

El análisis ocurre a un máximo de 320 px en el lado largo. La vectorización usa
el tamaño correspondiente a la clase, con límite de 3 megapíxeles en este
prototipo. Ninguna decisión de clase depende de una sola métrica. Alpha es una
señal fuerte para saber dónde termina el fondo, pero aporta cero puntos por sí
solo a `logo-line-art`, `icono-geometrico`, `ilustracion` o `fotografia`.

## Métricas de entrada

- **Alpha:** fracción transparente (`a < 250`), parcialmente transparente y
  opaca. Se considera que hay alpha útil cuando más de 2 % de la muestra no es
  opaca.
- **Colores dominantes:** RGB cuantizado a 4 bits por canal; concentración de
  los bins top-1 y top-8 sobre píxeles visibles.
- **Entropía:** Shannon en los 4096 bins. Se guarda en bits y normalizada contra
  el máximo teórico de 12 bits.
- **Tono continuo:** proporción normalizada de vecinos con diferencias de
  luminancia pequeñas pero no nulas.
- **Edge density:** magnitud Sobel, normalizada por la muestra interior.
- **Fondo en bordes:** mediana RGB del perímetro y proporción dentro de
  `ΔE76 < 8`; con alpha mide perímetro transparente.
- **Textura:** energía absoluta del Laplaciano, normalizada.
- **Componentes pequeños:** componentes conexos de una máscara provisional,
  cantidad y fracción del área ocupada por islas pequeñas.

El clasificador combina esas señales en cuatro scores. Dos interacciones son
especialmente importantes:

1. `entropía × tono continuo` aumenta fotografía y penaliza logo/icono. Esto
   distingue una fotografía recortada de un icono aunque ambos tengan alpha y
   un solo componente.
2. Pocos componentes sólo favorecen a icono si además hay baja entropía, baja
   textura y baja densidad de bordes. Un retrato recortado no cumple ese
   conjunto.

La confianza de clase empieza en 0.45 y crece con el margen entre las dos
clases más probables. Un margen menor a 0.09 marca el caso como ambiguo.

## Referencia y candidatos por clase

| Clase | Referencia fabricable | Candidatos |
|---|---|---|
| Logo/line-art con alpha | Máscara de alpha; todo píxel visible es artwork | máscara detalle, máscara balanceada, regiones de color |
| Logo/line-art sin alpha | Fondo mediano del perímetro, distancia Lab y umbral Otsu | máscara detalle, máscara balanceada, regiones de color |
| Icono geométrico | Alpha o Lab según el input | máscara detalle, máscara balanceada, regiones de color |
| Ilustración | Alpha o Lab; la región de fondo se excluye | regiones de color y dos máscaras geométricas |
| Fotografía, con o sin alpha | Composición sobre blanco, luminancia sRGB explícita y Otsu | umbral adaptativo, sombras `−18`, luces `+18` |

`regiones-color` usa VTracer en color/cutout, quita la región de fondo y
convierte todos los fills restantes a negro. Los candidatos de fotografía
nunca entregan RGB original a `binary:true`: los tres reciben R=G=B igual a la
luminancia preparada.

El prototipo genera siempre tres candidatos para poder medir el comportamiento.
En una integración posterior se pueden generar dos cuando la clase tenga alta
confianza y reservar tres para los ambiguos.

## Evaluación y score

Cada SVG se rasteriza nuevamente a las dimensiones exactas de su raster
preparado. De los dos mapas binarios se obtienen:

- `foregroundPerdido = FN / foregroundReferencia`
- `foregroundAnadido = FP / foregroundSalida`
- F1 de bordes, con tolerancia morfológica de un píxel
- error relativo en huecos/contraformas cerradas
- recall de componentes conexos de al menos 4 píxeles
- nodos y paths

La fidelidad visual es:

```text
V = 1 - (
  0.27·perdido
  + 0.17·añadido
  + 0.24·(1 - edgeF1)
  + 0.16·errorHuecos
  + 0.16·(1 - recallComponentes)
)
```

La penalización de fabricación crece de forma no lineal:

```text
C = min(0.12,
  0.06·(nodos / 20000)^1.4
  + 0.02·(paths / 500)^1.2
)

score = 100·clamp(V - C, 0, 1)
```

Un SVG inválido obtiene score 0. La confianza final combina 50 % del score del
ganador, 30 % del margen sobre el segundo candidato y 20 % de la confianza de
clasificación. Esta confianza expresa decisión relativa dentro de los
candidatos disponibles; no es una probabilidad estadísticamente calibrada.

## Validación estructural

Para ser elegible, el SVG debe cumplir todo esto:

- cero `<image>` y cero `<text>`;
- cero `href`, `xlink:href` o `url(...)`;
- al menos un `<path>` y un comando geométrico;
- máximo 20,000 nodos;
- `width` y `height` iguales al raster preparado.

## Banco de pruebas

Comando reproducible:

```bash
node pruebas/vectorizacion-adaptativa/generar-fixtures.mjs
node pruebas/vectorizacion-adaptativa/ejecutar-banco.mjs
```

Resultado de la corrida final:

| Caso | Clase elegida | Estrategia elegida | Actual | Adaptativo | Δ | Nodos |
|---|---|---:|---:|---:|---:|---:|
| Logo color + alpha (Discovery) | logo/line-art | máscara detalle | 81.15 | 99.09 | +17.94 | 2,374 |
| Logo color sin alpha | logo/line-art | máscara detalle | 75.48 | 99.07 | +23.59 | 2,415 |
| Logo blanco/negro | logo/line-art | máscara detalle | 99.94 | 99.93 | −0.01 | 209 |
| Wordmark pequeño | logo/line-art | máscara detalle | 98.89 | 98.78 | −0.11 | 1,243 |
| Icono geométrico | icono geométrico | máscara detalle | 99.98 | 99.98 | 0.00 | 82 |
| Ilustración | ilustración | máscara detalle | 99.72 | 99.85 | +0.13 | 122 |
| Retrato | fotografía | luminancia adaptativa | 28.05 | 89.25 | +61.20 | 490 |
| Fotografía con alpha | fotografía | luminancia adaptativa | 27.53 | 91.73 | +64.20 | 473 |
| Degradados | fotografía | luminancia adaptativa | 67.21 | 99.92 | +32.71 | 136 |
| JPEG con compresión | fotografía | luminancia luces | 75.34 | 86.06 | +10.72 | 4,917 |
| **Promedio** | **10/10 clases** |  | **75.33** | **96.37** | **+21.04** | **máx. 4,917** |

Los 10 SVG elegidos son estructuralmente válidos. El tiempo local medio fue
138.9 ms por candidato y 416.6 ms para generar/evaluar tres; p95 por candidato
399.6 ms. Incluye VTracer y rasterización inversa en Node, no es todavía una
medición de UX en browser.

Los resultados completos, incluidos los tres candidatos, todas las métricas y
la comparación con el pipeline actual, están en `resultados.json`. `salidas/`
contiene SVG y preview del ganador; `salidas-baseline/`, la salida actual.

## Lectura de los resultados

- Discovery mejora porque se clasifica como logo y usa alpha, sin ninguna regla
  por nombre, dimensiones o colores concretos.
- La mejora de fotografía es mayor porque el pipeline actual manda RGB a un
  binarizador que en realidad compara sólo el canal rojo con 128. El prototipo
  manda luminancia explícita.
- Wordmark, icono e ilustración quedan virtualmente empatados con el actual. Las
  diferencias de −0.11 a +0.13 están dentro de la sensibilidad de esta métrica;
  no hay evidencia de sacrificio visual.
- En el JPEG ruidoso el candidato de mayor similitud de bordes tenía 6,933 nodos
  y 264 paths. El score eligió uno con 4,917 nodos y 138 paths: menos complejo a
  cambio de una diferencia visual limitada. Es el comportamiento buscado.

## Límites del experimento

- Diez casos sirven como smoke/regression suite, no como corpus estadístico. La
  clasificación 10/10 está calibrada con este banco y no prueba generalización.
- Retrato y fotografía con alpha son la misma fuente con dos tratamientos para
  aislar el efecto de alpha. Antes de producción hacen falta más fotos, logos e
  ilustraciones reales, y un conjunto holdout que no se use para calibrar.
- La referencia mide fidelidad al raster fabricable preparado, no calidad
  física de una máquina concreta. Kerf, potencia, material y tamaño final aún
  requieren pruebas de taller.
- `regiones-color` usa una llave cromática temporal porque VTracer no expone la
  semántica de región de fondo. Es válido como candidato experimental, pero no
  debería ser la única estrategia.
- La ejecución es Node para tener un runner reproducible. Las operaciones del
  núcleo son Canvas/ImageData compatibles, pero falta medir memoria, bloqueos y
  cancelación dentro de un Web Worker real.

## Cambio mínimo propuesto al pipeline actual

No cambiaría el editor, Fabric, exportación ni UI. El cambio mínimo se limita a
los internos de `apps/web/lib/impresion/`:

1. Sustituir `clasificar()` por `analizarInput()` + un clasificador multiseñal,
   conservando la firma pública `vectorizar(imagen)`.
2. Separar en `mascara.ts` las preparaciones alpha y Lab para reutilizarlas como
   referencia de evaluación.
3. Corregir primero el camino `imagen`: componer sobre blanco y escribir
   luminancia explícita en R=G=B antes de llamar a VTracer. Es el cambio más
   pequeño y con mayor ganancia medida.
4. Añadir un generador de candidatos y un evaluador por `OffscreenCanvas` dentro
   de un Web Worker. Devolver sólo el SVG ganador, más `confianza`, manteniendo
   intactos `useAddImage`, Fabric y el contrato de exportación.
5. Copiar este manifiesto a tests y bloquear el cambio si baja el score de un
   caso más de 2 puntos, aparece `<image>/<text>`, supera 20,000 nodos o cambia
   las dimensiones.

Antes de publicar se ejecutó el banco completo también dentro de Chrome con el
WASM real: 10/10 clases y 10/10 SVG válidos. La integración mantiene la firma
pública de `vectorizar(imagen)` y no cambia Fabric, el editor ni el contrato de
exportación.
