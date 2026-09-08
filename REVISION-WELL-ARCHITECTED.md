# Revisión Well-Architected — Kustto

**Fecha:** 5 de septiembre de 2026 · **Criticidad:** estándar (pre-lanzamiento)
**Lente:** Serverless · **Cuenta:** 467685081574 · **Región:** us-east-1

## Auditoría de cobertura
- BP evaluados: **307 / 307**
- Iteraciones: 1 pasada por pilar (OPS → SEC → REL → PERF → COST → SUS)
- Distribución: 31 Implemented · 105 Partially Implemented · 110 Not Implemented · 22 Not Applicable · 39 Cannot Determine

> **Sobre la evidencia.** Todo lo marcado *Not Implemented* se apoya en una consulta viva a la
> cuenta de AWS o en una línea concreta del repositorio, citada en la fila. Lo que no se pudo
> determinar —procesos de equipo, contratos, decisiones de negocio— está como *Cannot Determine*
> con el dato que haría falta, no como incumplimiento. Los cálculos de capacidad de la sección
> final están marcados **(estimación)** cuando salen de un modelo y no de una medición: este
> sistema **nunca se ha sometido a una prueba de carga**, así que ningún número de umbral está
> medido.

## Resumen ejecutivo

Kustto es un marketplace serverless bien construido en lo que respecta al **diseño**: tabla única
con acceso por llave y sin Scan, separación por audiencia en cinco funciones, frontera de rutas
públicas enumerada una a una, HMAC en tiempo constante para el webhook, y un nivel de
documentación del *por qué* muy por encima de lo normal (`ESTADO.md`, `CLAUDE.md`, cabeceras de
`infra/*.sh`). Varias decisiones difíciles están tomadas y razonadas por escrito, con el criterio
de cuándo revisarlas.

Lo que falta no es diseño: es **operación**. El sistema no puede escalar, no avisa cuando falla,
y no se puede recuperar.

Tres hechos medidos hoy en la cuenta lo resumen:

1. **La cuota de Lambda es de 10 ejecuciones concurrentes** para toda la cuenta. No 1000. Ese
   número, y no la arquitectura, es lo que decide la escala máxima actual.
2. **SES está en sandbox**: 200 correos al día, uno por segundo, y sólo a direcciones verificadas.
   Los correos de pedido no le llegan hoy a un comprador real.
3. **Cero alarmas y cero temas SNS.** Cuando algo de lo anterior falle, nadie se entera.

A eso se suman dos fallos de configuración presentes en producción ahora mismo, encontrados
durante la revisión y que no son parte del framework:

- `KUSTTO_SITIO` está sin definir, así que **todos los enlaces de los correos apuntan a
  `http://localhost:3000`** (`correo.ts:63-68` cae a `KUSTTO_ORIGEN`).
- **Skydropx apunta al host de sandbox** (`https://sb-pro.skydropx.com`) en las dos Lambdas de
  producción.

## Cuadro por pilar

| Pilar | Puntuación | Preguntas | Fortaleza | Hueco principal |
|---|---|---|---|---|
| Excelencia operativa | 2/5 | 11/11 | Documentación del porqué, decisiones trazadas | Sin CI, sin entorno de pruebas, sin alarmas |
| Seguridad | 2/5 | 11/11 | Frontera de rutas explícita, HMAC correcto, roles acotados | Sin CloudTrail, usuario IAM con AdministratorAccess y dos llaves, secretos en claro |
| Fiabilidad | 1/5 | 13/13 | Servicios gestionados multi-AZ, transacción con límite comprobado | Cuota de 10, sin idempotencia, PITR apagado, sin DLQ |
| Eficiencia | 2/5 | 5/5 | Elección de servicios razonada por coste | Sin caché en el catálogo, partición caliente, nunca medido |
| Coste | 3/5 | 11/11 | Pago por uso, análisis de coste en decisiones de arquitectura | Sin presupuesto, sin anomalías, logs infinitos |
| Sostenibilidad | 3/5 | 6/6 | Todo gestionado y bajo demanda | x86 en vez de Graviton, PriceClass_All, stream sin consumidor |

**Madurez global: 2/5.** Diseño sólido, operación ausente.

## Arquitectura

```plantuml
@startuml
skinparam componentStyle rectangle
actor Comprador
actor Taller
cloud Internet

package "Frontera pública" {
  [CloudFront kustto-sitio] as CF1
  [CloudFront backoffice] as CF2
  note right of CF1 : sin WAF, sin logs\nPriceClass_All
}

database "S3" {
  [kustto-sitio-prod] as S3S
  [kustto-publico-prod] as S3P
  [kustto-privado-prod] as S3V
  note right of S3S : sin versionado
}

package "API" {
  [API GW HTTP kd8ydpp2c6] as AGW
  [API GW WS 1mdi47dyv4] as WS
  note right of AGW : sin throttling\nsin logs de acceso\nmétricas detalladas OFF\nCORS admite localhost
}

package "Cómputo (cuota: 10 concurrentes TOTAL)" {
  [lambda admin 512MB/15s] as LA
  [lambda compradores 512MB/15s] as LC
  [lambda proveedores 512MB/29s] as LP
  [lambda correo 512MB/30s] as LM
  [lambda eventos 256MB/10s] as LE
  note bottom : sin DLQ, sin X-Ray,\nsin concurrencia reservada
}

database "DynamoDB kustto-prod" as DDB
note right of DDB : PAY_PER_REQUEST\n3 GSI proyección ALL\nstream ON sin consumidor\nPITR DESACTIVADO

cloud "Cognito x3" as COG
cloud "SES (SANDBOX 200/día)" as SES
cloud "Skydropx (SANDBOX, 2 rps)" as SKY

Comprador --> CF1
Taller --> CF2
CF1 --> S3S
CF1 --> S3P : /medios /mockups
Comprador --> AGW : llamada DIRECTA, sin CDN
Taller --> WS
AGW --> LA
AGW --> LC
AGW --> LP
WS --> LE
LA --> DDB
LC --> DDB
LP --> DDB
LA --> SES : SÍNCRONO
LA --> SKY : SÍNCRONO, sin timeout
LA ..> COG
DDB ..> [stream sin consumidor] #red
@enduml
```

### Flujos de datos

1. **Ver catálogo** — navegador → API Gateway → λ admin → Query a `gsi2` partición
   `PRODUCT_ESTADO#activo` → respuesta con el catálogo entero. **Sin caché en ningún punto.**
2. **Diseñar** — el arte se sube con URL prefirmada directo a S3; la Lambda sólo firma. Bien.
3. **Cotizar envío** — navegador → λ admin → **espera a Skydropx (~5 s)** → devuelve id.
4. **Pagar** — navegador → λ admin → GetItem por producto → `TransactWriteItems` (compra + 1 pedido
   por taller + candado de folio + descuentos de stock, tope 100) → **SES síncrono** → respuesta.
5. **Avisar al taller** — λ admin → API Gateway WebSocket → λ eventos → conexiones en DynamoDB.

## Análisis de capacidad

> **Todos los umbrales de esta sección son estimaciones.** Salen de aplicar la ley de Little
> (concurrencia = tasa × duración) a las cuotas medidas, con duraciones supuestas porque **no hay
> métricas**: las métricas detalladas de API Gateway están apagadas, X-Ray está en `PassThrough` y
> no existe ninguna prueba de carga. El orden en que rompen las cosas es fiable; los números
> exactos hay que medirlos.

### Supuestos declarados

| Supuesto | Valor | Origen |
|---|---|---|
| Petición de catálogo | ~100 ms | Estimación: un Query por llave sobre 4 ítems |
| Petición de checkout | ~2,5 s | Estimación: GetItems + TransactWrite + 2 correos SES en serie |
| Cotización de envío | ~5 s | **Medido y documentado** en `ESTADO.md` ("Cotizar tarda ~5 s") |
| Usuario navegando | 1 petición cada 10 s | Estimación de sesión típica de catálogo |
| Correos por pedido | 2 (comprador y taller) | `plantillas.ts` |

### Qué pasa con N usuarios concurrentes

| Usuarios | Peticiones/s (est.) | Concurrencia Lambda necesaria | Veredicto |
|---|---|---|---|
| **100** | 10 | 1 | ✅ Funciona con holgura. Techo real: SES y el catálogo del día |
| **1 000** | 100 | **10** | ⚠️ **Justo en la cuota.** Cualquier pico da 429. Sin alarma que lo diga |
| **10 000** | 1 000 | 100 | ❌ **Diez veces por encima.** ~90 % de peticiones rechazadas |
| **100 000** | 10 000 | 1 000 | ❌ Además roza el límite por defecto de API Gateway (10 000 rps) y la partición caliente de `gsi2` |

### Qué pasa con N pedidos por minuto

| Pedidos/min | Correos/min | Concurrencia Lambda | Qué rompe primero |
|---|---|---|---|
| **10** | 20 | 0,4 | 🔴 **SES: 14 400 pedidos/día contra un tope de 200 correos/día.** Rompe el primer día |
| **100** | 200 | 4 | 🔴 SES por tasa (3,3/s contra 1/s) **y** por cuota diaria |
| **1 000** | 2 000 | **42** | 🔴 Cuota de Lambda (4× por encima de 10). Con la cuota subida: SES sigue roto |
| **10 000** | 20 000 | **417** | 🔴 Partición caliente de stock si el producto es popular; transacción a 2× WCU |

---

### Cuello de botella 1 — Cuota de Lambda de 10 concurrentes

1. **Qué rompe primero.** Todo a la vez: catálogo, checkout y panel del taller comparten las mismas
   10 ejecuciones. No hay mamparo entre ellos.
