# Fase de calidad y performance del motor de bordado

Fecha: 6 de septiembre de 2026  
Estado: `experimental-v3` implementado y medido; **no promovible todavía**.  
Producción: conserva `experimental-v2-2026-09-06`. No se desplegó ni se modificó infraestructura AWS.

## 1. Diagnóstico exacto

El worker v2 recibía cada satin como un único centerline con `stroke-width` constante. Esa representación es adecuada para un stroke uniforme sencillo, pero deja a Ink/Stitch inferir rails, correspondencia y orientación en curvas, múltiples subpaths y junctions. En `e`, por ejemplo, un objeto con dos subpaths y cinco comandos produjo puntadas de hasta 8.006 mm, p95 de 7.437 mm y una convergencia visible hacia el centro.

La línea base completa está en [`resultados/before-v2/resultados.json`](resultados/before-v2/resultados.json). Los 20 casos generaron DST/Tajima válidos, pero eso no evitó abanicos, uniones densas y puntadas largas.

## 2. Origen de los abanicos

El origen está en `formas.ts -> centerline` y `worker.py -> stroke-width`: no existían dos rails explícitos ni pares ordenados. Pocos nodos Bezier describían una curva visual, pero no daban suficientes checkpoints de dirección. Ink/Stitch documenta que los nodos afectan el render de un stroke satin y que el control completo requiere dos rails en la misma dirección y rungs; recomienda al menos tres rungs: <https://inkstitch.org/docs/stitches/satin-column/>.

## 3. Origen de las acumulaciones

En un cruce, cada rama llegaba completa al mismo nodo y cada columna incluía center-walk. El resultado era la suma de varias cubiertas satin y underlays sobre la misma zona. En `Y`, v2 superponía tres columnas completas; en `H`, el hotspot se concentraba en el travesaño.

## 4. Baseline

Agregado de 20 fixtures:

| Métrica | v2 |
|---|---:|
| Ink/Stitch total | 27,478.5 ms |
| p95 por fixture | 2,947.9 ms |
| max stitch acumulado | 103.933 mm |
| p95 stitch acumulado | 92.363 mm |
| crossing stitches | 2,603 |
| overlapping segments | 2,411 |
| densidad máxima acumulada | 256 |
| jumps / trims | 153 / 14 |
| objetos / nodos / SVG bytes | 196 / 441 / 64,943 |

No se reprodujeron los casos de 100–130 s: con imagen ARM64 caliente, el peor fixture fue `donut` con 4.26 s y el caso Discovery 2.92 s. Esto indica que los 100–130 s pertenecen a otra revisión, cold start/CPU o geometría no representada en este banco; no se atribuye falsamente al motor actual.

## 5. Cambios al algoritmo satin

`experimental-v3` conserva ancho local por punto del esqueleto, interpola el centerline en mm, suaviza orientación y ancho, genera satins manuales, aplica taper y subdivide por giro acumulado. Las columnas entre 6 y 12 mm se parten en dos carriles satin; por encima de 12 mm caen a fill/revisión. V2 no cambia.

## 6. Rails y orientación

Por muestra se calcula una tangente local con ventana, su normal continua y el par `left[i] / right[i]`. Ambos rails avanzan en el mismo sentido y el path añade tres o más rungs que cruzan ambos rails. Los controles redundantes se eliminan sólo si no cambia ancho, orientación ni han pasado 8 mm. Esto sigue el contrato manual de Ink/Stitch: <https://inkstitch.org/docs/params/>.

## 7. Junctions

Las ramas ahora conservan si sus extremos tienen grado >=3. En v3, un extremo de junction se acorta según el ancho; la misma rama recortada se usa al calcular cobertura, por lo que el nudo reaparece como sobrante para recibir un único fill, en vez de quedar oculto por tres satins completos. El `Y` mantuvo 2 jumps y bajó overlapping segments de 58 a 47 en la iteración compactada.

## 8. Satin / fill / running

La decisión sigue en mm: menos de 1 mm va a running; el rango fabricable de v3 termina en 6 mm; de 6–12 mm puede subdividirse si la rama es estable y alargada; más ancho pasa a fill. Las densidades y underlay existentes se preservan y `physicallyValidated` permanece `false`.

## 9. Simplificación SVG

Se compactan puntos colineales o casi equivalentes sin mover la geometría: se conserva cualquier cambio de ancho >=0.1 mm, giro >=4° o checkpoint cada 8 mm. Aun así, representar rails reales cuesta más que un centerline: el banco pasa de 441 a 2,775 nodos y de 64,943 a 105,389 bytes. Por ello el gate `nodeCountNotWorse` queda rojo.

## 10. Runtime

No hubo mejora de runtime demostrable. El total de `engineMs` subió 3.1% y el p95 pasó de 2,947.9 a 3,012.7 ms. En estos casos domina el costo fijo de lanzar Ink/Stitch; el donut tatami sigue siendo el más lento y no se beneficia de rails. No se logró el objetivo 30–50% y no se declara como logrado.

