# Kustto

Mercado mexicano de personalización bajo demanda. El cliente elige una prenda
del catálogo, la diseña en el navegador y la pide **desde una pieza**; un
taller la produce.

> Antes se llamaba fabbo / P&P Custom. El repo y algunos identificadores
> viejos todavía dicen `P-P-Custom`; el producto es Kustto.

---

## Estado: estamos a media migración

Hay **dos backends corriendo al mismo tiempo** y es a propósito. El objetivo
es que la app viva entera en AWS serverless para poder desplegarla casi
gratis mientras no hay clientes. La migración va de arriba hacia abajo:
primero admin, luego proveedores, después catálogo y pedidos.

| Dominio | Dónde vive hoy | Estado |
|---|---|---|
| Plantillas de prenda | Lambda `kustto-admin` + DynamoDB | migrado |
| Categorías (admin) | Lambda `kustto-admin` + DynamoDB | migrado |
| Alta de proveedores | Lambda `kustto-admin` + Cognito + DynamoDB | migrado |
| Subida de mockups | S3 con URL prefirmada | migrado |
| Imágenes de categorías | S3 con URL prefirmada (`/medios/...`) | migrado |
| Login de proveedores | Cognito, directo desde el navegador | migrado |
| Panel del proveedor (perfil) | Lambda `kustto-proveedores` | migrado |
| Alta de productos del taller | Lambda `kustto-proveedores` + DynamoDB + S3 | migrado |
| Revisión de productos (admin) | Lambda `kustto-admin` + DynamoDB | migrado |
| Catálogo público (listado, ficha, editor) | Lambda `kustto-admin` + DynamoDB | migrado |
| Categorías (público) | Lambda `kustto-admin` + DynamoDB | migrado |
| Paquetes | NestJS + Postgres | **pendiente** |
| Pedidos (API) | Lambdas + DynamoDB + S3 | migrado |
| Pedir desde el editor | Lambdas + DynamoDB + S3 | migrado |
| Panel de pedidos del taller | Lambda `kustto-proveedores` | migrado |
| Avisos en vivo al panel | API WebSocket `kustto-eventos-ws` | migrado |
| Cuentas de comprador | Cognito (pool aparte) + Lambda `kustto-compradores` | migrado |
| Panel del comprador (`/cuenta`) | Lambda `kustto-compradores` | migrado |
| Existencias del taller | DynamoDB, dentro del producto | obligatorias; falta el aviso al comprador |
| Carrito de varios talleres | Navegador + Lambda `kustto-compradores` | migrado |
| Checkout multi-parte (`/pedir/carrito`) | Lambdas + DynamoDB | migrado |
| Aviso por correo | SES, **fuera del sandbox** (se envía asumiendo un rol en la cuenta root) | migrado |
| Cotización de envío (Skydropx) | Lambda `kustto-admin` + sandbox | migrado |
| Compra de guía (taller) | Lambda `kustto-proveedores` + Skydropx | migrado |
| Rastreo para el comprador | Webhook de Skydropx → Lambda `kustto-admin` | migrado |
| Pasarela de pago | no existe | aplazado a propósito, hasta el final |

**Reglas de la casa mientras dure esto:**

- Lo que ya está en AWS **no se vuelve a tocar en Nest**. Si necesitas
  cambiar plantillas o proveedores, se hace en `services/`.
- Los productos que hay en Postgres son **de prueba y desechables**. No
  inviertas en migrarles datos; cuando toque, se vuelven a sembrar.
- Reescribir lógica desde cero es aceptable y a menudo más barato que
  portarla. La lógica ya existe y se entiende; el costo está en la
  infraestructura, no en el código.

---

## Puesta en marcha en una máquina nueva

### 1. Lo que necesitas instalado

- Node 20+ y `pnpm` (`corepack enable`)
- Docker Desktop (para Postgres y la API de Nest, mientras existan)
- AWS CLI v2

### 2. El perfil de AWS

Todo lo de AWS asume un perfil llamado **`kustto-admin`** en la región
**`us-east-1`**. Créalo con las credenciales del usuario IAM `claude-admin`
(las llaves las tienes tú; no están ni pueden estar en el repo):

```bash
aws configure --profile kustto-admin
```

Comprueba que quedó bien:

```bash
aws sts get-caller-identity --profile kustto-admin
```

Debe responder con la cuenta `218897024535`.

> En Windows el instalador de AWS no siempre deja `aws` en el PATH de Git
> Bash. Los scripts de `infra/` ya caen solos a
> `~/AppData/Local/Programs/Amazon/AWSCLIV2/aws.exe`, así que no hace falta
> arreglar el PATH para usarlos.

### 3. Los secretos que NO viajan en el repo