2. **Umbral aproximado.** ~10 peticiones/s sostenidas, o **4 checkouts simultáneos** (2,5 s cada
   uno ocupan 10 slots). Equivale a ~1 000 usuarios navegando *(estimación)*.
3. **Por qué pasa.** La cuenta nunca tuvo la cuota subida: `UnreservedConcurrentExecutions: 10`.
   Ninguna función tiene concurrencia reservada, así que se la quitan entre ellas.
4. **Impacto en el usuario.** `429 TooManyRequestsException`. Un comprador que paga ve un error;
   **un pedido puede quedar a medias entre el `TransactWriteItems` y el correo**.
5. **Cómo detectarlo.** `AWS/Lambda` → `Throttles > 0` (hoy no hay alarma). También
   `ConcurrentExecutions` acercándose a 10, y `5XXError` en API Gateway.
6. **Cómo arreglarlo.** Service Quotas → subir *Concurrent executions* a 1 000. Después reservar:
   `aws lambda put-function-concurrency --function-name kustto-admin --reserved-concurrent-executions 200`.
7. **¿Ahora o después?** **Ahora, y hoy.** AWS tarda de horas a días en aprobarlo. Es el único
   punto de esta lista donde esperar tiene un coste que no controlas.

### Cuello de botella 2 — SES en sandbox

1. **Qué rompe primero.** Los correos transaccionales: confirmación de pedido y aviso al taller.
2. **Umbral aproximado.** **200 correos al día = ~100 pedidos al día.** Y 1 correo/s de tasa.
   Este umbral es **medido**, no estimado (`sesv2 get-account`).
3. **Por qué pasa.** La cuenta nunca salió del sandbox de SES. Además, en sandbox **sólo se
   entrega a direcciones verificadas**: un comprador real no recibe nada.
4. **Impacto en el usuario.** El comprador paga y no recibe confirmación; el taller no se entera
   del pedido salvo que tenga el panel abierto (WebSocket).
5. **Cómo detectarlo.** `AWS/SES` → `Reputation.*`, `Send`, y sobre todo **`Rejects`** y el error
   `AccountSendingPausedException` en los logs de `kustto-admin`.
6. **Cómo arreglarlo.** Solicitud de salida de sandbox en la consola de SES (justificar caso de
   uso y política de rebotes). Y **sacar el envío del camino de la petición**: el stream de
   DynamoDB ya está encendido y sin consumidor — ésa era su razón de ser.
7. **¿Ahora o después?** **Ahora.** La aprobación también tarda, y sin esto no hay negocio.

### Cuello de botella 3 — Skydropx síncrono, sin timeout y en sandbox

1. **Qué rompe primero.** La cotización de envío en el checkout.
2. **Umbral aproximado.** **2 peticiones/s** (límite documentado en `ESTADO.md`), es decir ~120
   cotizaciones/min. Pero antes de eso: con ~5 s por llamada, **2 cotizaciones simultáneas ya
   consumen el 100 % de la cuota de Lambda** *(estimación)*.
3. **Por qué pasa.** `fetch` sin `AbortSignal` (`skydropx.ts:75,133`): si el tercero tarda, la
   Lambda espera hasta su propio timeout (15 s) ocupando un slot de los 10.
4. **Impacto en el usuario.** El checkout se cuelga y luego falla; y mientras tanto **tumba el
   resto del sitio**, porque se comió la concurrencia.
5. **Cómo detectarlo.** `Duration` de `kustto-admin` acercándose a 15 000 ms, `Throttles` subiendo
   a la vez. Con X-Ray se vería el segmento del tercero; hoy no hay trazas.
6. **Cómo arreglarlo.** `AbortSignal.timeout(3000)` en las dos llamadas, reintento con retroceso
   exponencial y tope, y `SKYDROPX_HOST` apuntando a producción.
7. **¿Ahora o después?** **El timeout y el host, ahora** (media hora). El patrón asíncrono
   completo, cuando haya volumen.

### Cuello de botella 4 — Catálogo sin caché

1. **Qué rompe primero.** El catálogo público bajo tráfico de campaña.
2. **Umbral aproximado.** Cada visita = 1 Lambda + 1 Query. Con 10 de concurrencia y 100 ms, el
   techo es **~100 vistas/s** *(estimación)*. Con la cuota subida, el siguiente techo es la
   partición de `gsi2`: 3 000 RCU ÷ ~12,5 RCU por consulta ≈ **240 vistas/s** *(estimación, con
   100 productos de ~1 KB)*.
3. **Por qué pasa.** El navegador llama a `NEXT_PUBLIC_KUSTTO_API` directamente: **la API no está
   detrás de CloudFront**. Y el `next: { revalidate: 1800 }` de `catalogo.ts` no existe en el
   navegador, sólo en el servidor de Next.
4. **Impacto en el usuario.** Catálogo lento o con error justo cuando llega el tráfico bueno.
5. **Cómo detectarlo.** `AWS/DynamoDB` → `ThrottledRequests` y `ConsumedReadCapacityUnits` del
   índice `gsi2`; `Count` de invocaciones de `kustto-admin`.
6. **Cómo arreglarlo.** Devolver `Cache-Control: public, max-age=300` en `/publico/catalogo` y
   servirlo por CloudFront. El propio `catalogo.ts:17-38` ya describe la salida definitiva —
   materializar el catálogo en S3— y cuándo tomarla.
7. **¿Ahora o después?** **Después**, salvo que haya campaña. La cabecera de caché son 10 minutos
   y quita presión a los otros tres cuellos; el JSON en S3, cuando pasen de unos cientos de
   productos, como ya está escrito.

### Cuello de botella 5 — Sin idempotencia en el pago

1. **Qué rompe primero.** La integridad de los pedidos, no el rendimiento.
2. **Umbral aproximado.** No tiene umbral: pasa con **un solo usuario** con mala red. Se hace más
   probable cuanto más tarda el checkout, y por tanto cuanto más cerca esté de los otros cuellos.
3. **Por qué pasa.** `POST /publico/pedidos` no acepta clave de idempotencia ni la guarda como
   candado condicional. Un reintento crea otra compra, con otro folio, y **vuelve a descontar
   existencias**.
4. **Impacto en el usuario.** Pedido duplicado, cobro duplicado, stock descontado dos veces.
5. **Cómo detectarlo.** Consulta de Insights buscando compras del mismo correo con importe igual
   en menos de dos minutos. Hoy no hay nada que lo vigile.
6. **Cómo arreglarlo.** Que el navegador mande un `Idempotency-Key` (UUID por intento de pago) y
   guardarlo como ítem con `ConditionExpression: attribute_not_exists(pk)` dentro de la misma
   transacción, que ya existe.
7. **¿Ahora o después?** **Ahora.** Es barato —un ítem más en una transacción que ya está escrita—
   y el daño es dinero real de un cliente real.

### Puntos únicos de fallo

| # | Punto | Alcance del fallo | Mitigación |
|---|---|---|---|
| 1 | Cuota de Lambda compartida | **Todo el sistema** | Concurrencia reservada por función |
| 2 | Skydropx síncrono sin timeout | Checkout + resto del sitio por contagio | Timeout + circuito |
| 3 | SES síncrono | El pedido falla si falla el correo | Asíncrono por cola |
| 4 | Región única `us-east-1` | Todo | Aceptable pre-lanzamiento; documentarlo |
| 5 | Partición `PRODUCT_ESTADO#activo` | Catálogo entero | Caché primero, materializar después |
| 6 | Sin PITR | Pérdida de datos irreversible | Activar PITR |
| 7 | Despliegue desde un portátil | Sin reversión ni reproducibilidad | CI |

## Ledger completo de BP (307)

