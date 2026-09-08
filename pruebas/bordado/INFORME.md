# Spike técnico de bordado para Kustto

Fecha de ejecución: 5 de septiembre de 2026  
Alcance: diseño técnico y prueba local aislada. No hay despliegue, cambios de producción ni cambios al pipeline de láser.

## Conclusión ejecutiva

Kustto no debe modelar bordado como `SVG -> DST`. Debe conservar un modelo semántico en milímetros, preparar geometría específica para bordado, producir un plan de puntadas reproducible y considerar DST como uno de sus artefactos derivados.

El spike demuestra que Ink/Stitch puede generar DST reconocibles para texto controlado, logos planos y una ilustración simplificada. También demuestra que un archivo DST estructuralmente correcto puede ser una mala orden de fabricación: la imagen compleja generó 7,295 puntadas, 155 saltos, 80 trims y 107 componentes, y fue rechazada por las reglas previas al taller.

La recomendación para V1 es un job asíncrono en una imagen de contenedor, con Ink/Stitch como digitizador y validación posterior con `pyembroidery` más un lector binario Tajima independiente. El navegador mantiene la experiencia interactiva y solicita regeneración cuando cambia la geometría o el tamaño físico; nunca escala un DST existente.

## 1. Arquitectura propuesta

### Lo que existe hoy

- `tecnica` vive por lado imprimible; `bordado` ya es un valor reconocido, pero hoy cae en la salida raster.
- Láser convierte los objetos compatibles a geometría SVG y verifica que no queden `<image>` o `<text>`.
- El editor serializa objetos Fabric por lado y el borrador viaja por IndexedDB hacia el flujo de pedido.
- El navegador solicita URLs firmadas y sube directamente los artefactos al almacenamiento.
- La orden congela las medidas físicas del lado y el taller descarga hoy vector y referencias PNG.

Estos patrones son útiles para identidad de artefactos, medidas, carga directa y descarga del taller. La digitización no pertenece a `lib/impresion/svg.ts`: bordado necesita un dominio, una cola y un runtime propios.

### Flujo propuesto

```text
Fabric + lado físico + técnica
        |
        v
Snapshot semántico inmutable (mm, transforms, texto, capas)
        |
        +--> análisis/preparación en browser --> preview provisional
        |
        v
Job bordado asíncrono e idempotente
        |
        v
Sanitizar -> segmentar/simplificar -> EmbroideryDesign
        |
        v
SVG interno anotado para Ink/Stitch -> plan de puntadas -> DST
        |
        v
Validar semántica + binario -> preview.png + diseno.dst + bordado.json
        |
        v
Pedido congela hashes/versión/medidas -> taller descarga los tres artefactos
```

El job final debe ejecutarse al confirmar el diseño o antes de permitir agregarlo al pedido. Se identifica por hash de `snapshot + lado + dimensiones + versión de reglas + versión del motor`, lo que permite caché e idempotencia. Mover o rotar un objeto cambia el snapshot; escalarlo cambia además densidad, underlay y longitudes, por lo que obliga a redigitizar.

### Lugar de ejecución

| Opción | Ventaja | Problema | Decisión |
|---|---|---|---|
| Browser/WASM | Preview inmediato y sin infraestructura adicional | No existe un port WASM maduro de todo Ink/Stitch; runtime pesado, resultados dependientes del cliente y entrada no confiable | Sólo análisis y preview provisional |
| Lambda ZIP | Encaja con la infraestructura actual | Dependencias gráficas/nativas y tamaño incómodos | Descartada |
| Lambda container + SQS | Aislamiento, versión reproducible, escalado a cero, fácil de integrar con S3 | Cold start grande y límite de duración; el spike local tardó 3–41 s sólo en motor | Opción V1 |
| ECS/Fargate worker | Procesos calientes y trabajos largos | Más operación y coste mínimo continuo | Escape si las mediciones reales no caben cómodamente en Lambda |