Varios archivos están en `.gitignore` y hay que recuperarlos. **Ninguno hay que
inventarlo: se recuperan de AWS.**

Si te encuentras un `services/admin/.clave-admin`, **bórralo**: era la llave
compartida del admin y ya no existe. El backoffice se abre con un token del
pool `kustto-admins` (ver abajo).

**`infra/.cognito`** — los identificadores del pool. El script es idempotente:
si el pool ya existe no crea nada, sólo lo busca y reescribe el archivo.

```bash
bash infra/cognito.sh
```

**`infra/.websocket`** — los identificadores del canal en vivo. Igual de
idempotente: si la API ya existe no crea otra.

```bash
bash infra/websocket.sh
```

**`apps/web/.env.local`** — la configuración del front. Se arma con lo
anterior:

```
# El pool del backoffice. Lo escribe infra/cognito-admin.sh en
# infra/.cognito-admin. No es secreto: el navegador habla directo con Cognito.
NEXT_PUBLIC_ADMIN_CLIENTE=<el de infra/.cognito-admin>

# Cognito y la API de proveedores. Estos SÍ llevan NEXT_PUBLIC: el navegador
# habla directo con Cognito, y ni el id del pool ni el del cliente son
# secretos (el cliente se creó sin secret a propósito).
NEXT_PUBLIC_KUSTTO_API=https://kd8ydpp2c6.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_CLIENTE=<KUSTTO_POOL_CLIENTE de infra/.cognito>

# El pool de COMPRADORES, que es OTRO distinto al de talleres a proposito: con
# uno solo, un token de taller abriria /cuenta/*. Salen de
# infra/.cognito-compradores, que regenera `bash infra/cognito-compradores.sh`.
NEXT_PUBLIC_COGNITO_COMPRADORES_CLIENTE=<KUSTTO_COMPRADORES_CLIENTE>
NEXT_PUBLIC_COGNITO_COMPRADORES_DOMINIO=<KUSTTO_COMPRADORES_DOMINIO>

# El canal en vivo del panel del taller. Tampoco es secreto: la conexión la
# autoriza el token de Cognito, no esta URL.
NEXT_PUBLIC_KUSTTO_WS=<KUSTTO_WS_URL de infra/.websocket>
```

> Copia el id del cliente **entero** (son 26 caracteres). Cortado, Cognito
> responde `ResourceNotFoundException` con un 400 que parece un problema de
> credenciales o de red, y se pierde un buen rato buscando en el lugar
> equivocado. Si el login de proveedores falla, compara ese valor con
> `infra/.cognito` antes que nada.

### 4. Levantar

```bash
pnpm install
```

Postgres y la API de Nest (los que aún no se migran):

```bash
docker compose up -d postgres api
```

El front, **desde Windows, no desde el contenedor**:

```bash
pnpm --filter web dev
```

> ⚠️ Levanta `web` en el host, no con `docker compose up web`. El contenedor
> corre `pnpm install` de todo el workspace y escribe enlaces simbólicos de
> Linux dentro de `apps/web/node_modules`, lo que rompe el binario nativo
> `@next/swc-win32-x64-msvc` y deja a `next dev` con un
> `Cannot find module 'next'`. El `docker-compose.yml` ya monta un volumen
> para tapar eso, pero el camino probado es levantar el front en el host.
>
> Si te pasa de todas formas: borra `apps/web/node_modules` **desde
> PowerShell** y vuelve a instalar.

Sembrar datos de prueba en Postgres (18 productos, 4 categorías, 4 paquetes,
5 plantillas):

```bash
pnpm db:migrate && pnpm db:seed
```

Los ids del seed son UUIDv5 derivados del slug, así que **no cambian entre
siembras**: un enlace a un producto sigue funcionando después de re-sembrar.

---

## Mapa del repo

```
apps/
  web/                 Next.js 16 + React 19 + Tailwind v4. El front entero.
  api/                 NestJS + Drizzle + Postgres. Lo que falta por migrar.
services/              Las Lambdas. Un paquete de pnpm por función.
  admin/               Plantillas, categorías, proveedores, catálogo, pedidos.
  proveedores/         El panel del taller, detrás del autorizador JWT.
  compradores/         La cuenta del comprador, detrás de OTRO autorizador.
  eventos/             Las conexiones WebSocket del panel. Ver infra/README.md
infra/                 Scripts de bash idempotentes que CREAN el AWS. Ver infra/README.md
packages/db/           Esquema de Drizzle y el seed de Postgres.
.design/               Los lienzos de diseño. Ver .design/README.md
migrations/            SQL generado por drizzle-kit.
```

### Puntos del front que conviene conocer antes de tocar nada

**`apps/web/lib/api/`** — hay cuatro clientes y no son intercambiables:

- `catalogo.ts` → el catálogo público, directo a API Gateway y **sin
  credenciales de ningún tipo**: es lo que ve cualquiera que abra la tienda.
  Sólo devuelve productos aprobados. Si necesitas leer catálogo, es este.
- `api.ts` (`apiFetch`) → la API de Nest. Sólo quedan ahí los paquetes y las
  cuentas de comprador.
- `admin.ts` (`adminFetch`) → la Lambda de admin, **directo a API Gateway bajo
  `/admin/*`**, con el token del pool `kustto-admins` en la cabecera. Antes
  pasaba por un route handler de Next que agregaba una llave compartida; se
  quitó al publicar el backoffice, porque una página estática no puede guardar
  un secreto.
- `proveedores.ts` → la Lambda de proveedores, directo a API Gateway. Aquí
  sí va directo porque el permiso lo lleva el token del propio proveedor, no
  un secreto nuestro.
- `cuenta.ts` → la Lambda de compradores, también directo y por la misma
  razón. Es OTRO pool de Cognito que el de proveedores: los dos tokens no se
  cruzan porque cada prefijo tiene su propio autorizador.

**Nada que decida cuánto se cobra puede venir del navegador.** Ni el precio del
producto, ni el peso, ni el costo del envío. El checkout manda qué se pide y a
dónde; el peso sale del producto y el precio del envío se le pregunta a
Skydropx con el id de la cotización. Está comprobado que el cuerpo se puede
falsificar: se mandó `"precio": 1` y se guardó el real.

**Los toasts son de `sonner`, vestidos con los tokens de la marca**
(`components/ui/sonner.tsx`). `richColors` va apagado a propósito: enciende
verdes y rojos propios que chocan con lima y con el rojo de los avisos. El
acento lo pone el icono.

**El inventario NO se edita en línea.** Cada variante se ajusta desde su botón,
que abre un diálogo donde hay que elegir qué pasó —llegó, se fue, o lo conté—,
escribir cuánto y confirmar viendo el resultado. Antes eran casillas sueltas
con un "Guardar" al final y se podía salir creyendo que había quedado. El
número del toast sale de la RESPUESTA del servidor, no de lo que el navegador
calculó: si un pedido descontó mientras tanto, lo que vale es lo que quedó.

**Nunca hagas un `Query` a DynamoDB sin `consultarTodo`**
(`services/*/src/lib/dynamo.ts`). DynamoDB corta toda respuesta en 1 MB y
devuelve `LastEvaluatedKey`; quien no lo lee recibe una respuesta a medias
**sin error de por medio**. Ya pasó: el catálogo y las bandejas perdían filas
en silencio. El helper sigue las páginas y avisa en el log si corta.

**`apps/web/app/admin/Guardia.tsx`** — **no es la seguridad del backoffice**.
Sólo evita enseñar un panel vacío a quien no ha entrado. Lo que de verdad lo
cierra es el autorizador JWT de `/admin/*` en la API Gateway: sin token no hay
un solo dato, se pinte lo que se pinte en el navegador.

**`apps/web/lib/auth/pool.ts`** — la fábrica de sesiones de Cognito. Los tres
pools la comparten y cada uno le pasa su id de cliente y su llave de
`localStorage`. **No la compartas entre pools**: entrar al backoffice cerraría
la sesión del taller en la misma máquina.

**Los mockups tienen que servirse desde el mismo origen que el sitio.** El
teñido de prenda (`lib/fabric/prenda.ts`) hace `getImageData()` sobre ellos;
desde otro origen el canvas queda contaminado, el navegador lanza
`SecurityError` y el teñido **se apaga sin decir nada**. Por eso:

- se guardan en S3 con el bucket cerrado,
- se leen siempre por la ruta `/mockups/...`,
- en desarrollo un rewrite de `next.config.ts` los pide a la Lambda,
- en producción los servirá CloudFront con OAC. Misma ruta en los dos lados.

Cloudinary queda descartado para mockups por esta misma razón.

**El diseño viaja del editor al checkout por IndexedDB**
(`lib/pedido/borrador.ts`). El lienzo de Fabric no sobrevive a la navegación,
así que al pulsar "Pedir" se exporta el arte ANTES de salir y se guarda. No es
`sessionStorage` a propósito: lo que se lleva son PNG de producción a 300 DPI
—megabytes— y ahí sólo caben cadenas.

**Al PNG exportado hay que escribirle la resolución a mano**
(`lib/designer/dpi.ts`). `canvas.toDataURL()` no escribe el chunk `pHYs`, y sin
él el archivo se abre asumiendo 72 DPI: un arte de 28 cm se interpreta como
116. Es un fallo mudo —el archivo abre bien y se ve bien— y sólo se descubre
cuando sale la prenda.