Se separan `svgGeneration`, display/Xvfb, proceso+digitización, DST parsing, Tajima, preview y upload. Ink/Stitch 3.3.0 no ofrece un corte fiable entre inicialización interna y digitización; ambos campos quedan `null` en vez de inventarse.

## 11. Comparación de 20 fixtures

El detalle por caso está en [`COMPARACION.md`](COMPARACION.md) y los datos completos en [`comparacion-v2-v3.json`](comparacion-v2-v3.json).

Agregado v2 → v3:

| Métrica | Cambio |
|---|---:|
| max stitch length | −27.1% |
| p95 stitch length | −22.1% |
| crossing stitches | −10.9% |
| max local density | −6.2% |
| trims | −7.1% |
| overlapping segments | **+24.0%** |
| jumps | **+2.0%** |
| stitch count | **+12.8%** |
| engineMs | **+3.1%** |

Todos conservaron Tajima y número de colores. Discovery es uno de los 20 casos y no contiene ninguna excepción específica.

## 12. Stitch plots

El índice visual before/after está en [`REPORTE-VISUAL.md`](REPORTE-VISUAL.md). La mejora más clara es `e`: max stitch 8.006 → 3.106 mm, p95 7.437 → 3.049 mm, cruces 123 → 16 y densidad máxima 22 → 11. El costo es 1 → 4 objetos y 5 → 74 nodos.

## 13. Previews

Cada fixture contiene `stitchPlot.png` y `embroideredPreview.png`. El primero muestra hilo, puntos de aguja y jumps; el segundo añade grosor, sombra y brillo aproximados. `embroideredPreview` está rotulado conceptualmente como simulación y no sustituye test sew.

## 14. Métricas

Se miden longitudes, p95/promedio, jumps, trims, colores, travel, densidad por celda de 1 mm, cambios de orientación módulo 180°, cruces comparables, solapes, hilo estimado y complejidad SVG. Por objeto se hace corrida aislada hasta 20 objetos; sobre ese límite sólo se publica geometría, porque DST no conserva `objectId` ni tipo de puntada. `runningStitches/satinStitches/fillStitches` quedan `null` cuando no pueden atribuirse con fiabilidad.

## 15. Tests

- Suite previa del clasificador/raster: 17/17.
- Paquete `@kustto/bordado`: 33/33.
- Worker: 13/13.
- Suite de calidad: 20/20 DST generados, 20/20 Tajima válidos.
- TypeScript web: sin errores.
- Docker ARM64: build y smoke real de `e` correctos; digest local `sha256:165f0e18fac2f3c27ecd7852fbdf0e1ab424971fb8c652dc8d06282ea19241d6`.

## 16. AWS E2E controlado

Con `kustto-admin` se hizo sólo lectura. La Lambda productiva `kustto-embroidery-worker` está `Active`, ARM64. Se descargaron y revalidaron cinco artefactos existentes (`texto`, `multicolor`, `Discovery`, `ilustración`, `texto variante`): Tajima válido y stitchCount idéntico al metadata.

No se desplegó v3 ni se ejecutó v3 en AWS: el gate local de promoción está rojo y la fase excluye cambios de infraestructura. Además, el resultado E2E histórico conserva un caso `02-logo-monocromo` fallido. Ejecutar un E2E de v3 exigiría publicar una imagen/alias experimental, acción explícitamente evitada.

## 17. Nuevo perfil

Existe `experimental-v3-2026-09-06`, con guardrails de calidad separados del clasificador y `physicallyValidated:false`. `preparar()` sigue fijado a v2; sólo `prepararExperimentalV3()` entra a v3. El rollback es conservar v2, que es exactamente el estado actual.

## 18. Riesgos restantes

- Overlap, sharp changes, jumps, stitch count, nodos y runtime todavía regresan en agregado.
- Los guardrails no están validados en tela/máquina.
- La suite usa geometría controlada; Intel/Google son fixtures geométricos deterministas, no archivos oficiales de marca.
- La corrida v3 transforma geometría preparada para aislar stitch-plan; falta una corrida browser end-to-end del preparador experimental.
- La métrica de cruces excluye cruces perpendiculares compatibles con center-walk, pero no puede separar todas las capas desde DST.
- El orden nearest-neighbor sólo actúa en grupos del mismo color, sin dependencias y con bounds no solapados; fuera de eso preserva stacking.
- Sigue faltando test sew.

## Decisión

La mejora del stitch plan es real en longitud, abanicos y densidad, pero el candidato no cumple aún performance ni todos los criterios de regresión. **No promover, no desplegar, no marcar físicamente validado.** El siguiente cambio mínimo debe reducir objetos/underlay repetido entre segmentos manuales y volver a medir; si no logra bajar overlap y engine p95, mantener el híbrido v2 para columnas simples y usar rails sólo en geometrías que demuestren riesgo.
