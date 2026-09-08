# Registro de la gorra 3D con la foto frontal

Cambio local del 7 de septiembre de 2026. Sin despliegue ni cambios de
catálogo, bordado, pedidos o dimensiones de fabricación.

## Fuente y alcance

Producto probado: `fef3cb1d-5c43-49cf-b5ad-6dfc3209fe9c`, Gorra de algodon.
La foto frontal calibrada termina en `e1f194ce4501c534.png` (1312×1199).
`REGISTRO_GORRA` identifica esa foto y registra su silueta contra el GLB
actual. Las cuatro esquinas del área impresa siguen viniendo del catálogo:
no están duplicadas como constantes en el componente.

No aplicar este registro a una foto lateral, a otra gorra o a un GLB distinto.
Si se sustituye la foto/modelo hay que revisar silueta, cámara y cobertura del
área. La suite fija el hash del GLB para detectar ese cambio. Una foto sin
registro conserva el respaldo anterior, explícitamente aproximado.

## Implementación

- Proyectar los vértices desde una cámara frontal fija. La elevación de
  18.1416194° iguala la relación alto/ancho de la silueta sin deformar la malla.
- Registrar la silueta proyectada con la foto; aplicar la inversa de la misma
  homografía de sus cuatro esquinas para obtener las UV del arte.
- Dibujar el área completa, incluidos márgenes transparentes. No ajustar el
  tamaño a los píxeles con tinta, ni recentrar objetos, ni aplicar el antiguo
  desplazamiento de 3 cm. Rotar o cambiar fotos no recalcula las UV.
- La UV original de costuras/normal map permanece intacta. Sólo se modifican
  clones por instancia, nunca la geometría compartida ni el GLB del usuario.
- Incluir los triángulos exteriores superiores que el export original dejó
  fuera de `frente`. El eje de la copa es el botón, no el centro de la caja
  completa (que incluye la visera). Separar con dos grupos de material evita
  un draw call por triángulo y no imprime el reverso/interior trasero.
- Encajar al mismo máximo de 560 px que la foto. El ResizeObserver actualiza
  únicamente el encuadre; no vuelve a colocar la cámara de OrbitControls.

## Verificación

```sh
node --test pruebas/gorra-3d/mapeo.test.mjs
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec eslint components/Designer/Gorra3D.tsx lib/prenda/mapeoGorra.ts
```

Con el servidor local abierto y Playwright/Chromium disponibles:

```sh
PLAYWRIGHT_MODULE=/ruta/a/node_modules/playwright node pruebas/gorra-3d/browser.cjs
```

El script abre el producto público real, añade texto sólo en el editor local,
compara foto y 3D, alterna las tres fotos, gira y vuelve al modelo y abre el
preview móvil. No crea pedidos ni modifica datos remotos. Guarda capturas en
un directorio temporal y muestra métricas/resultados en stdout.

Medición con `Nuevo texto`, viewport 1440×1000 y zoom 100%:

| Métrica de tinta | Foto frontal | Modelo 3D |
| --- | ---: | ---: |
| Ancho | 234 px | 234 px |
| Alto | 32 px | 33 px |
| Centro X del visor | 498.5 px | 499.5 px |
| Centro Y del visor | 406.5 px | 406 px |

La diferencia residual incluye antialiasing, iluminación y rasterización de
las UV. El cambio de fotos conserva el canvas y la imagen frontal; después
de girar, la diferencia media al regresar es 0.062/255 por canal (residuo
subpíxel del damping), sin reset de órbita. Móvil 390×844: modelo visible sin
errores JS. La suite matemática prueba 121 puntos del arte y 25 rayos sobre
el GLB, incluidos los extremos del área, para detectar recortes silenciosos.

## Límites

### Iluminación de estudio

El preview incorpora luz principal lateral neutra, relleno, contraluz y
ambiente reducido, con sombras PCF sobre la propia gorra. La principal es la
única que produce sombras (1024 px en el visor, 512 px en miniatura); su mapa
se calcula una vez porque sólo se mueve la cámara. Se libera al desmontar.
El relieve vuelve a la intensidad original del material para no exagerar el
tejido con la luz lateral. No se modifican color del arte, UV ni medidas.

Al terminar un gesto se completan los frames residuales del damping antes de
dejar de dibujar. La prueba de órbita espera reposo y compara la matriz de
cámara; la diferencia fotométrica se registra aparte, pues depende también
del filtrado de sombras. Las métricas anteriores corresponden al pase previo
a esta iluminación.

### Fidelidad

Esto calibra colocación y proporción visual contra la foto frontal; no convierte
un modelo genérico en una réplica exacta de tela, costuras o curvatura. Las
otras dos fotos conservan sus calibraciones existentes: su perspectiva y
colocación manual también condicionan la comparación. No se promete exactitud
física de bordado; siguen mandando las medidas y los artefactos de fabricación.
