# Benchmark AWS y diseño de integración de bordado para Kustto

Fecha de ejecución: 5–6 de septiembre de 2026  
Cuenta de benchmark: `218897024535`, perfil local `kustto-admin`  
Región: `us-east-1`  
Alcance: Lambda temporal aislada y diseño técnico. No se modificó ni desplegó frontend, API productiva, DynamoDB productivo, S3 productivo, pedidos, checkout, taller ni láser.

## Conclusión ejecutiva

**Lambda Container ARM64 sigue siendo la opción recomendada para V1**, con 2,048 MB, 90 segundos de timeout productivo después de un preflight estricto, 512 MB de `/tmp`, batch SQS de uno y concurrencia reservada inicial de cinco.

La conclusión no se basa sólo en que Kustto ya use Lambda. El contenedor generó los cinco DST con consistencia semántica a 2,048 y 3,008 MB, y las ráfagas de 1, 5 y 10 trabajos terminaron 1/1, 5/5 y 10/10 sin choques de Xvfb ni temporales. El punto de 3,008 MB no dio una mejora consistente frente a 2,048 MB y cuesta más. A 1,024 MB, el caso complejo agotó siempre el timeout interno de 150 segundos.

La latencia fría importante no es `Init Duration`, que fue normalmente de 0.2–0.3 s. Es la primera ejecución de Ink/Stitch dentro de cada sandbox: los logos e ilustraciones tardaron unos 21–35 s en frío a 2,048 MB y cerca de 3 s en caliente. Por ello la API debe ser asíncrona y la clasificación debe rechazar fotografías/complejidad alta antes de lanzar Ink/Stitch.

Todavía no existe evidencia de costura física. `READY` sólo puede significar “pasó las reglas versionadas y validaciones de archivo”, no “se garantiza que coserá bien en cualquier tela”.

## 1. Benchmark Lambda

### Entorno y contenedor

Antes de crear nada se confirmó que Kustto opera principalmente en `us-east-1`; las Lambdas existentes son ZIP Node.js, no tienen VPC y no fueron tocadas. El benchmark creó exclusivamente un repositorio ECR, un rol IAM con `AWSLambdaBasicExecutionRole`, una Lambda y un log group llamados `kustto-embroidery-benchmark-20260906000747-1367`.

La imagen reproducible usa Ubuntu 22.04 ARM64, Ink/Stitch 3.3.0 con SHA-256 fijado, Xvfb, Python, `awslambdaric` 4.0.2, Pillow 11.3.0 y `pyembroidery` 1.5.1. El handler sólo admite los cinco nombres de caso empacados, invoca Ink/Stitch mediante una lista de argumentos sin shell, crea un directorio único por petición, valida DST por dos lectores, genera preview y borra el temporal.

| Propiedad | Medición |
| --- | ---: |
| Build limpio ARM64 | 89 s, dominado por descarga |
| Imagen comprimida en ECR | 400,144,147 B (381.6 MiB) |
| Filesystem visible extraído | 965,444,807 B (920.7 MiB) |
| Capas de filesystem | 11 |
| Capa Ink/Stitch comprimida | 263.3 MB |
| Dependencias Ubuntu runtime comprimidas | 102.0 MB |
| Base Ubuntu comprimida | 27.6 MB |
| Dependencias Python comprimidas | 7.16 MB |
| Digest ejecutado | `sha256:2dd24dff8fd4a80d00aca9d933dc24a0df63247352cc715f76d80e49c3700866` |

El tamaño está muy por debajo del máximo de 10 GB sin comprimir de Lambda Container. AWS también documenta `/tmp` entre 512 y 10,240 MB y timeout máximo de 15 minutos, pero esos máximos no son recomendaciones de configuración: [cuotas de Lambda](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html), [imágenes de contenedor](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html).

### Método

