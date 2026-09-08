# Diagnóstico de vectorización: Discovery Park

Fecha: 2026-09-05

No se modificó el pipeline ni se desplegó nada. El archivo se leyó de S3 con
`AWS_PROFILE=kustto-admin` y el diagnóstico se ejecutó en Chrome contra el
`vectorizar()` y `mascaraDeDiseno()` actuales. La llamada a VTracer se
interceptó en el puente temporal para capturar sus argumentos exactos.

## Fuente

- Objeto: `s3://kustto-publico-prod/medios/imagenes/a4a8c4d8-a071-703c-48e9-3353a09a48cc/20260905T201800-c97d1f8e.webp`
- Nombre guardado: `discovery.webp`
- SHA-256: `83c919d213de1d497d742dcfd645d1c71c8b46dd7354f421e3c5a578bcfcbff4`
- Tamaño natural: 1180 × 549
- Alfa mínimo/máximo: 0 / 255
- Píxeles con alfa menor de 250: 525589 (81.13195 %)

## Dónde se pierde la información

El clasificador crea una copia de 320 × 149 sobre blanco. Los ocho colores
cuantizados más frecuentes ocupan 89.58263 % y el corte actual exige 90 %.
Por esa diferencia de 0.41737 puntos porcentuales el logo se clasifica como
`imagen`, no como `trazo`.

Consecuencias exactas:

1. Se elige objetivo de 1000 px y se reduce a 1000 × 465 (escala 0.8474576).
2. El branch `imagen` aplana el WebP transparente sobre blanco.
3. `mascaraDeDiseno()` no se llama. La estrategia efectiva no es alfa ni
   Lab/Otsu.
4. Ese RGBA se entrega directamente a VTracer con el preset de fotografía:
   `filterSpeckle: 8`, `lengthThreshold: 4`, `binary: true`.
5. La versión vendorizada de VTracer binariza con `pixel.r < 128`; no calcula
   luminancia. En el buffer de 1000 × 465, 36.96935 % de los píxeles que
   pertenecen al artwork quedan del lado `r >= 128` y se descartan.

La reconstrucción del buffer siguiendo el branch real de `pixelesDe()` se
comparó con los 1,860,000 bytes capturados en `to_svg`: 0 bytes distintos,
diferencia máxima 0. Esto confirma que no hay otro canvas ni conversión entre
`pixelesDe()` y VTracer. En este branch `mascara.ts` no llegó a ejecutarse.

La salida directa actual contiene 73 paths, 2171 nodos, 0 `<image>` y 0
`<text>`. La información ya falta en esa salida, antes de Fabric.

## Después de VTracer

`useAddImage` entrega ese SVG directamente a `loadSVGFromString`, agrupa los
objetos con `new Group(trazos)` y sólo transforma ese grupo. En la exportación,
`exportarSvgDeLado` usa `objeto.toSVG()`. No existe un segundo `drawImage`,
resize o retrazado en el camino activo.

Existe un flujo legado en `DesignerSidebar/SidebarAddImage.tsx` que inserta un
`FabricImage` sin vectorizar, pero actualmente no tiene importadores y no
participa en este bug.

## Comparación

| Estrategia | Tamaño de trazado | Paths | Nodos | Bytes SVG | Resultado |
|---|---:|---:|---:|---:|---|
| Actual: perfil `imagen`, canal rojo | 1000 × 465 | 73 | 2171 | 11000 aprox. | Pierde `LA VENTA` y regiones claras |
| Forzar `trazo` + máscara por alfa | 2000 × 931 | 74 | 2828 | 16790 | Conserva texto e isotipo; bordes más limpios |
| Color `stacked`, luego negro | 2000 × 931 | 73 | 6461 | 44153 | Conserva geometría, pero más dentada y compleja |
| Color `cutout`, quitar fondo y negro | 2000 × 931 | 73 | 6311 | 42878 | Conserva geometría; exige identificar la clave de fondo dinámica |

En color, VTracer produjo 35 colores de relleno. En `cutout` eligió magenta
como color clave del fondo y generó 13 paths de ese color que hubo que retirar
antes de convertir el resto a negro. En `stacked` el fondo se descarta dentro
del motor, pero la estrategia admite capas apiladas. Ambas variantes duplican
ampliamente la complejidad de la máscara por alfa y dejan bordes más dentados.

## Cambio mínimo recomendado

Antes de aplanar la muestra usada por `clasificar`, detectar transparencia
significativa. Si existe, tratarla como señal explícita de segmentación y
llevarla por `trazo`/máscara de alfa. Para este archivo no hay que estimar el
fondo ni ajustar el 90 %: el propio alfa ya separa inequívocamente artwork y
fondo.

Como corrección separada, el perfil `imagen` debería convertir a gris real
antes de `to_svg`, porque el WASM binario mira sólo el canal rojo. Ese cambio
afecta fotografías y necesita su propio juego de regresión; no hace falta para
corregir este logo.

La vectorización por regiones de color es una buena alternativa para logos
opacos cuyo fondo no se pueda separar con confianza, pero no conviene como
primer arreglo aquí: el alfa ya ofrece una máscara más limpia, pequeña y
determinista.