| BP ID | Estado | Severidad | Evidencia | Recomendación |
|---|---|---|---|---|
| OPS01-BP01 | Cannot Determine |  | El repo no es fuente autoritativa de investigación de clientes | Documentar necesidades de compradores y talleres, y priorizarlas |
| OPS01-BP02 | Cannot Determine |  | Sin evidencia de clientes internos definidos | Entrevistar al equipo interno (admin, soporte) |
| OPS01-BP03 | Cannot Determine |  | No hay documento de gobierno en el repo | Definir quién aprueba cambios en producción |
| OPS01-BP04 | Cannot Determine |  | Sin evidencia de análisis de cumplimiento; se procesan datos personales de compradores en MX (LFPDPPP) | Evaluar obligaciones de la ley mexicana de datos personales |
| OPS01-BP05 | Not Implemented | Medium | Sin GuardDuty, sin Config, sin CloudTrail (consultas vivas devuelven vacío) | Activar CloudTrail y GuardDuty; son la base para conocer el panorama |
| OPS01-BP06 | Implemented |  | `ESTADO.md` y `CLAUDE.md` documentan decisiones con su contrapartida (ej. no materializar el catálogo en S3, `catalogo.ts:17-38`) | Mantener el hábito |
| OPS02-BP01 | Partially Implemented | Low | `infra/README.md` mapea recursos a scripts; sin dueños nombrados | Añadir dueño por recurso |
| OPS02-BP02 | Partially Implemented | Low | Procedimientos en `infra/*.sh` con cabecera explicativa; sin dueño | Nombrar responsable por procedimiento |
| OPS02-BP03 | Cannot Determine |  | Sin evidencia de asignación de actividades operativas | Definir quién responde a un incidente |
| OPS02-BP04 | Cannot Determine |  | Sin mecanismo documentado | Definir cómo se gestionan responsabilidades |
| OPS02-BP05 | Cannot Determine |  | Sin proceso de solicitudes documentado | Definir cómo se piden cambios y excepciones |
| OPS02-BP06 | Not Applicable |  | Equipo de una persona según el historial de commits; no hay fronteras entre equipos | Revisar cuando crezca el equipo |
| OPS03-BP01 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| OPS03-BP02 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| OPS03-BP03 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| OPS03-BP04 | Partially Implemented | Low | `ESTADO.md` es un traspaso entre sesiones explícito y actualizado | Extenderlo a comunicación con el taller |
| OPS03-BP05 | Implemented |  | `ESTADO.md` documenta experimentos descartados con su razón (`distDir`, materializar catálogo) | — |
| OPS03-BP06 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| OPS03-BP07 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| OPS04-BP01 | Not Implemented | High | Cero alarmas de CloudWatch (`describe-alarms` vacío); no hay KPI definido ni medido | Definir KPI: pedidos/min, latencia p99 del checkout, tasa de error 5xx |
| OPS04-BP02 | Partially Implemented | Medium | 31 llamadas a `console.*` en los servicios; sin formato estructurado ni correlación | Emitir JSON con `requestId` de API Gateway en cada línea |
| OPS04-BP03 | Not Implemented | Medium | Sin RUM, sin telemetría de cliente; el front es export estático sin instrumentar | Añadir CloudWatch RUM o equivalente al checkout |
| OPS04-BP04 | Not Implemented | High | Skydropx se llama con `fetch` sin métrica ni traza (`services/admin/src/lib/skydropx.ts:133`) | Medir latencia y tasa de fallo del tercero |
| OPS04-BP05 | Not Implemented | High | X-Ray en `PassThrough` en las 5 funciones (consulta viva) | Activar `TracingConfig=Active`; es una línea por función |
| OPS05-BP01 | Implemented |  | Git con 110 commits e historia conservada; repo en GitHub | — |
| OPS05-BP02 | Partially Implemented | Medium | `tsc --noEmit` y biome se corren a mano; **cero archivos de prueba** en el repo | Añadir pruebas al menos del checkout y de `validarFotosReales` |
| OPS05-BP03 | Partially Implemented | Medium | Configuración por variables de entorno de Lambda; sin gestión centralizada | Mover a SSM Parameter Store |
| OPS05-BP04 | Partially Implemented | Medium | `infra/*.sh` idempotentes y documentados; ejecución manual desde un portátil | Automatizar en CI |
| OPS05-BP05 | Partially Implemented | Low | `nodejs20.x` es una versión soportada; sin proceso de actualización | Definir cadencia de actualización de runtime y dependencias |
| OPS05-BP06 | Implemented |  | `CLAUDE.md` fija convenciones (idioma, comentarios, prohibiciones) y `ESTADO.md` las decisiones | — |
| OPS05-BP07 | Partially Implemented | Medium | biome + tsc estrictos y comentarios de por qué; sin revisión por pares ni CI que los imponga | Poner biome y tsc como gate en CI |
| OPS05-BP08 | Not Implemented | High | Un solo entorno: `kustto-prod`. Los scripts despliegan directo a producción | Crear entorno de staging con su tabla y sus Lambdas |
| OPS05-BP09 | Implemented |  | Commits pequeños y frecuentes; despliegue por función independiente | — |
| OPS05-BP10 | Not Implemented | High | Sin `.github/workflows`; despliegue manual con `bash infra/sitio.sh` desde el portátil del desarrollador | Montar CI que construya, pruebe y despliegue |
| OPS06-BP01 | Partially Implemented | Medium | S3 del sitio sin versionado (consulta viva) — no hay vuelta atrás del front; Lambda sí conserva versiones | Activar versionado en `kustto-sitio-prod` |
| OPS06-BP02 | Not Implemented | High | No hay entorno donde probar el despliegue antes de producción | Probar en staging antes de producción |
| OPS06-BP03 | Not Implemented | High | Despliegue *all-at-once*: `update-function-code` sobre `$LATEST`, sin alias, sin canary | Usar alias con desplazamiento de peso y alarma de reversión |
| OPS06-BP04 | Not Implemented | High | Sin pruebas automáticas y sin reversión automática | CodeDeploy para Lambda con alarma de reversión |
| OPS07-BP01 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| OPS07-BP02 | Not Implemented | Medium | Sin lista de comprobación de preparación operativa | Crear checklist antes de abrir a tráfico real |
| OPS07-BP03 | Partially Implemented | Low | `infra/README.md` y las cabeceras de los scripts hacen de runbook de despliegue | Añadir runbook de incidente (qué hacer si el checkout falla) |
| OPS07-BP04 | Not Implemented | Medium | Sin playbooks de investigación | Escribir playbook para "pedido cobrado sin guía" |
| OPS07-BP05 | Partially Implemented | Low | `ESTADO.md` registra qué está probado y qué no, explícitamente | Formalizar el criterio de "listo para desplegar" |
| OPS07-BP06 | Cannot Determine |  | Nivel de soporte de AWS no consultable con los permisos actuales | Verificar plan de soporte en la consola |
| OPS08-BP01 | Not Implemented | High | Métricas detalladas de API Gateway **desactivadas** (`DetailedMetricsEnabled: false`) | Activar métricas detalladas por ruta |
| OPS08-BP02 | Partially Implemented | Medium | Logs de Lambda existen; **retención `None` = para siempre** en los 5 grupos | Fijar retención (30 días) y consultarlos con Insights |
| OPS08-BP03 | Not Implemented | High | Sin trazas: X-Ray apagado | Activar X-Ray |
| OPS08-BP04 | Not Implemented | Critical | **Cero alarmas** y **cero temas SNS**: ningún fallo avisa a nadie | Alarmas de errores, throttles y latencia con destino SNS |
| OPS08-BP05 | Not Implemented | Medium | Sin dashboards | Un dashboard con pedidos, errores y throttles |
| OPS09-BP01 | Not Implemented | Medium | Sin KPI operativos medidos | Definir y medir |
| OPS09-BP02 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| OPS09-BP03 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| OPS10-BP01 | Not Implemented | High | Sin proceso de incidentes; sin alertas que lo disparen | Definir proceso mínimo de incidente |
| OPS10-BP02 | Not Implemented | High | No hay alertas, luego no hay proceso por alerta | Un proceso por cada alarma que se cree |
| OPS10-BP03 | Cannot Determine |  | Sin evidencia de priorización | Definir severidades |
| OPS10-BP04 | Cannot Determine |  | Sin evidencia de escalado | Definir a quién se llama |
| OPS10-BP05 | Not Implemented | Medium | Sin plan de comunicación al comprador ante caída | Definir aviso en el sitio y por correo |
| OPS10-BP06 | Not Implemented | Low | Sin dashboards públicos ni internos | Página de estado |
| OPS10-BP07 | Not Implemented | Medium | Sin respuesta automática a eventos | Automatizar lo repetitivo tras las primeras alarmas |
| OPS11-BP01 | Partially Implemented | Low | `ESTADO.md` sección "Lo que sigue" ordena mejoras | Formalizar cadencia |
| OPS11-BP02 | Partially Implemented | Medium | `ESTADO.md` "Trampas que ya mordieron" es análisis post-incidente real y detallado | Extenderlo a incidentes de producción |
| OPS11-BP03 | Partially Implemented | Low | Bucle de realimentación con el propio uso; sin canal del taller | Canal de realimentación para talleres |
| OPS11-BP04 | Implemented |  | `ESTADO.md`, `README.md`, `infra/README.md` y comentarios de por qué en el código | — |
| OPS11-BP05 | Partially Implemented | Low | Impulsores implícitos en "Lo que sigue" | Explicitar el porqué de cada mejora |
| OPS11-BP06 | Partially Implemented | Medium | `CLAUDE.md` exige verificar antes de afirmar y cita dos diagnósticos equivocados | Validar con métricas, no sólo con lectura |
| OPS11-BP07 | Not Implemented | Medium | Sin métricas que revisar | Revisar tras instrumentar |
| OPS11-BP08 | Implemented |  | Lecciones documentadas con su causa raíz en `ESTADO.md` | — |
| OPS11-BP09 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| SEC01-BP01 | Not Implemented | Medium | Una sola cuenta (467685081574) para producción y desarrollo; sin AWS Organizations | Separar producción en su propia cuenta antes de crecer |
| SEC01-BP02 | Cannot Determine |  | No se puede consultar el estado del usuario raíz con los permisos actuales | Verificar en la consola que el raíz tiene MFA y no tiene llaves |
| SEC01-BP03 | Cannot Determine |  | Sin objetivos de control documentados | Definirlos (p. ej. contra LFPDPPP para datos de compradores) |
| SEC01-BP04 | Not Implemented | Medium | Sin GuardDuty ni Security Hub (consultas vivas vacías) | Activar GuardDuty; es la fuente de avisos de amenaza |
| SEC01-BP05 | Partially Implemented | Low | Todo serverless y gestionado: sin EC2, sin VPC, sin parcheo de SO | — |
| SEC01-BP06 | Partially Implemented | Medium | `infra/*.sh` despliega IAM y buckets de forma repetible; sin Config ni SCP que lo impongan | Añadir AWS Config con reglas |
| SEC01-BP07 | Cannot Determine |  | Sin modelo de amenazas documentado | Hacer un STRIDE del checkout y del webhook |
| SEC01-BP08 | Partially Implemented | Low | `ESTADO.md` registra evaluación de servicios; ninguno de seguridad adoptado | Revisar GuardDuty/WAF |
| SEC02-BP01 | Partially Implemented | High | Cognito con contraseña mínima 10 (compradores) y 12 (admins); **MFA OFF en los tres pools**, incluido `kustto-admins` | Activar MFA obligatorio en el pool de admins |
| SEC02-BP02 | Partially Implemented | High | Las Lambdas usan rol (credencial temporal) ✓ y SES vía `sts:AssumeRole` ✓; pero el usuario IAM `claude-admin` tiene **dos llaves estáticas activas** | Sustituir el usuario por IAM Identity Center o roles asumibles |
| SEC02-BP03 | Not Implemented | High | `SKYDROPX_CLIENT_SECRET` y `SKYDROPX_WEBHOOK_SECRETO` en variables de entorno de Lambda en claro (consulta viva) | Mover a Secrets Manager o SSM `SecureString` |
| SEC02-BP04 | Implemented |  | Cognito como IdP central, tres pools por audiencia; Google federado para compradores | — |
| SEC02-BP05 | Not Implemented | High | Dos llaves de acceso activas del 1 y 2 de septiembre, ninguna rotada; sin política de rotación | Borrar la llave sobrante y rotar la otra |
| SEC02-BP06 | Partially Implemented | Low | Separación por pool (admin/comprador/proveedor) hace de grupo; sin grupos dentro del pool | Usar grupos si aparecen roles de admin distintos |
| SEC03-BP01 | Partially Implemented | Medium | Frontera documentada en `services/admin/src/handler.ts:100-135` con rutas abiertas enumeradas una a una | Documentar la matriz de acceso completa |
| SEC03-BP02 | Partially Implemented | Medium | Roles Lambda con políticas acotadas por recurso (`correo`, `datos`, `eventos`; sin `Resource: "*"`) ✓; pero `claude-admin` tiene **AdministratorAccess** | Quitar AdministratorAccess del usuario humano |
| SEC03-BP03 | Cannot Determine |  | Sin proceso de acceso de emergencia documentado | Definir el break-glass |
| SEC03-BP04 | Not Implemented | Medium | Sin IAM Access Analyzer ni revisión de permisos no usados | Activar Access Analyzer (gratis) |
| SEC03-BP05 | Not Implemented | Medium | Sin SCP ni límites de permisos (cuenta única, sin Organizations) | Añadir límites al crear la cuenta de producción |
| SEC03-BP06 | Cannot Determine |  | Sin evidencia de gestión de altas y bajas | Definir el ciclo de vida de accesos |
| SEC03-BP07 | Partially Implemented | Medium | Block Public Access activo en los tres buckets revisados ✓; rol `kustto-correo` asumido entre cuentas sin Access Analyzer que lo vigile | Activar Access Analyzer para accesos externos |
| SEC03-BP08 | Not Applicable |  | Sin Organizations, no hay compartición interna | Revisar al crear la organización |
| SEC03-BP09 | Partially Implemented | Medium | Skydropx recibe direcciones y teléfonos de compradores; sin acuerdo de tratamiento documentado en el repo | Documentar qué datos salen a Skydropx |
| SEC04-BP01 | Not Implemented | Critical | **Sin CloudTrail** (`describe-trails` vacío): no hay registro de quién hizo qué en la cuenta. Sin logs de acceso en CloudFront ni en S3; sin log de acceso en API Gateway | Activar CloudTrail en la cuenta; es el registro forense básico |
| SEC04-BP02 | Not Implemented | High | Sin ubicación estandarizada de logs de seguridad | Un bucket de logs con retención |
| SEC04-BP03 | Not Implemented | High | Sin correlación ni enriquecimiento; sin GuardDuty ni Security Hub | Activar GuardDuty |
| SEC04-BP04 | Not Implemented | Medium | Sin remediación automática | Config + remediación tras lo anterior |
| SEC05-BP01 | Not Applicable |  | Arquitectura sin VPC: Lambdas fuera de VPC, DynamoDB y S3 por endpoint público con IAM | — |
| SEC05-BP02 | Not Applicable |  | Sin capas de red que controlar | — |
| SEC05-BP03 | Not Implemented | High | **Sin WAF en ninguna de las dos distribuciones de CloudFront** (`WebACLId: ""`), y `POST /publico/pedidos` está abierto al mundo | Asociar WAF con reglas gestionadas y limitación de tasa |
| SEC05-BP04 | Not Implemented | Medium | Sin automatización de protección de red | Tras poner WAF, automatizar sus reglas |
| SEC06-BP01 | Partially Implemented | Medium | Dependencias con pnpm y lockfile; sin escaneo (`npm audit`/Dependabot) en CI porque no hay CI | Añadir escaneo de dependencias |
| SEC06-BP02 | Not Applicable |  | Sin imágenes: Lambda con runtime gestionado por AWS | — |
| SEC06-BP03 | Partially Implemented | Medium | Sin acceso interactivo a cómputo ✓; pero el despliegue es manual desde un portátil | Automatizar el despliegue |
| SEC06-BP04 | Not Implemented | Medium | Sin firma de código (`Code signing` de Lambda no configurado); artefactos construidos en local | Activar Code Signing for Lambda |
| SEC06-BP05 | Partially Implemented | Low | AWS gestiona y parchea el runtime | Fijar cadencia de actualización de `nodejs20.x` |
| SEC07-BP01 | Not Implemented | Medium | Sin esquema de clasificación; conviven datos personales (dirección, teléfono, correo) con catálogo público en la misma tabla | Clasificar y documentar qué es personal |
| SEC07-BP02 | Partially Implemented | Medium | Separación por bucket (público/privado) y por prefijo ✓; sin controles diferenciados por sensibilidad dentro de DynamoDB | Considerar cifrado de campo para teléfono y dirección |
| SEC07-BP03 | Not Implemented | Low | Sin Macie ni identificación automática | Prematuro hoy |
| SEC07-BP04 | Partially Implemented | Medium | Lifecycle `carritos-caducan` en el bucket público y TTL `expiraEn` en DynamoDB ✓; los pedidos no caducan nunca | Definir retención de datos personales de pedidos |
| SEC08-BP01 | Partially Implemented | Medium | Sólo llaves gestionadas por AWS (sin alias `alias/kustto*`) | Considerar CMK para la tabla si aparece requisito de cumplimiento |
| SEC08-BP02 | Implemented |  | DynamoDB cifrada por defecto con llave de AWS; S3 con cifrado por defecto | — |
| SEC08-BP03 | Not Implemented | Medium | Sin Config que verifique el cifrado de forma continua | Regla de Config |
| SEC08-BP04 | Implemented |  | Block Public Access en los tres buckets revisados; OAC entre CloudFront y S3; particiones de DynamoDB acotadas por `sub` de Cognito | — |
| SEC09-BP01 | Implemented |  | Certificado ACM en CloudFront con TLS 1.2_2021 mínimo (`infra/frontend-config.py`) | — |
| SEC09-BP02 | Implemented |  | HTTPS en CloudFront y API Gateway; llamadas a AWS y a Skydropx por TLS | — |
| SEC09-BP03 | Partially Implemented | High | Autorizador JWT de Cognito en `/proveedores/*` ✓ y HMAC en el webhook con `timingSafeEqual` ✓ (`rastreo.ts:174`); pero **CORS admite `http://localhost:3000/3001/3002` en producción** | Quitar los orígenes locales del CORS de producción |
| SEC10-BP01 | Cannot Determine |  | Sin personal de incidentes identificado | Nombrar responsable |
| SEC10-BP02 | Not Implemented | High | Sin plan de respuesta a incidentes | Escribir uno mínimo |
| SEC10-BP03 | Not Implemented | High | Sin CloudTrail no hay capacidad forense: no se puede reconstruir qué pasó | Activar CloudTrail con retención |
| SEC10-BP04 | Not Implemented | Medium | Sin playbooks de seguridad | Escribir el de "credencial filtrada" |
| SEC10-BP05 | Partially Implemented | Low | `claude-admin` con AdministratorAccess da acceso, pero es lo contrario de pre-aprovisionar con menor privilegio | Rol de respuesta a incidentes separado |
| SEC10-BP06 | Not Implemented | Medium | Sin herramientas desplegadas | Tras CloudTrail y GuardDuty |
| SEC10-BP07 | Not Implemented | Low | Sin simulacros | Prematuro pre-lanzamiento |
| SEC10-BP08 | Partially Implemented | Low | `ESTADO.md` "Trampas que ya mordieron" aprende de fallos, ninguno de seguridad | Extender a incidentes de seguridad |
| SEC11-BP01 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| SEC11-BP02 | Not Implemented | High | Sin CI, luego sin pruebas de seguridad automatizadas; cero archivos de prueba | SAST y escaneo de dependencias en CI |
| SEC11-BP03 | Not Implemented | Medium | Sin pruebas de penetración | Hacer una antes de abrir a tráfico real |
| SEC11-BP04 | Cannot Determine |  | Historial de un solo autor; no consta revisión por pares | Definir revisión antes de producción |
| SEC11-BP05 | Partially Implemented | Low | pnpm con lockfile y workspace; registro público sin espejo interno | Suficiente a esta escala |
| SEC11-BP06 | Partially Implemented | Medium | Despliegue por script repetible pero **manual** | Automatizar |
| SEC11-BP07 | Not Applicable |  | No hay pipeline que evaluar | Revisar cuando exista CI |
| SEC11-BP08 | Cannot Determine |  | Equipo de una persona; propiedad de seguridad implícita | Entrevista |
| REL01-BP01 | Not Implemented | Critical | **Cuota viva de Lambda: 10 ejecuciones concurrentes en toda la cuenta** (`get-account-settings`). SES en sandbox: 200/día, 1/s. Ninguna de las dos consta en el repo | Pedir subida de cuota de Lambda y salida de sandbox de SES **hoy**: AWS tarda de horas a días |
| REL01-BP02 | Not Implemented | High | Una cuenta, una región; sin inventario de cuotas | Documentar las cuotas que atan: Lambda, SES, Skydropx (2 rps), transacción DynamoDB (100 ítems) |
| REL01-BP03 | Partially Implemented | Medium | `escribirCompra` comprueba el límite de 100 ítems por transacción y lo dice en castellano (`pedidos.ts:1058`) ✓; nada más se acomoda a una cuota | Aplicar el mismo criterio a Lambda y SES |
| REL01-BP04 | Not Implemented | Critical | Cero alarmas: nada vigila `ConcurrentExecutions` ni `Throttles` | Alarma sobre `Throttles > 0` y sobre uso de cuota al 80 % |
| REL01-BP05 | Not Implemented | Medium | Sin automatización de cuotas | Service Quotas con alarma tras lo anterior |
| REL01-BP06 | Not Implemented | Critical | Con 10 de concurrencia no hay margen ninguno: el uso normal ya roza el techo | Subir a 1000 y reservar concurrencia por función |
| REL02-BP01 | Implemented |  | CloudFront (`PriceClass_All`) + API Gateway regional, los dos gestionados y multi-AZ por AWS | — |
| REL02-BP02 | Not Applicable |  | Sin red privada ni on-premises | — |
| REL02-BP03 | Not Applicable |  | Sin VPC: las Lambdas corren fuera | — |
| REL02-BP04 | Not Applicable |  | Sin topología de red propia | — |
| REL02-BP05 | Not Applicable |  | Sin rangos privados | — |
| REL03-BP01 | Implemented |  | Segmentado por audiencia en cinco funciones: admin, compradores, proveedores, correo, eventos | — |
| REL03-BP02 | Implemented |  | Cada Lambda cubre un dominio con sus rutas (`handler.ts` de cada servicio) | — |
| REL03-BP03 | Partially Implemented | Medium | Contrato implícito en los tipos de TS compartidos por copia; sin OpenAPI ni versionado de API | Documentar el contrato de `/publico/*`, que es el que consume el sitio estático |
| REL04-BP01 | Partially Implemented | Medium | `ESTADO.md` identifica Skydropx como dependencia y su límite de 2 rps; SES y Cognito no están inventariados | Inventariar las tres dependencias con su cuota |
| REL04-BP02 | Not Implemented | High | **SES y Skydropx se llaman de forma síncrona dentro de la petición** (`envios.ts:59,136`; `correo.ts:90`). El stream de DynamoDB está encendido y **sin ningún consumidor** (0 event source mappings) | Sacar el correo del camino de la petición: stream → cola → Lambda de correo |
| REL04-BP03 | Partially Implemented | Low | El catálogo se pide entero y se filtra en cliente: trabajo constante ✓ | — |
| REL04-BP04 | Not Implemented | Critical | **`POST /publico/pedidos` no es idempotente**: sin `ClientRequestToken` ni clave de deduplicación. Un reintento del navegador crea una segunda compra con otro folio y vuelve a descontar existencias | Aceptar una clave de idempotencia del cliente y guardarla como candado condicional |
| REL05-BP01 | Partially Implemented | Medium | El catálogo cae al mockup si falta la foto ✓ y las recomendaciones fallan sin tumbar la ficha ✓; pero si SES falla, el pedido falla | Degradar: registrar el correo fallido y seguir |
| REL05-BP02 | Not Implemented | High | **Sin throttling en API Gateway** (`ThrottlingRateLimit: null` en los dos stages) y sin WAF | Fijar límite por ruta, sobre todo en `/publico/pedidos` y `/publico/envios/cotizar` |
| REL05-BP03 | Partially Implemented | Medium | El SDK de AWS reintenta 3 veces por defecto ✓; **`fetch` a Skydropx no reintenta y no tiene tope** | Reintento con retroceso exponencial y tope explícito |
| REL05-BP04 | Not Implemented | High | Sin colas y sin fallo rápido: la Lambda espera al tercero hasta agotar su timeout (15 s admin, 29 s proveedores) | `AbortSignal.timeout(3000)` en las llamadas a Skydropx |
| REL05-BP05 | Not Implemented | Critical | **`fetch` a Skydropx sin `AbortSignal`** (`skydropx.ts:75,133`): una respuesta lenta ocupa una de las 10 ejecuciones concurrentes hasta el timeout | Poner timeout de cliente en todas las llamadas salientes |
| REL05-BP06 | Implemented |  | Lambdas sin estado; el estado vive en DynamoDB y S3 | — |
| REL05-BP07 | Not Implemented | Medium | Sin interruptor para apagar el checkout o el envío | Bandera para desactivar cotización si Skydropx cae |
| REL06-BP01 | Not Implemented | Critical | Cero alarmas, métricas detalladas de API Gateway apagadas, X-Ray en `PassThrough` | Instrumentar antes de abrir a tráfico |
| REL06-BP02 | Not Implemented | High | Sin métricas de negocio (pedidos/min, cotizaciones fallidas) | Métricas embebidas (EMF) desde la Lambda |
| REL06-BP03 | Not Implemented | Critical | **Cero temas SNS**: ningún fallo notifica a nadie | Tema SNS con tu correo y alarmas conectadas |
| REL06-BP04 | Not Implemented | Medium | Sin respuesta automática | Tras las alarmas |
| REL06-BP05 | Partially Implemented | Medium | Logs existen pero con **retención infinita** en los 5 grupos y sin consultas guardadas | Retención 30 días y consultas de Insights guardadas |
| REL06-BP06 | Not Implemented | Low | Sin monitorización que revisar | Tras instrumentar |
| REL06-BP07 | Not Implemented | High | Sin traza distribuida; una compra toca 2 Lambdas, DynamoDB, SES y Skydropx sin correlación | X-Ray activo en las cinco funciones |
| REL07-BP01 | Partially Implemented | High | Lambda y DynamoDB `PAY_PER_REQUEST` escalan solos ✓, **pero la cuota de 10 anula ese escalado** | Subir la cuota; sin eso el resto es teórico |
| REL07-BP02 | Not Implemented | Medium | Sin detección de deterioro | Alarmas |
| REL07-BP03 | Partially Implemented | Medium | Escalado automático de los servicios gestionados; sin concurrencia reservada que garantice cuota a las rutas críticas | Reservar concurrencia para `kustto-admin` (checkout) |
| REL07-BP04 | Not Implemented | High | Sin prueba de carga; nunca se ha medido dónde rompe | Prueba de carga del checkout tras subir la cuota |
| REL08-BP01 | Partially Implemented | Low | `infra/README.md` y cabeceras de los scripts hacen de runbook | Añadir runbook de reversión |
| REL08-BP02 | Not Implemented | High | Sin pruebas funcionales en el despliegue; cero archivos de prueba | Prueba de humo del checkout tras desplegar |
| REL08-BP03 | Not Implemented | Medium | Sin pruebas de resiliencia | Tras lo anterior |
| REL08-BP04 | Partially Implemented | Medium | Lambda es inmutable por naturaleza ✓; se despliega sobre `$LATEST` sin alias ni versión fijada | Publicar versión y mover un alias |
| REL08-BP05 | Partially Implemented | Medium | Scripts idempotentes ✓ pero ejecutados a mano | CI |
| REL09-BP01 | Partially Implemented | High | S3 con versionado en `publico` y `privado` ✓; **`kustto-sitio-prod` sin versionado**; DynamoDB con backup continuo activado | Activar versionado en el bucket del sitio |
| REL09-BP02 | Implemented |  | Cifrado en reposo por defecto en S3 y DynamoDB | — |
| REL09-BP03 | Partially Implemented | Critical | **PITR DESACTIVADO** en `kustto-prod` (`PointInTimeRecoveryStatus: DISABLED`): un borrado accidental o un fallo de código no se puede deshacer | Activar PITR: una casilla, ~10 % del coste de almacenamiento |
| REL09-BP04 | Not Implemented | High | Nunca se ha probado una restauración | Probar restaurando a una tabla nueva |
| REL10-BP01 | Partially Implemented | Medium | Una sola región (us-east-1); los servicios usados son multi-AZ por dentro | Aceptable pre-lanzamiento; documentar la decisión |
| REL10-BP02 | Not Applicable |  | Sin componentes atados a una sola AZ | — |
| REL10-BP03 | Partially Implemented | High | Separación por función ✓, **pero las cinco comparten las 10 ejecuciones de la cuenta**: una tormenta en el catálogo deja sin cómputo al checkout | Concurrencia reservada por función: es el mamparo que falta |
| REL11-BP01 | Not Implemented | Critical | Sin monitorización de fallos en ningún componente | Alarmas por función |
| REL11-BP02 | Partially Implemented | Low | Failover interno de los servicios gestionados | — |
| REL11-BP03 | Not Implemented | Medium | Sin auto-recuperación propia | Tras las alarmas |
| REL11-BP04 | Implemented |  | La recuperación no depende del plano de control: todo es dato en DynamoDB y S3 | — |
| REL11-BP05 | Partially Implemented | Medium | Serverless da estabilidad estática; el catálogo horneado en el build introduce bimodalidad (producto nuevo → 404, ya mitigado con la red de `not-found.tsx`) | — |
| REL11-BP06 | Not Implemented | Critical | Nada notifica cuando la disponibilidad se ve afectada | SNS + alarmas |
| REL11-BP07 | Not Implemented | Medium | Sin objetivo de disponibilidad declarado | Definir el objetivo antes de prometer nada |
| REL12-BP01 | Not Implemented | Medium | Sin playbooks de fallo | Escribir el de "checkout con error 5xx" |
| REL12-BP02 | Partially Implemented | Low | `ESTADO.md` documenta análisis post-fallo con causa raíz | Extender a incidentes de producción |
| REL12-BP03 | Not Implemented | High | Sin prueba de escalabilidad ni de rendimiento | Prueba de carga |
| REL12-BP04 | Not Implemented | Low | Sin ingeniería del caos | Prematuro pre-lanzamiento |
| REL12-BP05 | Not Implemented | Low | Sin game days | Prematuro pre-lanzamiento |
| REL13-BP01 | Not Implemented | High | Sin RTO ni RPO definidos; con PITR apagado el RPO real es "lo que haya en el último backup", que no existe | Definir RTO/RPO y activar PITR |
| REL13-BP02 | Not Implemented | High | Sin estrategia de recuperación | Backup y restauración en la misma región basta pre-lanzamiento |
| REL13-BP03 | Not Implemented | High | Sin prueba de recuperación | Probar una restauración |
| REL13-BP04 | Not Applicable |  | Sin sitio de DR | — |
| REL13-BP05 | Not Implemented | Medium | Sin recuperación automatizada | Tras definir la estrategia |
| PERF01-BP01 | Implemented |  | Elección deliberada y documentada de servicios (`ESTADO.md`, `infra/README.md`); serverless en todo | — |
| PERF01-BP02 | Partially Implemented | Low | Patrones de tabla única bien aplicados; sin referencia explícita a guías de AWS | — |
| PERF01-BP03 | Implemented |  | `catalogo.ts:17-38` compara Query directo contra vista materializada en S3 con coste y decide, con criterio de cuándo cambiar | — |
| PERF01-BP04 | Implemented |  | Compensaciones documentadas: URLs indexables frente a páginas horneadas (`lib/build/parametros.ts`) | — |
| PERF01-BP05 | Partially Implemented | Low | Convenciones en `CLAUDE.md`; sin arquitectura de referencia formal | — |
| PERF01-BP06 | Not Implemented | High | **Sin ningún banco de pruebas**: nunca se ha medido la latencia del checkout ni del catálogo | Medir antes de optimizar |
| PERF01-BP07 | Not Implemented | High | Sin datos: no hay métricas detalladas ni trazas | Instrumentar |
| PERF02-BP01 | Implemented |  | Lambda encaja con carga a ráfagas e intermitente | — |
| PERF02-BP02 | Partially Implemented | Medium | 512 MB y `x86_64` en cuatro funciones, 256 MB en eventos; **arm64 (Graviton) no evaluado** | Probar `arm64`: ~20 % más barato y suele ser más rápido |
| PERF02-BP03 | Not Implemented | High | Sin métricas de cómputo revisadas; Lambda Insights apagado | Activar Lambda Insights o al menos vigilar duración y throttles |
| PERF02-BP04 | Cannot Determine |  | Sin datos de duración ni de memoria usada no se puede dimensionar | Usar Lambda Power Tuning tras instrumentar |
| PERF02-BP05 | Partially Implemented | Critical | Lambda escala sola por diseño, **pero la cuota de 10 lo impide en la práctica** | Subir la cuota |
| PERF02-BP06 | Not Applicable |  | Sin cargas que se beneficien de aceleradores | — |
| PERF03-BP01 | Implemented |  | DynamoDB para acceso por llave y S3 para binarios: cada uno en lo suyo | — |
| PERF03-BP02 | Partially Implemented | High | `PAY_PER_REQUEST` correcto ✓; **tres GSI con proyección `ALL`** multiplican por cuatro el coste y el peso de cada escritura | Proyectar sólo los atributos que cada índice consulta |
| PERF03-BP03 | Not Implemented | High | Sin métricas de DynamoDB vigiladas (throttles, latencia, capacidad consumida) | Alarma sobre `ThrottledRequests` |
| PERF03-BP04 | Partially Implemented | High | Query por llave sin Scan ✓ y paginación con `consultarTodo` ✓; **pero el catálogo público entero vive en UNA partición de gsi2 (`PRODUCT_ESTADO#activo`)** y se consulta en cada visita | Repartir la partición o materializar el catálogo, como ya contempla `catalogo.ts` |
| PERF03-BP05 | Not Implemented | Critical | **Sin caché en el camino del catálogo**: el navegador llama a API Gateway directo (`NEXT_PUBLIC_KUSTTO_API`), no pasa por CloudFront. Cada visita = 1 Lambda + 1 Query. El `next: { revalidate: 1800 }` no existe en el navegador (`catalogo.ts`) | Poner el catálogo detrás de CloudFront con TTL, o cabeceras `Cache-Control` en la respuesta |
| PERF04-BP01 | Partially Implemented | Medium | CloudFront para lo estático ✓; la API queda fuera del CDN | Meter `/publico/*` bajo CloudFront |
| PERF04-BP02 | Partially Implemented | Low | OAC y HTTP/2 de CloudFront; sin evaluar HTTP/3 ni compresión de la API | — |
| PERF04-BP03 | Not Applicable |  | Sin conectividad dedicada | — |
| PERF04-BP04 | Not Applicable |  | Sin balanceadores: API Gateway y CloudFront lo hacen por dentro | — |
| PERF04-BP05 | Partially Implemented | Low | HTTPS/TLS 1.2+; WebSocket para el panel del taller en vez de sondeo ✓ | — |
| PERF04-BP06 | Partially Implemented | Medium | `us-east-1` con clientes en México: ~40-70 ms de ida y vuelta añadidos | Considerar `mx-central-1` o `us-west-2`; medir antes |
| PERF04-BP07 | Not Implemented | Medium | Sin métricas de red | Tras instrumentar |
| PERF05-BP01 | Not Implemented | High | Sin KPI de rendimiento definidos | Definir p99 del checkout y del catálogo |
| PERF05-BP02 | Not Implemented | Critical | Sin monitorización: cero alarmas, métricas detalladas apagadas, sin X-Ray | Instrumentar |
| PERF05-BP03 | Not Implemented | Medium | Sin proceso de mejora de rendimiento | Tras tener datos |
| PERF05-BP04 | Not Implemented | High | Sin prueba de carga | Prueba de carga del checkout |
| PERF05-BP05 | Not Implemented | Low | Sin remediación automática | Prematuro |
| PERF05-BP06 | Partially Implemented | Low | `nodejs20.x` y dependencias recientes; sin cadencia | Fijar cadencia |
| PERF05-BP07 | Not Implemented | Medium | Sin métricas que revisar | Tras instrumentar |
| COST01-BP01 | Cannot Determine |  | Fuera del alcance del repo | Nombrar responsable del coste |
| COST01-BP02 | Not Applicable |  | Equipo de una persona; no hay función financiera separada | Revisar cuando crezca |
| COST01-BP03 | Not Implemented | High | **Sin presupuestos** (`describe-budgets` vacío): nada avisa si el gasto se dispara | Crear un presupuesto con alerta al 50/80/100 % |
| COST01-BP04 | Partially Implemented | Low | `catalogo.ts:17-38` razona el coste al elegir arquitectura | Formalizarlo |
| COST01-BP05 | Not Implemented | Medium | Sin informes ni notificaciones de coste | Alerta de presupuesto |
| COST01-BP06 | Not Implemented | High | Sin vigilancia proactiva; **sin Cost Anomaly Detection** | Activar detección de anomalías (gratis) |
| COST01-BP07 | Partially Implemented | Low | `ESTADO.md` registra evaluaciones de servicios | — |
| COST01-BP08 | Partially Implemented | Low | Cultura de coste visible en los comentarios del código | — |
| COST01-BP09 | Cannot Determine |  | Sin cuantificación de valor | Entrevista |
| COST02-BP01 | Cannot Determine |  | Sin políticas documentadas | Definirlas |
| COST02-BP02 | Not Implemented | Medium | Sin objetivos de coste | Fijar un techo mensual |
| COST02-BP03 | Not Implemented | Medium | Una sola cuenta para todo | Separar producción |
| COST02-BP04 | Partially Implemented | Medium | Roles por servicio ✓; un solo usuario humano con AdministratorAccess | Reducir privilegios |
| COST02-BP05 | Not Implemented | High | **Sin control de gasto**: sin presupuesto, sin throttling en API Gateway, sin WAF. Un abuso de `/publico/envios/cotizar` gasta cuota de Skydropx y Lambda sin tope | Presupuesto + throttling + WAF |
| COST02-BP06 | Partially Implemented | Low | `ESTADO.md` sigue el ciclo de vida del proyecto | — |
| COST03-BP01 | Partially Implemented | Medium | Cost Explorer disponible; **CUR no configurado** | Activar informes de coste y uso si el gasto crece |
| COST03-BP02 | Cannot Determine |  | No se pudieron leer las etiquetas (`lambda:ListTags` denegado con el rol actual) | Verificar etiquetado en la consola |
| COST03-BP03 | Not Implemented | Medium | Sin categorías de atribución | Etiquetar por componente |
| COST03-BP04 | Not Implemented | Medium | Sin métrica de coste por pedido | Calcular coste unitario por pedido |
| COST03-BP05 | Partially Implemented | Low | Cost Explorer accesible; sin configuración adicional | Activar presupuestos y anomalías |
| COST03-BP06 | Not Implemented | Medium | Sin reparto por métrica de negocio | Tras definir el coste por pedido |
| COST04-BP01 | Partially Implemented | Low | Recursos inventariados en `infra/README.md` | — |
| COST04-BP02 | Not Implemented | Medium | Sin proceso de baja | Definirlo |
| COST04-BP03 | Partially Implemented | Medium | `borrar()` de productos limpia la fila y el candado ✓; **las fotos huérfanas en S3 no se borran nunca** (decisión documentada) | Revisar cuando el volumen lo justifique |
| COST04-BP04 | Partially Implemented | Medium | TTL en DynamoDB ✓ y lifecycle `carritos-caducan` en S3 ✓ | Extender a versiones antiguas de S3 |
| COST04-BP05 | Partially Implemented | High | Retención definida para carritos ✓; **logs de las 5 Lambdas con retención infinita** y buckets versionados sin caducidad de versiones | Retención 30 días en logs; lifecycle para versiones no actuales |
| COST05-BP01 | Cannot Determine |  | Sin requisitos de coste documentados | Definirlos |
| COST05-BP02 | Partially Implemented | Low | Componentes conocidos y documentados | — |
| COST05-BP03 | Partially Implemented | Medium | Análisis hecho para el catálogo (`catalogo.ts`); no para el resto | Extender el análisis |
| COST05-BP04 | Implemented |  | Todo software libre o gestionado; sin licencias | — |
| COST05-BP05 | Implemented |  | Serverless con pago por uso: a volumen bajo es lo más barato posible | — |
| COST05-BP06 | Partially Implemented | Medium | `catalogo.ts` prevé cuándo cambiar de patrón por volumen ✓; sin modelo de coste a futuro | Modelar el coste a 1000 pedidos/día |
| COST06-BP01 | Not Implemented | Medium | Sin modelo de coste | Modelar |
| COST06-BP02 | Cannot Determine |  | Sin datos de uso no se puede dimensionar | Instrumentar y medir |
| COST06-BP03 | Partially Implemented | Low | Escalado automático por naturaleza de Lambda y DynamoDB | — |
| COST06-BP04 | Implemented |  | Tabla única compartida y una sola distribución por dominio | — |
| COST07-BP01 | Not Applicable |  | Sin cómputo reservable: Lambda y DynamoDB bajo demanda | Revisar Compute Savings Plans si Lambda pasa de ~$100/mes |
| COST07-BP02 | Partially Implemented | Medium | `us-east-1` es de las regiones más baratas ✓; no se evaluó la latencia a México | Comparar coste y latencia con `mx-central-1` |
| COST07-BP03 | Cannot Determine |  | Términos de Skydropx no constan en el repo | Revisar el contrato |
| COST07-BP04 | Partially Implemented | Low | Todo bajo demanda, coherente con volumen incierto | — |
| COST07-BP05 | Not Applicable |  | Sin cuenta de gestión ni Organizations | — |
| COST08-BP01 | Not Implemented | Medium | Sin modelado de transferencia | El catálogo se manda entero al navegador en cada visita: modelarlo |
| COST08-BP02 | Partially Implemented | Medium | CloudFront delante de lo estático ✓; **la API no está detrás del CDN**, así que cada respuesta sale por transferencia de API Gateway | Meter `/publico/*` bajo CloudFront |
| COST08-BP03 | Partially Implemented | High | CloudFront con `PriceClass_All`: se sirve desde todos los bordes del mundo para un negocio mexicano | Bajar a `PriceClass_100`; ahorro directo sin afectar a México |
| COST09-BP01 | Not Implemented | High | Sin análisis de demanda; nunca se ha medido el tráfico | Medir |
| COST09-BP02 | Not Implemented | High | **Sin amortiguador ni límite**: sin colas y sin throttling | Throttling en API Gateway y cola para el correo |
| COST09-BP03 | Implemented |  | Suministro dinámico por definición en Lambda y DynamoDB bajo demanda | — |
| COST10-BP01 | Partially Implemented | Low | `ESTADO.md` sección "Lo que sigue" hace de revisión | Formalizar cadencia |
| COST10-BP02 | Partially Implemented | Low | Revisión continua evidente en el historial | — |
| COST11-BP01 | Partially Implemented | Medium | Infraestructura automatizada en scripts idempotentes ✓; **despliegue y pruebas manuales** | Automatizar en CI |
| SUS01-BP01 | Partially Implemented | Low | `us-east-1` elegida por coste y por ser la región por defecto; sin criterio de sostenibilidad ni de cercanía al cliente mexicano | Comparar con `mx-central-1`: menos latencia y menos transporte de datos |
| SUS02-BP01 | Implemented |  | Lambda y DynamoDB bajo demanda: cero recursos ociosos | — |
| SUS02-BP02 | Cannot Determine |  | Sin SLA definido | Definir el objetivo de disponibilidad |
| SUS02-BP03 | Partially Implemented | Medium | **Stream de DynamoDB encendido sin ningún consumidor**: se mantiene un recurso que nadie lee. Cinco buckets para un proyecto pre-lanzamiento | Apagar el stream o conectarle el consumidor de correo que justifica su existencia |
| SUS02-BP04 | Partially Implemented | Medium | CloudFront `PriceClass_All` replica en bordes de todo el mundo para clientes de un solo país | `PriceClass_100` |
| SUS02-BP05 | Cannot Determine |  | Fuera del alcance del repo | Entrevista |
| SUS02-BP06 | Not Implemented | Medium | Sin amortiguación ni límite de tasa | Throttling y colas |
| SUS03-BP01 | Not Implemented | High | **Todo es síncrono**: correo y cotización dentro de la petición; el stream existe pero no alimenta nada asíncrono | Mover el correo a asíncrono por cola |
| SUS03-BP02 | Partially Implemented | Medium | `SearchResults.tsx` quedó sin uso tras el cambio del catálogo; `.design/` guarda 18,5 MB de lienzos con el editor repetido siete veces | Borrar el componente muerto; marcar `.design/` como generado |
| SUS03-BP03 | Partially Implemented | Low | `componer.ts` recorre sólo el rectángulo del estampado y no la imagen entera, con su razón escrita | — |
| SUS03-BP04 | Partially Implemented | Medium | Miniaturas con `loading="lazy"` y export estático ✓; **el catálogo entero se descarga al navegador en cada visita** | Paginar o cachear |
| SUS03-BP05 | Partially Implemented | High | Tabla única con acceso por llave ✓; **tres GSI con proyección `ALL`** guardan tres copias completas de cada ítem | Proyectar sólo lo necesario: menos almacenamiento y menos escritura |
| SUS04-BP01 | Not Implemented | Medium | Sin clasificación de datos | Clasificar |
| SUS04-BP02 | Implemented |  | DynamoDB para llave-valor y S3 para binarios: cada tecnología en su patrón | — |
| SUS04-BP03 | Partially Implemented | High | Lifecycle en `carritos/` ✓ y TTL en conexiones ✓; **logs infinitos**, versiones de S3 sin caducar y fotos huérfanas que nunca se borran | Lifecycle para versiones antiguas y retención en logs |
| SUS04-BP04 | Not Applicable |  | Sin almacenamiento de bloque ni sistemas de archivos | — |
| SUS04-BP05 | Partially Implemented | Medium | Fotos de producto huérfanas en S3 tras borrar un producto (decisión documentada y razonada); `.design/` duplica el editor siete veces | Revisar cuando el volumen lo justifique |
| SUS04-BP06 | Implemented |  | Buckets compartidos por función; tabla única | — |
| SUS04-BP07 | Partially Implemented | High | El catálogo completo viaja al navegador en cada visita y **sin caché**; la API no está detrás del CDN | Cachear en CloudFront |
| SUS04-BP08 | Partially Implemented | Medium | Versionado en dos buckets ✓; el arte de producción es irreproducible y sí merece copia, pero **PITR de DynamoDB está apagado** | Activar PITR; los pedidos no se pueden recrear |
| SUS05-BP01 | Partially Implemented | Medium | 512 MB sin haber medido si sobran o faltan | Power Tuning tras instrumentar |
| SUS05-BP02 | Not Implemented | Medium | `x86_64` en las cinco funciones; **arm64 (Graviton) consume menos energía y cuesta menos** | Migrar a `arm64` |
| SUS05-BP03 | Implemented |  | Todo gestionado: Lambda, DynamoDB, S3, CloudFront, Cognito, SES | — |
| SUS05-BP04 | Not Applicable |  | Sin aceleradores | — |
| SUS06-BP01 | Cannot Determine |  | Sin objetivos de sostenibilidad | Entrevista |
| SUS06-BP02 | Partially Implemented | Low | Despliegue rápido y reversible por función | — |
| SUS06-BP03 | Partially Implemented | Low | Runtime y dependencias al día; sin cadencia definida | Fijar cadencia |
| SUS06-BP04 | Not Applicable |  | Sin entornos de construcción compartidos; se construye en local | Revisar al montar CI |
| SUS06-BP05 | Not Applicable |  | Sin pruebas en dispositivos | — |