**Cuidado con `clearTimeout` en la limpieza de un efecto que corre una sola
vez.** En modo estricto React monta, limpia y vuelve a montar; si hay un
guardia en una ref que impide el segundo arranque, la limpieza del primero deja
la acción sin ejecutarse **nunca**. Está comentado en
`components/Designer/SalidaAPedir.tsx`, donde ya pasó.

**Las animaciones de entrada son CSS, no framer-motion**
(`components/Catalogo/Aparece.tsx`). El estado base es *visible* y la
animación va *desde* opacidad 0, así que el peor caso es que no haya
animación — nunca una página en blanco. Con `whileInView` de framer-motion
pasó justo eso: 23 bloques quedaron en opacidad 0.

**Los breakpoints grandes van con sintaxis arbitraria** (`min-[1280px]:` en
vez de `xl:`). Tailwind ordena las variantes y `xl:` le ganaba a
`min-[1400px]:`; escribiéndolos todos como arbitrarios se ordenan por ancho,
que es lo que uno espera.

---

## Convenciones

- **El código y los comentarios van en español.** Los identificadores nuevos
  también (`crearRouter`, `sinLlaves`, `noAutorizado`). Lo viejo en inglés se
  deja como está hasta que toque tocarlo.
- **Nada de framework en las Lambdas.** El router de `services/*/src/lib/http.ts`
  son treinta líneas. Meter Nest ahí costaría uno a tres segundos de arranque
  en frío a cambio de decoradores que no necesitamos.
- **Un formateador:** `pnpm format` (Biome). `pnpm lint` para revisar.
- `pnpm type-check` en la raíz, y **está en cero**: si sale algo, es tuyo.
  `pnpm --filter web build` tiene que pasar antes de cualquier despliegue.

---

## Lo que sigue

En orden, de lo más útil a lo más lejano. El detalle y el porqué están en
`ESTADO.md`, que es lo que hay que leer antes de empezar.

1. **Cerrar los envíos.** Los pasos 1-9 funcionan contra el sandbox, pero al
   taller le faltan **dos pantallas**: capturar el peso real y descargar la
   etiqueta. Sin ellas la guía sólo se puede pedir por API, así que el flujo
   está hecho y no se puede usar. Es lo más cerca de terminado que hay.
2. **SES: salir del sandbox.** El dominio ya está verificado y el buzón recibe.
   Falta el trámite para poder escribirle a cualquiera — hoy sólo a direcciones
   verificadas. Sin eso, el comprador pierde su enlace de seguimiento si cierra
   la pestaña, y el taller no se entera de un pedido con el panel cerrado.
3. **Cerrar las existencias.** El backend está y verificado; falta el aviso de
   "+N días" al comprador, las alertas de bajas y la capacidad semanal. Ojo: el
   aviso sólo tiene sentido si el producto tiene `diasExtraSinStock > 0`.
4. **Rechazar un pedido y mover con nota** desde el panel del taller. La API ya
   acepta las dos cosas; falta la interfaz.
5. **Contraseña del taller**: no hay forma de cambiarla ni de restablecerla.
6. **El panel del taller en móvil**, que hoy no funciona.
7. **Tracking** (paso 12): el webhook de Skydropx, con verificación de firma.
   Con él, `entregado` lo pone la paquetería en vez de una persona.
8. **Fotos de mockup de verdad.** Sin ellas no hay previsualización realista, y
   la plantilla actual es un dibujo de línea con las guías incrustadas.
9. ~~**Login de admin.**~~ — **hecho** (4 de septiembre). El backoffice vive
   en **https://backoffice.kustto.com.mx** con su propio pool
   (`kustto-admins`), sus rutas `/admin/*` detrás de un autorizador JWT y sin
   la llave compartida, que se eliminó.
10. ~~CloudFront + OAC~~ y ~~el carrito de varios talleres~~ — **hechos**
    (3 de septiembre). El sitio vive en **https://kustto.com.mx**. Sigue
    pendiente lo que aquello destapaba: la partición caliente de
    `PRODUCT_ESTADO#activo`, que satura a unas 20 peticiones por segundo, y
    que **el flujo de envío asume un paquete por pedido** — cincuenta playeras
    no van en una caja.
11. **Seguimiento y correos de la COMPRA.** Hoy los avisos salen por pedido, o
    sea por parte; nadie habla de la compra entera salvo la confirmación.
12. **Migrar paquetes**, lo último que queda en Nest.
13. **Pagos**: Stripe (paso 5) y, por separado, **liquidaciones al taller** —
    que es lo que falta para poder cobrar de verdad los cargos de envío que ya
    se están registrando en `saldoEnvios`.

La lista de limpieza —plantillas rotas, acentos, código muerto, cuentas de
prueba— vive en `ESTADO.md` para no duplicarla aquí.