AWS admite imágenes de contenedor para Lambda y almacenamiento efímero `/tmp` configurable hasta 10,240 MB: [documentación de imágenes](https://docs.aws.amazon.com/lambda/latest/dg/python-image.html), [almacenamiento efímero](https://docs.aws.amazon.com/lambda/latest/api/API_EphemeralStorage.html). Antes de escoger memoria y timeout hay que medir la misma imagen en ARM64 dentro de Lambda; el tiempo local de Docker no equivale a cold start de AWS.

El contenedor productivo debe correr sin red, como usuario no privilegiado, con filesystem raíz de sólo lectura, directorio temporal por job, límite de bytes/píxeles/objetos, timeout y borrado del temporal. El SVG interno debe rechazar scripts, referencias externas, `<image>` y `<text>` antes de llegar al motor. La imagen reproducida del spike ocupa 384,665,160 bytes (aprox. 367 MiB) en ARM64, por lo que el tamaño es viable pero hace imprescindible medir cold start real.

## 2. Herramienta elegida y por qué

### Ink/Stitch 3.3.0: digitizador

Es la pieza que convierte geometría anotada en puntadas running, satin y fill/tatami, incluyendo densidad, underlay y compensación. Su CLI oficial exporta formatos de máquina y planes de puntadas: [CLI](https://inkstitch.org/docs/command-line/), [parámetros](https://inkstitch.org/docs/params/). El spike fija versión y SHA-256 del release Linux ARM64 oficial en `Dockerfile.inkstitch`.

Ventajas:

- genera un plan de puntadas, no sólo serializa DST;
- soporta los tres tipos mínimos y parámetros de fabricación;
- se puede aislar y fijar en un contenedor;
- permite conservar un SVG intermedio auditable sin convertirlo en el modelo de dominio.

Riesgos:

- runtime nativo grande y con dependencia de display virtual para CLI;
- licencia GPL-3.0: el servicio debe mantenerse aislado y hay que conservar avisos/código fuente correspondiente y revisar obligaciones con asesoría legal;
- no reemplaza las decisiones expertas de digitización ni la prueba física.

### pyembroidery 1.5.1: lector/validador, no digitizador

Puede leer y escribir muchos formatos y exponer comandos de puntada, pero no decide cómo convertir un logo arbitrario en satin/tatami correctamente. En el spike se usa después de Ink/Stitch para reabrir DST, contar comandos, calcular límites y renderizar la previsualización. Su alcance está descrito en el [paquete oficial](https://pypi.org/project/pyembroidery/).

### Alternativas consideradas

`libembroidery` es una biblioteca de bajo nivel para leer, escribir y transformar formatos, marcada como alpha; no resuelve la digitización: [repositorio oficial](https://github.com/Embroidermodder/libembroidery). Implementar nosotros el generador de tatami, satin, underlay y ruteo sería mucho más riesgo que integrar Ink/Stitch.

## 3. Qué se puede automatizar realmente

El spike automatiza de punta a punta:

1. genera o recibe raster/texto con medidas físicas;
2. mide alpha, bordes, entropía, textura y fondo perimetral;
3. usa alpha como máscara cuando existe; si no, estima el fondo desde el perímetro en Lab;
4. reduce paleta, limpia ruido morfológico, extrae contornos y contraformas;
5. elimina regiones por debajo del área mínima provisional y simplifica contornos;
6. agrupa por color y ordena por vecino cercano dentro de cada bloque;
7. asigna atributos running/satin/fill, densidad, underlay, ángulo y compensación;
8. genera el plan con Ink/Stitch y exporta DST;
9. vuelve a leerlo, obtiene métricas y produce un preview de puntadas;
10. valida además la estructura Tajima directamente, sin delegar esa comprobación a Ink/Stitch.

Limitación importante: la conversión de texto del spike usa centerlines controladas para medir satin, no es todavía un convertidor genérico de cualquier fuente Fabric. La preparación raster es una referencia funcional, no un segmentador productivo completo.

## 4. Qué sigue requiriendo digitización humana

- Ilustraciones con oclusiones importantes: agrupar por color puede cambiar qué objeto debe coserse primero.
- Degradados, fotografías, pelo, sombras, texturas o muchos componentes minúsculos.
- Decidir densidad, estabilizador, aguja, backing y compensación para una tela concreta.
- Columnas satin complejas: rungs, dirección, esquinas y división de columnas anchas.
- Letras pequeñas o tipografías con contrastes extremos, serifas finas y contraformas cerradas.
- Efectos especiales, apliqué, secuencias de parada o requisitos particulares de una máquina/taller.
- Aprobación física. Ink/Stitch recomienda inspeccionar el simulador y hacer test sew; underlay y push/pull dependen de tela, estabilizador, diseño, bastidor y velocidad: [workflow](https://inkstitch.org/docs/workflow/), [underlay](https://inkstitch.org/tutorials/underlay/), [push/pull](https://inkstitch.org/tutorials/push-pull-compensation/).

Por eso `review` es un estado de dominio distinto de `accept` y `reject`; no debe convertirse silenciosamente en compra fabricable.

## 5. Modelo intermedio propuesto

`EmbroideryDesign` es la fuente regenerable; `DST` es un derivado con versión y hash.

```ts
type EmbroideryDesign = {
  schemaVersion: number
  engineProfileVersion: string
  sourceSnapshotSha256: string
  sideId: string
  units: "mm"
  area: { widthMm: number; heightMm: number; hoopId?: string }
  designBounds: { xMm: number; yMm: number; widthMm: number; heightMm: number }
  colors: Array<{
    id: string
    sourceHex: string
    displayHex: string
    threadCatalog?: { brand: string; code: string; name?: string }
    order: number
  }>
  objects: EmbroideryObject[]
  constraints: { maxWidthMm: number; maxHeightMm: number }
  preparation: {
    strategy: string
    sourceMetrics: Record<string, number | boolean>
    removedFeatures: Array<{ reason: string; areaMm2?: number }>
  }
}

type EmbroideryObject = {
  id: string
  sourceObjectId: string
  geometry: PathGeometry | SatinColumnGeometry | CenterlineGeometry
  stitchType: "running" | "bean" | "satin" | "fill"
  colorId: string
  density: { spacingMm: number }
  angleDeg?: number
  underlay: Array<"center-walk" | "contour" | "zigzag" | "tatami">
  pullCompensationMm: number
  stitchLengthMm?: number
  maxStitchLengthMm: number
  trimAfter?: boolean
  dependencies: string[]
  order: number
}
```

`bordado.json` añade al modelo el resultado derivado: versión del motor, hashes, métricas, incidencias, decisión y confidence. Los JSON de los cinco casos son ejemplos ejecutables del esquema inicial.

## 6. Reglas para running, satin y fill

Las reglas deben combinar semántica, topología y milímetros; un solo umbral de ancho no basta.

- **Running/bean:** paths abiertos, centerlines y contornos finos. Longitud objetivo inicial 2–2.5 mm, acortada en curvas. Bean sólo cuando haga falta peso visual; demasiadas repeticiones endurecen la tela.
- **Satin:** letras y columnas reconocibles con dos bordes o centerline, ancho suficientemente estable y dirección controlable. Ink/Stitch documenta satin para bordes, letras y rellenos pequeños y considera 1.5 mm el mínimo por defecto de un satin basado en stroke: [satin](https://inkstitch.org/docs/stitches/satin-column/). Columnas muy anchas deben dividirse o pasar a fill.
- **Fill/tatami:** regiones cerradas relativamente grandes. Ángulos alternados entre capas, longitud máxima y underlay en áreas que lo necesiten. Ink/Stitch distingue explícitamente running, satin y fill en su modelo de parámetros: [running](https://inkstitch.org/docs/stitches/running-stitch/), [fill](https://inkstitch.org/docs/stitches/fill-stitch/).

Reglas iniciales del spike, todavía no límites de producción:

- texto: altura >= 6 mm, asta >= 1.2 mm y contraforma >= 1.0 mm;
- satin: separación zigzag 0.42 mm, center-walk y compensación 0.2 mm;
- fill: separación 0.45 mm, puntada máxima 4 mm, compensación 0.15 mm y underlay a partir de 18 mm²;
- región raster: eliminar bajo 0.75 mm² en casos normales y simplificar con tolerancia 0.12 mm.

Estos valores son hipótesis conservadoras para el spike. Deben convertirse en perfiles versionados por combinación de tela/taller/máquina sólo después de una matriz de test sew. No se deben esconder como constantes universales.

## 7. Estrategia de colores y orden

1. Si hay alpha significativo, usarlo para separar artwork, no para inferir que es line-art.
2. Sin alpha, estimar fondo desde el perímetro y validar que sea uniforme; si no lo es, elevar a revisión.
3. Reducir colores perceptualmente en Lab/CIEDE2000 y luego mapear a un catálogo de hilos del taller. El spike aún cuantiza la paleta en RGB y usa Lab sólo para fondo; V1 debe cerrar esa diferencia.
4. Conservar `sourceHex`, color visible, código de hilo y orden en `bordado.json`.
5. Construir un grafo de precedencias para capas/oclusiones. Sólo dentro de grupos que puedan permutarse sin cambiar la imagen se minimizan recorridos y trims.
6. Agrupar por hilo cuando sea legal; no cruzar una dependencia de capa sólo por ahorrar un cambio.

DST conserva cambios de color, pero no es una guía rica y portable de nombres/códigos de hilo; Ink/Stitch también recomienda una lista de hilos separada: [thread list](https://inkstitch.org/docs/threadlist/). El taller debe recibir preview + lista ordenada además del DST.

El spike usa 8 colores como aviso y 12 como rechazo sólo para hacer visible el problema; no son máximos productivos. Los datos de este banco muestran 1, 1, 4, 6 y 8 colores. La política real se fija por capacidad y cotización del taller después de probar diseños reales.

## 8. Estrategia de validación

La validación debe ejecutarse en capas y producir `accept | review | reject` con incidencias medibles:

### Entrada y preparación

- MIME y firma reales, bytes y dimensiones limitados;
- alpha, entropía, textura, densidad de bordes y uniformidad del perímetro;
- cantidad/área/ancho de componentes antes y después de simplificar;
- paleta y pérdida visual por reducción;
- texto: altura, grosor de asta, contraformas y fuente permitida.

### Modelo y plan de puntadas

- límites en milímetros y bastidor;
- geometría válida, sin referencias externas;
- densidad estimada por región y superposición acumulada;
- puntadas cortas/largas, saltos, trims, cambios de color y conteo total;
- orden compatible con las dependencias de capas;
- preview obligatorio y score/confidence trazables.

### DST

- reabrir con `pyembroidery`;
- comprobar bounds y conteos;
- lector independiente: header Tajima de 512 bytes, payload en registros de 3 bytes, registro END, `ST:` y `CO:` coherentes, deltas dentro del formato;
- verificar hash, tamaño y coincidencia con `bordado.json`.

Los límites numéricos actuales están identificados en el JSON como `spike guardrails`. Para promoverlos a producción hacen falta pruebas físicas por perfil. En particular, “el DST abre” sólo demuestra integridad estructural; no demuestra tensión, legibilidad o estabilidad en tela.

## 9. Generación de DST

El prototipo genera un SVG interno en milímetros con paths reales y atributos de Ink/Stitch. El contenedor ejecuta:

```sh
/opt/inkstitch/bin/inkstitch --extension=output --format=dst geometria.svg > diseno.dst
```

Luego `pyembroidery` lo reabre para las métricas y un decodificador mínimo revisa directamente sus registros Tajima. Nunca se modifica el DST después; cualquier cambio de tamaño o geometría reinicia la digitización desde `EmbroideryDesign`.

Para reproducir localmente en ARM64:

```sh
cd pruebas/bordado
docker build -f Dockerfile.inkstitch -t kustto-inkstitch-spike:local .
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python spike.py
```

Los parámetros de producción se deben fijar junto con la arquitectura de CPU y hashes del release. El contenedor incluido fija Ink/Stitch 3.3.0 ARM64 y valida el tarball antes de instalarlo.

## 10. Resultados del spike

Área nominal usada: 90 x 60 mm. Casos sintéticos y deterministas; cada directorio contiene `original.png`, `geometria.svg`, `preview.png`, `diseno.dst` y `bordado.json`.

| Caso | Decisión | Medida DST | Puntadas | Colores/cambios | Saltos | Trims | Tiempo total | DST | Resultado |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Texto simple | accept 0.96 | 82.6 x 16.6 mm | 1,321 | 1 / 0 | 8 | 0 | 3.80 s | 4,502 B | Legible; satin + center-walk |
| Logo monocromo | accept 0.96 | 50.6 x 50.0 mm | 1,973 | 1 / 0 | 2 | 0 | 13.85 s | 6,440 B | Contraformas conservadas; fill + contorno running |
| Logo 4 colores | accept 0.96 | 70.6 x 40.0 mm | 3,382 | 4 / 3 | 7 | 3 | 13.95 s | 10,718 B | Regiones y orden de color reconocibles |
| Ilustración | review 0.88 | 76.2 x 44.6 mm | 2,520 | 6 / 5 | 16 | 6 | 11.94 s | 8,192 B | Reconocible; capas/oclusiones requieren revisión |
| Imagen compleja | reject 0.00 | 90.6 x 60.4 mm | 7,295 | 8 / 7 | 155 | 80 | 40.12 s | 23,597 B | Rebasa área; 107 componentes, textura/entropía fotográfica |

Tiempos medidos en Docker local con la imagen ya descargada; incluyen preparación, invocación del motor, validación y preview, no descarga/build ni cold start de nube. Los cinco binarios pasaron todas las comprobaciones estructurales. En el caso complejo se detectaron además 1,222 componentes removidos y 185 movimientos menores de 0.3 mm.

Artefactos:

- [texto simple](casos/01-texto-simple/preview.png)
- [logo monocromo](casos/02-logo-monocromo/preview.png)
- [logo cuatro colores](casos/03-logo-cuatro-colores/preview.png)
- [ilustración](casos/04-ilustracion/preview.png)
- [imagen compleja rechazada](casos/05-imagen-compleja/preview.png)
- [resultados completos](resultados.json)

Todavía no se cumple la parte física del criterio de éxito: no hubo máquina ni test sew. Los archivos abren, sus geometrías son reconocibles en el preview de puntadas y pasan dos lecturas, pero “razonablemente fabricable” sigue siendo provisional hasta coser las cuatro salidas no rechazadas en las telas objetivo.

## 11. Cambio mínimo para Kustto V1

1. Añadir un tipo de salida `embroidery`, sin convertir `bordado` en `vector` ni alterar láser.
2. Crear `lib/bordado/` para snapshot semántico en mm, análisis, validaciones compartidas y contrato `EmbroideryDesign`.
3. Conservar texto como texto semántico hasta el job; permitir inicialmente una lista pequeña de fuentes pre-digitizadas o perfiles probados. Ink/Stitch recomienda fuentes de bordado pre-digitizadas y rangos de tamaño: [lettering](https://inkstitch.org/docs/lettering/).
4. Para imágenes V1, aceptar automáticamente sólo logos planos con alpha o fondo perimetral uniforme y pocos componentes; ilustraciones van a revisión y foto/degradado se rechaza con explicación.
5. Añadir API `POST /bordados/jobs` y consulta de estado. El job recibe un snapshot/hashes, nunca una URL arbitraria.
6. Crear worker Lambda container ARM64 + SQS + DLQ. Publica artefactos primero en un prefijo temporal y marca `ready` sólo tras validar los tres.
7. Ampliar los tipos de artefacto firmados con `bordado-dst`, `bordado-preview` y `bordado-metadata`, sus MIME/extensiones, límites y checksums.
8. Congelar en el pedido `jobId`, versión de perfil/motor, medidas, conteos, colores, decisión y hashes. Sólo `accept` puede avanzar automáticamente; `review` requiere aprobación trazable.
9. En el taller, descargar un ZIP o los tres artefactos y mostrar la guía ordenada de hilos junto al preview.
10. Invalidar/regenerar cuando cambien tamaño, geometría, texto, rotación que afecte dirección de puntada, lado, tela o perfil. Una simple traslación dentro del lado podría reutilizar el plan si no cambia bounds permitidos, pero el artefacto final debe quedar referenciado al snapshot exacto.
11. Instrumentar tiempo, cold start, fallos, puntadas, trims y ratio `review/reject`; activar por feature flag para un solo taller/producto y ampliar sólo después del test sew.

### Puerta recomendada para V1

V1 debe vender automáticamente texto de fuentes/tamaños probados y logos planos simples. La ilustración no debe bloquearse para siempre, pero entra a una cola humana. Fotografías, degradados y composiciones con demasiados componentes se rechazan antes de cobrar. Esta frontera ofrece un producto útil sin prometer que una heurística sustituye la digitización profesional.