## Hallazgos críticos y altos, con su arreglo

Este proyecto no usa IaC declarativa: la infraestructura son scripts bash con AWS CLI
(`infra/*.sh`). Los arreglos van por tanto en **AWS CLI**, en el mismo dialecto del repo.

### 🔴 C1 · Cuota de Lambda de 10 concurrentes (REL01-BP01, REL01-BP06, PERF02-BP05)
Evidencia: `lambda get-account-settings` → `ConcurrentExecutions: 10`.

**Fix:**
```bash
# 1. Pedir la subida (tarda de horas a días en aprobarse)
aws service-quotas request-service-quota-increase \
  --service-code lambda --quota-code L-B99A9384 --desired-value 1000

# 2. Cuando esté aprobada, reservar por función para que no se pisen
aws lambda put-function-concurrency --function-name kustto-admin --reserved-concurrent-executions 300
aws lambda put-function-concurrency --function-name kustto-compradores --reserved-concurrent-executions 200
aws lambda put-function-concurrency --function-name kustto-proveedores --reserved-concurrent-executions 200
```

### 🔴 C2 · SES en sandbox (REL01-BP01, REL04-BP02)
Evidencia: `sesv2 get-account` → `ProductionAccessEnabled: false`, `Max24HourSend: 200`.

**Fix:**
```bash
aws sesv2 put-account-details \
  --production-access-enabled \
  --mail-type TRANSACTIONAL \
  --website-url https://kustto.com.mx \
  --use-case-description "Correos transaccionales de pedidos de un marketplace de personalizacion: confirmacion de compra al comprador y aviso de pedido al taller. Sin marketing. Bajas gestionadas por rebote."
```