- Se hicieron tres muestras frías y al menos cinco calientes por celda válida.
- Cada generación fría se forzó cambiando una variable de entorno de la función, esperando `function-updated-v2` y confirmando `Init Duration` y un `environmentId` nuevo. Las calientes se ejecutaron inmediatamente sobre los entornos reutilizados.
- `Cold` en la tabla es mediana de tiempo facturado, que incluye init; `Warm` es mediana de `Duration`. `Engine` muestra mediana fría/caliente de Ink/Stitch.
- `Cost/job` usa la duración facturada mediana, ARM a USD 0.0000133334/GB-s más USD 0.20 por millón de requests, sin aplicar Free Tier: [precios de Lambda](https://aws.amazon.com/lambda/pricing/).
- `p95` es sólo el máximo de tres muestras frías y el máximo de cinco calientes; es una aproximación de banco, no un percentil estadísticamente estable. No se presenta como p99.
- Las 19 entradas de `discarded-validator-run.jsonl` se excluyeron porque pertenecen a una imagen anterior cuyo lector Tajima confundía el límite por eje con longitud euclidiana. El fallo se corrigió antes de generar toda la matriz aquí reportada.

### Resultado principal

Tiempos en segundos; costo en USD, fría/caliente.

| Memory | Caso | Cold | Warm | Engine | Max RAM | Cost/job |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 1,024 | Texto simple | 7.84 | 5.09 | 7.41 / 4.91 | 326 MB | 0.000105 / 0.000068 |
| 1,024 | Logo monocromo | 47.34 | 5.08 | 46.80 / 4.84 | 329 MB | 0.000631 / 0.000068 |
| 1,024 | Logo 4 colores | 47.88 | 4.72 | 46.53 / 4.31 | 332 MB | 0.000639 / 0.000063 |
| 1,024 | Ilustración | 48.59 | 5.35 | 47.94 / 4.97 | 331 MB | 0.000648 / 0.000072 |
| 1,024 | Imagen compleja | timeout >150 | — | no terminó | 374 MB | ≈0.002006 / — |
| 2,048 | Texto simple | 3.71 | 2.46 | 3.37 / 2.37 | 327 MB | 0.000099 / 0.000066 |
| 2,048 | Logo monocromo | 26.66 | 2.89 | 26.25 / 2.75 | 329 MB | 0.000711 / 0.000077 |
| 2,048 | Logo 4 colores | 33.80 | 3.05 | 33.26 / 2.80 | 331 MB | 0.000902 / 0.000082 |
| 2,048 | Ilustración | 28.02 | 2.99 | 27.48 / 2.77 | 330 MB | 0.000748 / 0.000080 |
| 2,048 | Imagen compleja | 102.09 | 3.44 | 101.43 / 3.07 | 378 MB | 0.002723 / 0.000092 |
| 3,008 | Texto simple | 4.51 | 2.87 | 4.12 / 2.77 | 326 MB | 0.000177 / 0.000113 |
| 3,008 | Logo monocromo | 27.07 | 2.85 | 26.55 / 2.71 | 329 MB | 0.001060 / 0.000112 |
| 3,008 | Logo 4 colores | 33.73 | 3.02 | 33.18 / 2.77 | 333 MB | 0.001321 / 0.000119 |
| 3,008 | Ilustración | 28.04 | 3.00 | 27.54 / 2.78 | 330 MB | 0.001098 / 0.000118 |
| 3,008 | Imagen compleja | 126.02 | 3.94 | 125.39 / 3.56 | 390 MB | 0.004936 / 0.000155 |
| 3,072 | Todos | no configurable | — | — | — | — |
| 4,096 | Todos | no configurable | — | — | — | — |

Aunque AWS publica un máximo general de 10,240 MB, el endpoint real de esta cuenta rechazó 3,072 y 4,096 MB con `Member must have value less than or equal to 3008`. La petición sí llegó a `lambda.us-east-1.amazonaws.com`; no fue validación local del CLI. Se midió 3,008 MB como punto superior más cercano. Esto debe aclararse con AWS antes de depender de tamaños superiores, pero no bloquea la recomendación de 2,048 MB.

### Distribuciones frías

Cada celda está en orden `mínimo / mediana / p95 aprox. / máximo`, en segundos.

| MB | Caso | Init | Total frío | Ink/Stitch frío |
| ---: | --- | --- | --- | --- |
| 1,024 | Texto | 0.219 / 0.235 / 0.248 / 0.248 | 7.777 / 7.837 / 18.881 / 18.881 | 7.327 / 7.413 / 18.475 / 18.475 |
| 1,024 | Logo mono | 0.264 / 0.280 / 0.347 / 0.347 | 37.251 / 47.340 / 47.538 / 47.538 | 36.754 / 46.796 / 46.931 / 46.931 |
| 1,024 | Logo color | 0.237 / 0.710 / 0.920 / 0.920 | 47.731 / 47.877 / 58.779 / 58.779 | 46.496 / 46.530 / 58.083 / 58.083 |
| 1,024 | Ilustración | 0.171 / 0.246 / 0.277 / 0.277 | 35.117 / 48.587 / 49.225 / 49.225 | 34.579 / 47.941 / 48.532 / 48.532 |
| 2,048 | Texto | 0.119 / 0.235 / 0.266 / 0.266 | 2.720 / 3.711 / 4.677 / 4.677 | 2.530 / 3.374 / 4.287 / 4.287 |
| 2,048 | Logo mono | 0.255 / 0.278 / 0.317 / 0.317 | 21.340 / 26.658 / 28.601 / 28.601 | 20.897 / 26.248 / 28.167 / 28.167 |
| 2,048 | Logo color | 0.207 / 0.278 / 0.311 / 0.311 | 26.284 / 33.804 / 34.831 / 34.831 | 25.833 / 33.258 / 34.250 / 34.250 |
| 2,048 | Ilustración | 0.267 / 0.275 / 0.352 / 0.352 | 27.556 / 28.025 / 28.077 / 28.077 | 27.038 / 27.484 / 27.522 / 27.522 |
| 2,048 | Compleja | 0.203 / 0.294 / 0.323 / 0.323 | 99.930 / 102.090 / 130.789 / 130.789 | 99.281 / 101.426 / 130.059 / 130.059 |
| 3,008 | Texto | 0.207 / 0.263 / 0.265 / 0.265 | 3.275 / 4.506 / 4.599 / 4.599 | 2.978 / 4.124 / 4.211 / 4.211 |
| 3,008 | Logo mono | 0.256 / 0.322 / 0.365 / 0.365 | 26.832 / 27.068 / 27.474 / 27.474 | 26.421 / 26.547 / 26.993 / 26.993 |
| 3,008 | Logo color | 0.235 / 0.284 / 0.286 / 0.286 | 21.512 / 33.727 / 36.244 / 36.244 | 21.066 / 33.177 / 35.694 / 35.694 |
| 3,008 | Ilustración | 0.159 / 0.263 / 0.264 / 0.264 | 16.991 / 28.040 / 30.233 / 30.233 | 16.644 / 27.542 / 29.731 / 29.731 |
| 3,008 | Compleja | 0.225 / 0.243 / 0.253 / 0.253 | 121.099 / 126.020 / 126.065 / 126.065 | 120.458 / 125.391 / 125.413 / 125.413 |

### Distribuciones calientes

| MB | Caso | Total warm | Ink/Stitch warm |
| ---: | --- | --- | --- |
| 1,024 | Texto | 4.506 / 5.088 / 5.172 / 5.172 | 4.346 / 4.914 / 4.987 / 4.987 |
| 1,024 | Logo mono | 4.383 / 5.084 / 5.155 / 5.155 | 4.151 / 4.843 / 4.916 / 4.916 |
| 1,024 | Logo color | 4.667 / 4.722 / 5.405 / 5.405 | 4.249 / 4.313 / 4.964 / 4.964 |
| 1,024 | Ilustración | 4.228 / 5.354 / 5.570 / 5.570 | 3.885 / 4.971 / 5.188 / 5.188 |
| 2,048 | Texto | 1.900 / 2.461 / 2.910 / 2.910 | 1.827 / 2.373 / 2.805 / 2.805 |
| 2,048 | Logo mono | 2.533 / 2.886 / 2.961 / 2.961 | 2.409 / 2.746 / 2.809 / 2.809 |
| 2,048 | Logo color | 2.616 / 3.052 / 3.135 / 3.135 | 2.389 / 2.799 / 2.881 / 2.881 |
| 2,048 | Ilustración | 2.987 / 2.995 / 3.169 / 3.169 | 2.766 / 2.775 / 2.947 / 2.947 |
| 2,048 | Compleja | 3.347 / 3.436 / 3.995 / 3.995 | 2.992 / 3.070 / 3.610 / 3.610 |
| 3,008 | Texto | 2.014 / 2.872 / 3.194 / 3.194 | 1.936 / 2.771 / 3.091 / 3.091 |
| 3,008 | Logo mono | 2.801 / 2.853 / 2.899 / 2.899 | 2.661 / 2.714 / 2.759 / 2.759 |
| 3,008 | Logo color | 2.161 / 3.022 / 3.102 / 3.102 | 1.967 / 2.771 / 2.854 / 2.854 |
| 3,008 | Ilustración | 2.099 / 3.002 / 3.033 / 3.033 | 1.927 / 2.776 / 2.803 / 2.803 |
| 3,008 | Compleja | 3.788 / 3.941 / 4.214 / 4.214 | 3.396 / 3.555 / 3.830 / 3.830 |

Las medianas de validación/preview a 2,048 MB fueron, frío/caliente: texto 11/11 ms y 85/74 ms; logo mono 22/21 ms y 128/115 ms; logo color 38/37 ms y 222/210 ms; ilustración 29/28 ms y 200/188 ms; compleja 72/80 ms y 291/290 ms. El costo y la latencia están casi enteramente en Ink/Stitch.

Todos los casos completados conservaron exactamente la semántica del spike: medidas, puntadas, cambios de color, jumps y trims dentro de tolerancia; el lector Tajima y `pyembroidery` coincidieron. El caso complejo a 1,024 MB tuvo nueve timeouts fríos observados en CloudWatch: tres planeados y seis producidos por reintentos del cliente al expirar su timeout de lectura durante instrumentación. No se usaron como éxitos ni se intentaron warms.

### `/tmp`, aislamiento y concurrencia

| Caso | Archivos por job | Pico por job | Delta global frío máximo |
| --- | --- | ---: | ---: |
| Texto | SVG + DST + PNG | 28,555 B | 221,067 B |
| Logo mono | SVG + DST + PNG | 33,941 B | 329,717 B |
| Logo color | SVG + DST + PNG | 77,572 B | 464,049 B |
| Ilustración | SVG + DST + PNG | 68,259 B | 444,057 B |
| Compleja | SVG + DST + PNG | 251,870 B | 1,789,816 B |

El delta global incluye cachés/configuración que Ink/Stitch crea en su primera ejecución. Los temporales de job quedaron borrados en todas las salidas exitosas. En producción habrá además snapshot y raster preparados, por lo que estos bytes no deben convertirse en un límite de entrada; sí demuestran que los 512 MB gratuitos dejan varios órdenes de magnitud de margen.

La ráfaga a 2,048 MB y logo de cuatro colores produjo:

| Simultáneos | Éxitos | Entornos únicos | Duración min / med / max | Colisiones |
| ---: | ---: | ---: | --- | --- |
| 1 | 1/1 | 1 | 26.24 / 26.24 / 26.24 s | 0 |
| 5 | 5/5 | 5 | 25.60 / 34.01 / 34.36 s | 0 |
| 10 | 10/10 | 10 | 20.60 / 33.64 / 36.19 s | 0 |

Cada entorno ejecutó un Xvfb en `:99`; Lambda no procesa dos invocaciones simultáneas dentro del mismo entorno, y los entornos están aislados, por lo que no hubo conflicto de display. Cada job usó un `mkdtemp` distinto. El mismo contenedor también pasó el caso de texto con `docker --network none`, confirmando que el motor no necesita Internet.

Los datos completos están en [summary.json](aws-benchmark/runs/20260906000747-1367/summary.json), las invocaciones válidas en [invocations.jsonl](aws-benchmark/runs/20260906000747-1367/invocations.jsonl) y las observaciones AWS en [aws-observations.json](aws-benchmark/runs/20260906000747-1367/aws-observations.json).

## 2. Configuración recomendada

| Parámetro | V1 recomendada | Motivo |
| --- | --- | --- |
| Arquitectura | ARM64 | Imagen y resultados validados; menor tarifa de Lambda |
| Memoria | 2,048 MB | Reduce aproximadamente a la mitad los warms de 1,024 MB; 3,008 MB no mejora consistentemente y cuesta más |
| Timeout Lambda | 90 s | Máximo frío observado de las clases auto/review: 34.83 s; margen >2.5×. El caso complejo debe rechazarse en preflight |
| Timeout interno Ink/Stitch | 75 s | Deja 15 s para lectura S3, validación, publicación y estado |
| `/tmp` | 512 MB | Pico global observado 1.79 MB; es el mínimo incluido sin costo adicional |
| Reserved concurrency | 5 | La prueba 10/10 funcionó, pero cinco limita costo/explosiones y da ≈1.6 jobs/s calientes a 3 s/job |
| SQS batch | 1 | Un proceso pesado por invocación; evita que un fallo o timeout retenga más trabajos |
| Provisioned concurrency | 0 | Flujo asíncrono; pagar sandboxes ociosos no se justifica aún |
| VPC benchmark | Ninguna | Aisló el runtime y evitó introducir networking que no usa |

No hay una muestra suficiente para calcular p99: tres frías por celda no alcanzan. Para las clases admitidas, el proxy conservador es el máximo frío observado a 2,048 MB (34.83 s) más 158% de margen, de donde salen 90 s. Antes de GA hay que repetir con al menos cientos de diseños reales y revisar p95/p99. Si se permite que una imagen compleja llegue a Ink/Stitch, el máximo observado de 130.79 s invalida 90 s: esa clase debe detenerse en análisis o ir a un flujo separado de revisión.

Para producción sí hay una razón concreta para considerar VPC: impedir salida a Internet ante un input hostil. Puede usarse una VPC dedicada sin NAT, con endpoints gateway de S3 y DynamoDB; Lambda obtiene la imagen de ECR fuera del networking de la función y el event source mapping consume SQS. Esta variante debe rebenchmarkearse en preproducción. Si se acepta control lógico en vez de bloqueo de red, puede conservarse sin VPC; el motor ya demostró no requerir Internet. En ningún caso hace falta NAT Gateway.

## 3. Costos

Supuesto principal: mezcla uniforme de texto, logo mono, logo color e ilustración; la imagen compleja se rechaza antes del motor; 10% de jobs fríos y 90% calientes; 2,048 MB; sin Free Tier ni descuentos. Incluye compute y request de Lambda, no storage/cola/API.

| Jobs/mes | Compute + request Lambda |
| ---: | ---: |
| 100 | USD 0.013 |
| 1,000 | USD 0.130 |
| 10,000 | USD 1.300 |
| 100,000 | USD 13.003 |

Si 20% de los trabajos fueran el caso complejo y aun así se procesaran, el promedio sería USD 0.000175/job: USD 0.018, 0.175, 1.750 y 17.501 para los mismos volúmenes. Es una estimación de capacidad, no una razón para aceptar fotografías.

Costos separados de la arquitectura futura, con precios públicos de `us-east-1` y supuestos explícitos:

- ECR: una imagen comprimida de 0.400 GB × USD 0.10/GB-mes ≈ **USD 0.04/mes**; transferencia a Lambda en la misma región es gratuita: [precios de ECR](https://aws.amazon.com/ecr/pricing/).
- CloudWatch Logs: con 2 KB estructurados/job, 100,000 jobs son ≈0.2 GB, hasta **USD 0.10** a la tarifa inicial de USD 0.50/GB, antes de cualquier franquicia. Alarmas y métricas personalizadas se cotizan aparte: [precios de CloudWatch](https://aws.amazon.com/cloudwatch/pricing/).
- SQS Standard: aproximando send + receive + delete, 300,000 requests por 100,000 jobs cuestan **USD 0.12** antes del millón gratuito, a USD 0.40/millón: [precios de SQS](https://aws.amazon.com/sqs/pricing/).
- DynamoDB on-demand: suponiendo cuatro writes y dos reads de hasta 1 KB por job, 100,000 jobs cuestan aproximadamente **USD 0.275** antes de franquicias, usando USD 0.625/millón de writes y USD 0.125/millón de reads: [precios de DynamoDB](https://aws.amazon.com/dynamodb/pricing/on-demand/).
- S3 Standard: suponiendo 80 KB entre DST, preview y metadata, 100,000 jobs agregan ≈8 GB o **USD 0.18/mes** de almacenamiento; tres PUT por job agregan ≈USD 1.50. Retención, versiones y GET del taller cambian el total: [precios de S3](https://aws.amazon.com/s3/pricing/).

No se imputa NAT porque el diseño no lo necesita. Tampoco se incluyen API Gateway, KMS, soporte, impuestos ni revisión humana.

## 4. Lambda vs Fargate

**Decisión: Lambda Container para V1. Fargate RunTask queda como escape, no como servidor permanente.**

| Criterio | Lambda medido | Fargate RunTask |
| --- | --- | --- |
| Arranque + primer motor | 2.7–34.8 s en clases admitidas; 99.9–130.8 s compleja | No medido en esta fase; incluye pull y arranque de task |
| Caliente | 1.9–3.2 s en clases admitidas a 2 GB | Cada RunTask nuevo vuelve a arrancar salvo que se agrupen trabajos |
| RAM real | 318–390 MB | Mínimo práctico 1 vCPU/2 GB para comparar |
| CPU | 2 GB mejora mucho frente a 1 GB; 3,008 MB no aporta de forma consistente | CPU/memoria explícitas; puede beneficiar motores multihilo, no demostrado aquí |
| Costo | ≈USD 0.00013/job con mezcla 10/90 | ARM 1 vCPU/2 GB tiene mínimo facturable de 60 s: ≈USD 0.000658/task, antes de red/logs |
| Escalado | SQS + concurrencia reservada; 10 simultáneos probados | RunTask on-demand, cuotas/capacidad ECS y más piezas operativas |
| Límite | 15 min | Adecuado para jobs mayores y más disco |
| Xvfb/aislamiento | 16/16 éxitos de concurrencia, un sandbox por job | Contenedor aislado por task; también adecuado |

Fargate factura desde que empieza a descargar la imagen y tiene mínimo de un minuto en Linux; para ARM en N. Virginia AWS publica USD 0.0000089944/vCPU-s y USD 0.0000009889/GB-s: [precios de Fargate](https://aws.amazon.com/fargate/pricing/). Sería preferible si los diseños admitidos empiezan a acercarse repetidamente a 90–180 s, requieren más de 10 GB de imagen, más disco o un motor que aproveche varios vCPU. Nada de eso aparece en los casos V1 admitidos.

## 5. Arquitectura AWS V1

```text
Editor estático (S3 + CloudFront)
  │
  ├─ crea snapshot semántico EmbroideryDesign en mm
  ├─ pide subida y hace PUT a snapshot staging privado
  └─ POST /bordados/jobs {snapshotKey, snapshotSha256, sideId, profileVersion}
          │
          v
API de bordado dedicada (Lambda ZIP pequeña, no el worker)
  ├─ autentica comprador o sesión invitada firmada
  ├─ valida propiedad, tamaño, side/product/profile
  ├─ canonicaliza y calcula designHash/jobId
  └─ Put condicional DynamoDB: QUEUED
          │
          v
DynamoDB Stream -> EventBridge Pipe -> SQS Standard
                                      │
                                      v
                              Lambda Container ARM64
                              reserved concurrency = 5
                              batch = 1
                                      │
                ┌─────────────────────┼─────────────────────┐
                v                     v                     v
          sanitizar/preflight    Ink/Stitch + Xvfb    validar 2 lectores
                │                                           │
                └─────────────────────┬─────────────────────┘
                                      v
                         S3 privado, prefijo de attempt
                         ├── diseno.dst
                         ├── preview.png
                         └── bordado.json
                                      │
                                      v
                       Update condicional DynamoDB
                     READY | REVIEW | REJECTED | FAILED
                                      │
                                      v
                 GET /bordados/jobs/{jobId} por polling
```

El stream/pipe resuelve el hueco transaccional “Dynamo escrito pero SQS no enviado”. La entrega sigue siendo al menos una vez, así que el worker siempre reclama con una actualización condicional y verifica el estado. AWS exige tratar SQS/Lambda como idempotente porque puede haber duplicados: [integración Lambda con SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html).

El bucket de artefactos debe ser nuevo y privado; `kustto-publico-prod` está detrás de CloudFront y no es el lugar correcto para archivos de máquina. El taller obtiene URLs firmadas cortas desde su API después de comprobar que el pedido le pertenece.

Seguridad del worker:

- no recibe URLs, SVG ni rutas arbitrarias desde SQS; sólo `jobId`, y resuelve bucket/key prefijados desde DynamoDB;
- verifica firma/MIME, bytes, píxeles, objetos y dimensiones antes del motor;
- parser con allowlist: sin `<script>`, eventos, `foreignObject`, referencias externas, CSS remoto, `<image>` ni `<text>` en el SVG interno final;
- argumentos de proceso como array, nunca shell; variables del motor fijadas por imagen;
- filesystem raíz de Lambda de sólo lectura, usuario runtime de privilegio mínimo y un `mkdtemp` por attempt;
- timeout interno con terminación del grupo de procesos y limpieza en `finally`;
- permisos IAM sólo a la tabla, cola y prefijos S3 de bordado; sin acceso a buckets/tablas generales;
- límites de descompresión y protección contra image bombs antes de decodificar por completo;
- imagen por digest, SBOM, escaneo ECR y versiones/hashes incluidos en metadata.

## 6. DynamoDB Job model

Conviene una tabla dedicada `kustto-embroidery-jobs-prod`, on-demand, con `pk`/`sk`, stream `NEW_AND_OLD_IMAGES`, PITR y TTL. Estos jobs tienen escrituras, leases y caducidad diferentes a `kustto-prod`; además sus tres GSI ya están comprometidos con productos/pedidos.

`jobId` se deriva de 160 bits del `designHash`, por ejemplo `emb_<base32>`. El item canónico no pertenece a un usuario: puede reutilizar artefactos sin duplicar compute. Un vínculo separado autoriza a cada propietario.

```ts
type EmbroideryJob = {
  pk: `JOB#${string}`
  sk: "META"
  entity: "EMBROIDERY_JOB"
  jobId: string
  designHash: `sha256:${string}`
  planHash: `sha256:${string}`
  status: "QUEUED" | "PROCESSING" | "READY" | "REVIEW" | "REJECTED" | "FAILED"

  snapshotKey: string
  snapshotSha256: string
  productId: string
  templateVersion: string
  sideId: string
  physical: { widthUm: number; heightUm: number; xUm: number; yUm: number }

  engine: { name: "inkstitch"; version: "3.3.0"; imageDigest: string }
  codeVersion: string
  validatorVersion: string
  profileId: string
  profileVersion: string

  attempt: number
  leaseId?: string
  leaseExpiresAt?: string
  createdAt: string
  queuedAt: string
  startedAt?: string
  completedAt?: string

  decision?: "accept" | "review" | "reject"
  confidence?: number
  metrics?: { stitchCount: number; colorCount: number; jumps: number; trims: number; widthMm: number; heightMm: number }
  artifacts?: {
    attemptId: string
    dst: { key: string; sha256: string; bytes: number }
    preview: { key: string; sha256: string; bytes: number }
    metadata: { key: string; sha256: string; bytes: number }
  }
  issues?: Array<{ code: string; severity: "warning" | "error"; publicMessageKey: string }>
  errorCode?: string
  internalErrorRef?: string
  expiresAt?: number
}

type EmbroideryOwnerLink = {
  pk: `OWNER#${string}` // Cognito sub o id de sesión invitada firmado
  sk: `JOB#${string}`
  jobId: string
  orderDraftId?: string
  createdAt: string
  expiresAt: number
}
```

`PutItem` con `attribute_not_exists(pk)` sobre el job determinista hace el lock de idempotencia. Si ya existe, la API crea únicamente el owner link y devuelve el estado/artefactos existentes. Nunca se expone un job sólo porque el cliente conoce su hash.

### Estados y transiciones

| Desde | Hacia | Actor/condición | Retry |
| --- | --- | --- | --- |
| inexistente | `QUEUED` | API, después de validar snapshot/hash; put condicional | No duplica: devuelve job existente |
| `QUEUED` | `PROCESSING` | Worker, update condicional y lease no vencido | Mensaje duplicado sale sin efecto |
| `PROCESSING` | `QUEUED` | Worker/reconciliador ante error transitorio y attempts restantes | Automático, con backoff SQS |
| `PROCESSING` | `READY` | Worker; decisión accept, tres artefactos escritos, releídos y hasheados | Terminal de generación |
| `PROCESSING` | `REVIEW` | Worker; salida válida con incertidumbre | Espera humano, no reintenta motor por sí sola |
| `PROCESSING` | `REJECTED` | Preflight o motor; regla fabricable no satisfecha | Terminal; editar crea nuevo hash |
| `PROCESSING` | `FAILED` | Intentos agotados/error interno no atribuible al diseño | Terminal automático; redrive privilegiado y auditado |
| `REVIEW` | `READY` | Taller/admin aprueba exactamente esos hashes | Terminal |
| `REVIEW` | `REJECTED` | Taller/admin rechaza con código público | Terminal |

Un lease vencido permite recuperar un `PROCESSING` abandonado. `FAILED -> QUEUED` sólo existe como operación de soporte explícita que incrementa attempt; no es un loop automático oculto.

### Hash estable

Se serializa con JSON Canonicalization Scheme; medidas y matrices se convierten a enteros en micrómetros para evitar diferencias de punto flotante. `designHash = SHA-256` de:

1. `schemaVersion` de `EmbroideryDesign`;
2. objetos visibles en z-order estable, ids estables, tipo, geometría/paths, texto Unicode, fuente y versión/sha256 del archivo de fuente, colores, opacidad, clip paths y matriz transform completa;
3. cada raster sustituido por su `sourceAssetSha256`, nunca por una URL ni base64;
4. `productId`, versión de plantilla, `sideId`, técnica y mapping físico completo del lado en micrómetros;
5. `profileId` y `profileVersion`, incluyendo taller/tela/máquina resueltos;
6. paleta/catálogo de hilo y versión del mapper;
7. versión de preparación/segmentación, código del worker, Ink/Stitch 3.3.0, digest exacto de imagen y versión del validador;
8. formato de salida, por ejemplo `tajima-dst-v1`.

Cambiar geometría, texto/fuente, tamaño/escala, espejo, rotación, perfil, tela, lado o dimensiones físicas genera nuevo hash y redigitización. Un `planHash` secundario puede excluir sólo traslación pura y presentación del preview para reutilizar en el futuro coordenadas locales; `designHash` sí incluye la colocación exacta y sigue atando el artefacto al snapshot. V1 puede conservar la regla más segura: toda transformación crea job nuevo. **Nunca se escala un DST existente.**

## 7. SQS/DLQ

- Cola Standard: `kustto-embroidery-jobs-prod`.
- DLQ: `kustto-embroidery-jobs-dlq-prod`.
- Batch size `1`, batch window `0`.
- Lambda timeout `90 s`; visibility timeout inicial `540 s` (6×), sin mensaje mayor a unos pocos KB.
- `maxReceiveCount = 3`; backoff lo controla la reaparición por visibility y el contador del job.
- Event source mapping con `MaximumConcurrency = 5` y Lambda reserved concurrency `5`; no provisioned pollers.
- Respuesta parcial de batch activada aunque el batch sea uno, para conservar el patrón si cambia.
- Retención principal 4 días; DLQ 14 días; alarma si `ApproximateNumberOfMessagesVisible > 0` en DLQ.
- El mensaje contiene sólo `{jobId, designHash, schemaVersion}`. Snapshot y parámetros se leen del registro canónico.

Reserved concurrency pone un máximo real y no tiene costo adicional; AWS explica que limita y reserva capacidad a la vez: [concurrencia reservada](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html). Con 1,000 solicitudes, la cola absorbe el pico en vez de arrancar 1,000 Ink/Stitch.

## 8. S3

Bucket privado y versionado, por ejemplo `kustto-production-artifacts-prod`, con Block Public Access, cifrado y policy exclusiva para API/worker/taller. Keys:

```text
embroidery/v1/snapshots/{ownerId}/{snapshotId}/snapshot.json
embroidery/v1/staging/{jobId}/{attemptId}/geometria.svg
embroidery/v1/staging/{jobId}/{attemptId}/diseno.dst
embroidery/v1/staging/{jobId}/{attemptId}/preview.png
embroidery/v1/staging/{jobId}/{attemptId}/bordado.json

embroidery/v1/artifacts/sha256/{hash[0:2]}/{designHash}/{attemptId}/diseno.dst
embroidery/v1/artifacts/sha256/{hash[0:2]}/{designHash}/{attemptId}/preview.png
embroidery/v1/artifacts/sha256/{hash[0:2]}/{designHash}/{attemptId}/bordado.json
```

S3 no publica tres objetos de manera transaccional. El worker escribe staging, relee y valida cada objeto, calcula checksum, copia a keys finales inmutables y sólo entonces hace un update condicional de DynamoDB con las tres keys/hashes y el estado. **El item DynamoDB es el commit marker atómico**; ningún consumidor usa un prefijo que el job aún no publicó. `attemptId` evita que un retry sobrescriba una salida previa.

Lifecycle: staging incompleto 1 día, attempts fallidos 7 días, snapshots invitados sin pedido 30 días; outputs ligados a pedido según la política legal/comercial. No borrar un artefacto sólo porque venció un owner link si un pedido lo referencia.

## 9. EmbroideryProfile

El perfil es configuración de fabricación versionada, no constantes globales. Una versión publicada es inmutable.

```ts
type EmbroideryProfile = {
  id: string
  version: string
  status: "draft" | "test-sew" | "active" | "retired"
  scope: {
    providerId: string
    machineId?: string
    fabricId?: string
    productId?: string
    sideId?: string
    hoopId?: string
  }
  area: { maxWidthMm: number; maxHeightMm: number }
  palette: { catalogId: string; catalogVersion: string; maxColors: number }
  running: { stitchLengthMm: number; maxStitchLengthMm: number; beanRepeats?: number }
  satin: { minWidthMm: number; maxWidthMm: number; spacingMm: number; splitAboveMm?: number }
  fill: { spacingMm: number; maxStitchLengthMm: number; angleStrategy: string }
  underlay: { running: string[]; satin: string[]; fill: string[]; minAreaMm2?: number }
  pullCompensation: { runningMm: number; satinMm: number; fillMm: number }
  text: { allowedFontVersions: string[]; minHeightMm: number; minStemWidthMm: number; minCounterMm: number }
  raster: { maxBytes: number; maxPixels: number; maxComponents: number; minRegionAreaMm2: number }
  guardrails: { maxStitchCount: number; maxJumps: number; maxTrims: number; maxColorChanges: number }
  decisions: { autoClasses: string[]; reviewClasses: string[]; rejectClasses: string[]; confidenceThresholds: object }
  evidence: { testSewRequired: true; approvedAt?: string; approvedBy?: string; sampleIds: string[] }
  engineCompatibility: { inkstitch: "3.3.0"; preparationVersion: string }
}
```

Los números del spike son semillas para `draft`, no valores `active`. Densidad, underlay, compensación, mínimos tipográficos, satin/fill y límites de puntadas requieren matriz de test sew por tela, backing, hilo, aguja, máquina, bastidor y velocidad.

Decisión V1:

- `accept`: texto en fuentes/tamaños ya cosidos y logos planos simples;
- `review`: ilustración simplificada o incertidumbre de oclusión/orden;
- `reject`: fotografía, degradado complejo, exceso de componentes, dimensiones fuera del bastidor o imposibilidad de cumplir el perfil.

## 10. API

Como Kustto permite carrito/pedido invitado, la API debe soportar Cognito **o** una sesión invitada firmada y rotatoria. El identificador no autoriza por sí solo. Se recomienda una Lambda API pequeña separada del contenedor pesado.

### `POST /bordados/snapshots`

Entrada:

```json
{
  "contentLength": 183420,
  "sha256": "...",
  "schemaVersion": 1
}
```

Salida `201`: `{ "snapshotId": "...", "key": "...", "uploadUrl": "...", "expiresIn": 300 }`. La URL firma content length/checksum y sólo el prefijo del propietario.

### `POST /bordados/jobs`

```json
{
  "snapshotId": "...",
  "snapshotSha256": "...",
  "productId": "...",
  "templateVersion": "...",
  "sideId": "front",
  "profileVersion": "provider:machine:fabric:v1",
  "orderDraftId": "..."
}
```

La API relee/canonicaliza el snapshot, resuelve el perfil autorizado y calcula el hash; no confía en un hash calculado por el navegador. Responde `202` para nuevo/reintentando o `200` si el hash ya está `READY|REVIEW|REJECTED`, siempre con `{jobId,status,statusToken,retryAfterMs}`. No retorna keys S3 internas.

### `GET /bordados/jobs/{jobId}`

Requiere JWT o `statusToken` ligado a owner/job. Devuelve:

```json
{
  "jobId": "emb_...",
  "status": "PROCESSING",
  "progress": { "stage": "digitizing" },
  "decision": null,
  "confidence": null,
  "previewUrl": null,
  "issues": [],
  "retryAfterMs": 2000
}
```

En `READY|REVIEW`, `previewUrl` es firmada y corta. DST/metadata sólo se firman para el taller o flujo autorizado. Errores públicos son códigos como `IMAGE_TOO_COMPLEX`, `OUTSIDE_HOOP`, `TEXT_TOO_SMALL`, `UNSUPPORTED_GRADIENT`, `PROCESSING_FAILED`; stderr, stack, rutas y mensajes internos de Ink/Stitch sólo quedan bajo `internalErrorRef` en logs.

Endpoints futuros, no V1 inicial: revisión del taller `POST /proveedores/bordados/jobs/{jobId}/decision` con `{decision, reasonCode}` y redrive admin auditado.

## 11. Frontend

Sin convertir la página estática en servidor, el navegador puede subir el snapshot y hacer polling:

1. `Preparando bordado…`: análisis local, snapshot y upload.
2. `En cola…`: `QUEUED`, muestra que puede tardar y permite salir sin perder el job.
3. `Preparando puntadas…`: `PROCESSING`; polling 2 s, luego backoff hasta 5 s, pausa en background y reanuda al volver.
4. `READY`: preview de puntadas, medidas, colores y aviso de que tamaño/perfil quedan congelados; ya permite agregar al carrito.
5. `REVIEW`: preview y mensaje “El taller debe validar este bordado antes de fabricarlo”; no prometer aprobación ni cobrar como listo sin la regla comercial acordada.
6. `REJECTED`: razón entendible y acciones concretas —simplificar colores/componentes, quitar degradado, aumentar texto o volver al editor—.
7. `FAILED`: “No pudimos preparar el archivo”; retry seguro con el mismo snapshot/hash o soporte, sin stderr.

Navegar fuera no cancela el job; `jobId` y token se conservan junto al borrador de IndexedDB. Cualquier cambio invalidante muestra que el preview anterior ya no corresponde y crea un hash nuevo. No se escala el DST desde canvas.

## 12. Riesgos pendientes

1. **Test sew físico:** es el bloqueo principal. Los cuatro casos no rechazados deben coserse en telas objetivo y evaluarse por tensión, legibilidad, registro, rigidez y push/pull.
2. **Perfiles por tela/taller/máquina:** no hay límites productivos aprobados; los guardrails actuales son provisionales.
3. **Fuentes:** el spike usa centerlines controladas, no cualquier fuente Fabric. V1 necesita fuentes pre-digitizadas/versionadas o una allowlist cosida por rango de tamaño.
4. **Revisión humana:** falta definir SLA, propiedad, precio y qué ocurre con carrito/pago mientras el job está `REVIEW`.
5. **Licencia:** Ink/Stitch 3.3.0 es GPL-3.0. Hay que conservar avisos y código fuente correspondiente del componente distribuido y validar obligaciones del modelo de despliegue con asesoría legal; el aislamiento del servicio no sustituye esa revisión.
6. **Primera ejecución del motor:** existe una penalización de 20–130 s que `Init Duration` no refleja. Investigar qué cachés genera Ink/Stitch y si pueden hornearse reproduciblemente sin datos del usuario.
7. **p99 desconocido:** tres cold starts por caso sólo permiten escoger un envelope conservador; se necesita telemetría real antes de SLA.
8. **Límite inesperado de memoria:** esta cuenta rechazó >3,008 MB pese a la documentación general. Abrir caso con AWS antes de necesitar más.
9. **Seguridad de parsers nativos:** SVG/raster no confiable requiere fuzzing, límites de recursos, escaneo de imagen y parcheo reproducible.
10. **VPC sin NAT:** es útil para bloqueo de egress, pero debe medirse antes de producción y necesita endpoints/policies correctos.
11. **DST no transporta toda la intención:** orden de hilos, perfil, decisiones y preview deben acompañarlo siempre en `bordado.json`.
12. **Observabilidad/costo real:** instrumentar con Embedded Metric Format `jobs`, `ready`, `review`, `rejected`, `failed`, `processingMs`, `engineMs`, `cold`, `stitchCount`, `trims`, `jumps`, `retries`, `dlq`, `maxMemoryUsedMb`, `reviewRate`, `rejectRate`, `failureRate` y `costPerJob`; alarmar DLQ, failureRate, age of oldest y p95.

## 13. Próximo PR recomendado

El primer PR productivo debería ser un **vertical backend cerrado por feature flag, sin tocar editor/checkout/pedidos/taller/láser**:

1. Añadir contratos TypeScript/Python versionados de `EmbroideryDesign`, `EmbroideryProfile`, job, estados, issues públicos y canonicalización/hash, con fixtures de los cinco casos.
2. Añadir infraestructura declarativa para ECR por digest, bucket privado de artefactos, tabla dedicada con stream/PITR/TTL, EventBridge Pipe, SQS/DLQ, Lambda Container ARM64 2,048 MB/90 s/512 MB/concurrency 5, roles mínimos, lifecycle, logs y alarmas. Todo deshabilitado para tráfico público mediante `KUSTTO_EMBROIDERY_ENABLED=false`.
3. Convertir el handler del benchmark en worker real que sólo lee `jobId`, reclama lease, valida snapshot preparado, ejecuta Ink/Stitch con timeout, publica tres artefactos y aplica transiciones condicionales/idempotentes.
4. Implementar una API interna de prueba para crear/consultar jobs con fixtures, todavía sin rutas de editor ni capacidad de compra.
5. Ejecutar integración en una cuenta/stack de staging, incluyendo duplicados SQS, retry, timeout, DLQ, cleanup, sin red y concurrencia cinco.
6. Fijar SBOM, SHA de Ink/Stitch, escaneo ECR y documentación GPL en el release.

El criterio de merge sería: mismos cinco resultados semánticos, ningún artefacto visible antes del commit DynamoDB, replay idempotente, `REJECTED` para compleja antes del motor productivo, IAM sin acceso a recursos generales y teardown reproducible. La integración visual y comercial queda para un PR posterior, después del test sew y aprobación de perfiles.

## Limpieza y reproducibilidad

La Lambda, el rol, el log group y el repositorio ECR temporales se eliminaron el 6 de septiembre de 2026 a las 00:59:27 UTC. La verificación posterior devolvió Lambda ausente, ECR ausente, IAM ausente y cero log groups con ese nombre. Se conservan localmente el [Dockerfile](aws-benchmark/Dockerfile), [handler](aws-benchmark/handler.py), [orquestador](aws-benchmark/run_matrix.py), [script de despliegue](aws-benchmark/deploy.sh), [script de limpieza](aws-benchmark/cleanup.sh), resultados y digest. Nada productivo fue usado como destino de escritura.
