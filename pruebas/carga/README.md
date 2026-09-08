# Pruebas de carga de la API

Este banco apunta exclusivamente a la API aislada creada por
`infra/pruebas-api.sh`. El runner contiene además un bloqueo explícito para el
dominio y el API ID de producción.

## Crear o actualizar el entorno

```sh
pnpm test:env
source infra/.pruebas-api
```

El entorno usa una tabla DynamoDB y un bucket propios. Copia sólo categorías,
plantillas, productos activos y únicamente los campos públicos de proveedores. No
copia clientes, correos, pedidos, compras, eventos ni conexiones.

El pool `kustto-test-compradores` también es independiente. Sus usuarios se
crean administrativamente, sin enviar correos ni permitir autoregistro. Los
pools de admin y proveedor todavía sólo se reutilizan para pruebas funcionales;
los escenarios de carga no apuntan a ellos.

La API de pruebas no tiene credenciales de correo o Skydropx, no emite eventos
WebSocket y no enruta trabajos de bordado.

## Probar el frontend local contra este entorno

```sh
pnpm dev:test
```

El comando funciona tanto desde la raíz del repositorio como desde `apps/web`.
Carga `infra/.pruebas-api` y pasa el endpoint y el cliente Cognito aislado al
proceso, por lo que no hace falta modificar `.env.local`. Una sesión creada
contra producción no sirve en este entorno: hay que entrar con uno de los
usuarios sintéticos. Todos los cambios se escriben en `kustto-test`.

## Smoke test

```sh
curl --fail --silent --show-error "$KUSTTO_PRUEBAS_API/publico/catalogo" >/dev/null
curl --fail --silent --show-error "$KUSTTO_PRUEBAS_API/publico/categorias" >/dev/null
```

## Carga sostenida con k6

Si tienes `k6` instalado:

```sh
KUSTTO_LOAD_TEST=SI \
KUSTTO_TEST_API="$KUSTTO_PRUEBAS_API" \
PROFILE=load RPS=20 WARMUP=30s DURATION=5m \
k6 run pruebas/carga/kustto-api.js
```

Sin instalarlo, se puede usar su imagen oficial:

```sh
docker run --rm -i \
  -e KUSTTO_LOAD_TEST=SI \
  -e KUSTTO_TEST_API="$KUSTTO_PRUEBAS_API" \
  -e PROFILE=load \
  -e RPS=20 \
  -e WARMUP=30s \
  -e DURATION=5m \
  grafana/k6 run - < pruebas/carga/kustto-api.js
```

`PROFILE=load` sube gradualmente desde 1 RPS hasta el objetivo durante
`WARMUP` y después sostiene la carga durante `DURATION`. Para medir el impacto
de un salto en frío usa `PROFILE=spike`; en ese perfil `WARMUP` se ignora y la
carga objetivo empieza de inmediato.

Empieza con 10–20 RPS. La API queda limitada por defecto a 50 RPS y cada
Lambda a 20 ejecuciones simultáneas. Las respuestas `429`, los errores de red
y los `5xx` se reportan por separado. Cualquier error inesperado hace fallar el
test, incluidos los `5xx` que API Gateway devuelve cuando Lambda agota
concurrencia.

Para cambiar el techo hay que redesplegar explícitamente:

```sh
KUSTTO_TEST_RPS=100 KUSTTO_TEST_BURST=100 KUSTTO_TEST_CONCURRENCY=40 \
AWS_PROFILE=kustto-admin bash infra/pruebas-api.sh
```

Para buscar el límite por encima de la configuración segura inicial existe un
perfil de infraestructura con 200 RPS y 50 concurrencias por Lambda:

```sh
pnpm test:env:stress
```

Ese perfil todavía deja concurrencia libre para producción, pero sólo debe
estar activo mientras se mide. `pnpm test:env` devuelve los límites a 50/20.

Los logs de las tres Lambdas se conservan 14 días y los objetos subidos al
bucket de pruebas caducan a los 7 días.

## Usuarios autenticados y pedidos reales

Prepara o renueva los tokens de 20 usuarios sintéticos:

```sh
pnpm test:users:prepare
```

Los tokens duran una hora y se guardan, con permisos locales restringidos, en
`pruebas/carga/.usuarios.json`. Ni tokens ni contraseña entran a Git.

Para ejecutar directamente un escenario mixto:

```sh
source infra/.pruebas-api
KUSTTO_LOAD_TEST=SI \
KUSTTO_TEST_API="$KUSTTO_PRUEBAS_API" \
CONCURRENT_USERS=20 USERS_RPS=0 ORDERS_RPS=1 \
DURATION=2m \
k6 run pruebas/carga/kustto-usuarios-pedidos.js
```

`CONCURRENT_USERS` simula identidades simultáneas y aplica una pausa de un
segundo entre acciones. `ORDERS_RPS` crea pedidos reales en `kustto-test`, con
entrega por recolección para no llamar a paquetería. Sí ejecuta la transacción
real de DynamoDB, genera folios, descuenta inventario y firma los artefactos.

## Encontrar capacidad por escalones

```sh
pnpm stress:users
pnpm stress:orders
```

El primero prueba por defecto 10, 25, 50 y 100 usuarios concurrentes. El
segundo prueba 1, 2, 5 y 10 pedidos por segundo. Cada escalón dura 30
segundos y el script se detiene en el primero que supere 1% de errores o los
p95 de 1 segundo para actividad de usuario y 2 segundos para pedidos.

Los resúmenes quedan en `pruebas/carga/resultados/`. Se pueden cambiar los
escalones y la duración sin editar archivos:

```sh
KUSTTO_STRESS_STEPS="25 50 100 150" \
KUSTTO_STRESS_DURATION=1m \
pnpm stress:users
```

El resultado representa usuarios concurrentes activos, con una acción por
segundo, y pedidos aceptados por segundo bajo ese catálogo. No equivale por sí
solo a usuarios registrados totales: estos últimos no mantienen conexiones ni
consumen capacidad mientras están inactivos.