### 🔴 C3 · Cero alarmas y cero notificación (OPS08-BP04, REL06-BP03, REL11-BP06)
Evidencia: `cloudwatch describe-alarms` y `sns list-topics` vacíos.

**Fix:**
```bash
TEMA=$(aws sns create-topic --name kustto-alertas --query TopicArn --output text)
aws sns subscribe --topic-arn "$TEMA" --protocol email --notification-endpoint tu@correo.mx

for F in kustto-admin kustto-compradores kustto-proveedores; do
  aws cloudwatch put-metric-alarm --alarm-name "$F-throttles" \
    --namespace AWS/Lambda --metric-name Throttles --dimensions Name=FunctionName,Value=$F \
    --statistic Sum --period 60 --evaluation-periods 1 --threshold 0 \
    --comparison-operator GreaterThanThreshold --alarm-actions "$TEMA"
  aws cloudwatch put-metric-alarm --alarm-name "$F-errores" \
    --namespace AWS/Lambda --metric-name Errors --dimensions Name=FunctionName,Value=$F \
    --statistic Sum --period 300 --evaluation-periods 1 --threshold 5 \
    --comparison-operator GreaterThanThreshold --alarm-actions "$TEMA"
done
```

### 🔴 C4 · PITR desactivado en la tabla (REL09-BP03)
Evidencia: `describe-continuous-backups` → `PointInTimeRecoveryStatus: DISABLED`.

