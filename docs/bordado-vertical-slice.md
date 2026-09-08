# Primer vertical slice productivo de bordado

Este slice permanece apagado y no está conectado a checkout, pedidos ni taller.

## Flujo

```text
Editor (EmbroideryDesign en mm)
  -> POST /bordados/jobs (JWT comprador, 202)
  -> DynamoDB + snapshot privado S3
  -> SQS (sólo jobId/designHash)
  -> Lambda Container ARM64 (Ink/Stitch 3.3.0)
  -> pyembroidery + decodificador Tajima independiente
  -> staging S3 -> artefactos inmutables
  -> READY | REVIEW | REJECTED | FAILED
  -> GET /bordados/jobs/:jobId + preview firmada
```

La adquisición `QUEUED -> PROCESSING` y cada cierre desde `PROCESSING` son condicionales. Reenviar un mensaje no vuelve a procesar un job adquirido. Un `FAILED` sólo vuelve a `QUEUED` mediante `retry: true`, con máximo de tres intentos.

## Alcance de entrada V2

El editor prepara texto, vectores y **raster (PNG/JPG)**. Todo el trabajo pesado
—segmentación, cuantización, limpieza, eliminación por área mínima en mm,
esqueleto y geometría— corre en un **Web Worker**, no en el hilo principal:
medido en Chrome, 2.5 s de preparación con 152 fotogramas y un salto máximo
entre ellos de 16.8 ms.

Antes de cuantizar se pregunta si la imagen era de tono continuo, porque
cuantizar destruye esa señal. Fotografías y degradados se rechazan **en el
navegador**, sin crear trabajo ni arrancar el motor.

Los presupuestos de cómputo (`EmbroideryProfile.presupuesto`) acotan la
ejecución de entradas patológicas: una fotografía posterizada pasó de no
terminar nunca a resolverse en 487 ms con
`COMPLEJIDAD_AUTOMATICA_EXCEDIDA`, que es distinto de `DISENO_NO_BORDABLE` —
"no puedo prepararlo" no es "no se puede bordar".

El perfil `experimental-v2-2026-09-06` declara `physicallyValidated: false`. No
debe promoverse a fabricación automática hasta completar test-sew por tela,
backing, hilo, aguja, máquina y taller.

## Un contrato, dos lenguajes

`packages/bordado/src/validation.ts` y `services/bordados-worker/worker.py`
validan **lo mismo** por separado, a propósito: el navegador no es de fiar. El
E2E en AWS destapó que la mitad de Python se había quedado atrás en dos cosas a
la vez —sólo conocía el perfil v1 y rechazaba todo `sourceType: "raster"`— y el
resultado era que **el 100 % de los trabajos moría en FAILED**. Cuando se toque
una de las dos, hay que tocar la otra; los tests de `tests/test_worker.py` van
contra el último perfil justamente para que el olvido salte en local.

## Activación

- Frontend: `NEXT_PUBLIC_EMBROIDERY_AUTO_DIGITIZATION=false`.
- API/worker: `KUSTTO_EMBROIDERY_ENABLED=false`.
- Infraestructura: `infra/bordado.sh` es explícito y no está enlazado a los despliegues generales.

## Validación local

```sh
pnpm --filter @kustto/bordado test
pnpm --filter @kustto/bordados-api test
python3 -m unittest discover -s services/bordados-worker/tests -v
python3 services/bordados-worker/tests/smoke_inkstitch.py
pnpm --filter web build
```

Banco de clasificación (63 imágenes) y regresiones de texto:

```sh
cd apps/web && npx tsx ../../pruebas/bordado/regresion/banco-corpus.ts
```

Prueba de que la preparación no bloquea el hilo principal, en Chrome real:

```sh
node pruebas/bordado/navegador/construir.mjs && node pruebas/bordado/navegador/correr.mjs
```

## E2E contra AWS

`pruebas/bordado/e2e/` monta un arnés que NO expone nada al cliente: una Lambda
temporal con el mismo código pero sin ruta de API Gateway, y una tabla de
productos aparte para no meter un producto activo en el catálogo real. El flag
del worker se enciende sólo mientras dura la prueba.

```sh
bash pruebas/bordado/e2e/montar.sh montar
node pruebas/bordado/e2e/correr.mjs
node pruebas/bordado/e2e/validar-artefactos.mjs
bash pruebas/bordado/e2e/montar.sh desmontar   # devuelve el flag a false
```

**`desmontar` no es opcional**: es lo que devuelve `KUSTTO_EMBROIDERY_ENABLED`
del worker a `false` y borra la Lambda, el rol y la tabla temporales.

La suite Python necesita Pillow y pyembroidery. Las pruebas del worker usan los DST deterministas del spike como sustituto del subprocess para verificar el resto del worker (reapertura, Tajima, preview, metadata y checksums). `smoke_inkstitch.py` sí invoca el Ink/Stitch real dentro de la imagen ARM64; el benchmark completo de la misma versión está en `pruebas/bordado/aws-benchmark/`.