**Fix:**
```bash
aws dynamodb update-continuous-backups --table-name kustto-prod \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### 🔴 C5 · Sin CloudTrail (SEC04-BP01, SEC10-BP03)
Evidencia: `cloudtrail describe-trails` vacío.

**Fix:**
```bash
aws s3api create-bucket --bucket kustto-cloudtrail-prod --region us-east-1
aws cloudtrail create-trail --name kustto --s3-bucket-name kustto-cloudtrail-prod --is-multi-region-trail
aws cloudtrail start-logging --name kustto
```

### 🔴 C6 · Usuario IAM con AdministratorAccess, dos llaves y sin MFA (SEC02-BP02, SEC02-BP05, SEC03-BP02)
Evidencia: `claude-admin` con `AdministratorAccess`, llaves `AKIATF52HQYLS4N5ZAEF` y
`AKIATF52HQYLZ3LELNAV` activas, `list-mfa-devices` vacío.

**Fix:**
```bash
# Borrar la llave que sobra y poner MFA en la que queda
aws iam delete-access-key --user-name claude-admin --access-key-id AKIATF52HQYLZ3LELNAV
aws iam enable-mfa-device --user-name claude-admin --serial-number <arn-del-dispositivo> \
  --authentication-code1 <codigo1> --authentication-code2 <codigo2>
```

### 🔴 C7 · Sin idempotencia en el pago (REL04-BP04)
Evidencia: sin `ClientRequestToken` ni candado en `services/admin/src/rutas/pedidos.ts`.

**Fix (código, dentro de la transacción que ya existe en `escribirCompra`):**
```ts
// El navegador manda `Idempotency-Key` (un UUID por intento de pago).
// El candado entra en la MISMA transacción: si el reintento llega, la
// transacción entera se cancela y no se cobra ni se descuenta dos veces.
TransactItems: [
  {
    Put: {
      TableName: TABLA,
      Item: { pk: `IDEM#${claveDeIdempotencia}`, sk: "LOCK", compraId },
      ConditionExpression: "attribute_not_exists(pk)",
    },
  },
  // ...la compra, los pedidos, el candado de folio y los descuentos que ya se escriben
]
```

### 🔴 C8 · Skydropx sin timeout y apuntando a sandbox (REL05-BP05, REL05-BP04)
Evidencia: `skydropx.ts:75,133` sin `AbortSignal`; `SKYDROPX_HOST=https://sb-pro.skydropx.com`.

**Fix:**
```ts
// services/*/src/lib/skydropx.ts — las dos llamadas
const res = await fetch(`${HOST}${ruta}`, {
  // ...lo que ya hay
  // Tres segundos: por encima de eso la cotización ya no sirve para una
  // pantalla, y seguir esperando le quita concurrencia al resto del sitio.
  signal: AbortSignal.timeout(3000),
});
```
```bash
aws lambda update-function-configuration --function-name kustto-admin \
  --environment "Variables={SKYDROPX_HOST=https://pro.skydropx.com,...}"   # conservar el resto
```

### 🔴 C9 · Enlaces de los correos apuntando a localhost (fuera del framework, defecto presente)
Evidencia: `KUSTTO_SITIO` sin definir → `correo.ts:63-68` cae a `KUSTTO_ORIGEN=http://localhost:3000`.

**Fix:**
```bash
# Añadir KUSTTO_SITIO a las dos funciones que mandan correo
aws lambda update-function-configuration --function-name kustto-admin \
  --environment "Variables={KUSTTO_SITIO=https://kustto.com.mx,...}"       # conservar el resto
```

### 🟠 A1 · Sin throttling ni WAF en las rutas públicas de escritura (REL05-BP02, SEC05-BP03, COST02-BP05)
Evidencia: `ThrottlingRateLimit: null`; `WebACLId: ""`; `POST /publico/pedidos` abierta.

**Fix:**
```bash
aws apigatewayv2 update-stage --api-id kd8ydpp2c6 --stage-name '$default' \
  --default-route-settings ThrottlingRateLimit=200,ThrottlingBurstLimit=400 \
  --route-settings '{"POST /publico/envios/cotizar":{"ThrottlingRateLimit":2,"ThrottlingBurstLimit":5}}'
```

### 🟠 A2 · Secretos en variables de entorno en claro (SEC02-BP03)
Evidencia: `SKYDROPX_CLIENT_SECRET` y `SKYDROPX_WEBHOOK_SECRETO` legibles con `get-function-configuration`.

**Fix:**
```bash
aws ssm put-parameter --name /kustto/skydropx/client-secret --type SecureString --value "<valor>"
# y leerlo en el arranque de la Lambda con @aws-sdk/client-ssm en vez de process.env
```

### 🟠 A3 · Retención de logs infinita (COST04-BP05, OPS08-BP02)
Evidencia: los cinco grupos con `retentionInDays: None`.

**Fix:**
```bash
for F in admin compradores proveedores correo eventos; do
  aws logs put-retention-policy --log-group-name /aws/lambda/kustto-$F --retention-in-days 30
done
```

### 🟠 A4 · Sin presupuesto ni detección de anomalías de coste (COST01-BP03, COST01-BP06)
**Fix:**
```bash
aws budgets create-budget --account-id 467685081574 --budget \
  '{"BudgetName":"kustto-mensual","BudgetLimit":{"Amount":"100","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}'
```

### 🟠 A5 · CORS de producción admite localhost (SEC09-BP03)
Evidencia: `AllowOrigins` incluye `http://localhost:3000/3001/3002`.

**Fix:**
```bash
KUSTTO_ORIGENES="https://kustto.com.mx,https://www.kustto.com.mx,https://backoffice.kustto.com.mx" \
  bash infra/cors.sh
```

### 🟠 A6 · Sin trazas ni métricas detalladas (OPS04-BP05, OPS08-BP01)
**Fix:**
```bash
for F in kustto-admin kustto-compradores kustto-proveedores kustto-correo kustto-eventos; do
  aws lambda update-function-configuration --function-name $F --tracing-config Mode=Active
done
aws apigatewayv2 update-stage --api-id kd8ydpp2c6 --stage-name '$default' \
  --default-route-settings DetailedMetricsEnabled=true
```

### 🟠 A7 · Sin CI, sin pruebas, sin entorno de pruebas (OPS05-BP08, OPS05-BP10, OPS06-BP02)
Evidencia: sin `.github/workflows`, cero archivos `*.test.ts`, un solo entorno `kustto-prod`.

### 🟠 A8 · Tres GSI con proyección `ALL` (PERF03-BP02, SUS03-BP05)
Evidencia: `tabla.sh` — `"Projection": {"ProjectionType": "ALL"}` en los tres.
Cada escritura de producto se replica cuatro veces. Requiere recrear el índice, así que es un
cambio a planificar, no un arreglo rápido.

## Matriz de prioridades

| Cuadrante | Acción | Hallazgos |
|---|---|---|
| **Hacer primero** (mucho valor, poco esfuerzo) | Esta semana | C1, C2, C3, C4, C5, C6, C8(host), C9, A3, A4, A5, A6 |
| **Planificar** (mucho valor, mucho esfuerzo) | Hoja de ruta | C7, C8(patrón asíncrono), A1, A2, A7, A8, caché del catálogo |
| **Delegar** (poco valor, poco esfuerzo) | Cuando toque | Versionado del bucket del sitio, `PriceClass_100`, borrar `SearchResults.tsx` |
| **Aplazar** (poco valor, mucho esfuerzo) | Otra iteración | Multi-región, ingeniería del caos, CMK propias, Macie |

## Qué NO hacer todavía (optimización prematura)

- **Multi-región y DR activo-activo.** Con criticidad estándar y sin un solo pedido real, es
  gastar meses en un riesgo que no es el que te va a morder.
- **Migrar a `arm64` ahora mismo.** El ahorro es del 20 % sobre una factura de céntimos. Cuando la
  Lambda pase de ~$50/mes.
- **Materializar el catálogo en S3.** `catalogo.ts` ya dice cuándo: cuando pasen de unos cientos
  de productos. Hoy hay cuatro. La cabecera `Cache-Control` cubre el hueco mientras tanto.
- **Reparticionar `PRODUCT_ESTADO#activo`.** Mismo caso: primero caché, y sólo si el throttling
  aparece de verdad en las métricas.
- **Provisioned concurrency.** Los arranques en frío no son tu problema; la cuota de 10 sí.
- **KMS con llaves propias, Macie, Security Hub.** Sin requisito de cumplimiento que lo pida.
- **Ingeniería del caos y game days.** Antes hay que tener alarmas que puedan sonar.
