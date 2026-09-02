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
| Pedidos (carrito y salida del editor) | no existe | **lo que sigue** |
| Aviso por correo al taller | SES, en sandbox | **falta verificar el dominio** |
| Cuentas de comprador | NestJS + Postgres | **pendiente** |
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

Tres archivos están en `.gitignore` y hay que recuperarlos. **Ninguno hay que
inventarlo: los tres se recuperan de AWS.**

**`services/admin/.clave-admin`** — la llave compartida del admin. Vive como
variable de entorno de la Lambda, y desplegar la recupera sola: si la función
ya existe, su llave gana y el archivo se reescribe con ella.

```bash
bash infra/lambda-admin.sh
```

Si prefieres sólo leerla, sin desplegar nada:

```bash
aws lambda get-function-configuration --function-name kustto-admin --profile kustto-admin --region us-east-1 --query "Environment.Variables.KUSTTO_CLAVE_ADMIN" --output text > services/admin/.clave-admin
```

**`infra/.cognito`** — los identificadores del pool. El script es idempotente:
si el pool ya existe no crea nada, sólo lo busca y reescribe el archivo.

```bash
bash infra/cognito.sh
```

**`apps/web/.env.local`** — la configuración del front. Se arma con lo
anterior:

```
# La API de admin en AWS. La llave NO lleva prefijo NEXT_PUBLIC a propósito:
# así se queda del lado del servidor y nunca entra al bundle del navegador.
KUSTTO_ADMIN_API=https://kd8ydpp2c6.execute-api.us-east-1.amazonaws.com
KUSTTO_CLAVE_ADMIN=<el contenido de services/admin/.clave-admin>

# Cognito y la API de proveedores. Estos SÍ llevan NEXT_PUBLIC: el navegador
# habla directo con Cognito, y ni el id del pool ni el del cliente son
# secretos (el cliente se creó sin secret a propósito).
NEXT_PUBLIC_KUSTTO_API=https://kd8ydpp2c6.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_CLIENTE=<KUSTTO_POOL_CLIENTE de infra/.cognito>
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
  admin/               Plantillas, categorías, alta de proveedores, mockups.
  proveedores/         El panel del taller, detrás del autorizador JWT.
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
- `admin.ts` (`adminFetch`) → la Lambda de admin, **pasando por
  `/api/admin/*`**, un route handler de Next que agrega la llave del lado
  del servidor. Nunca le pegues directo a API Gateway desde el navegador con
  la llave: cualquier `NEXT_PUBLIC_*` queda incrustada en el bundle.
- `proveedores.ts` → la Lambda de proveedores, directo a API Gateway. Aquí
  sí va directo porque el permiso lo lleva el token del propio proveedor, no
  un secreto nuestro.

**`apps/web/app/api/admin/[...ruta]/route.ts`** — ese puente es **una puerta
abierta mientras no haya login de admin**. Reenvía cualquier petición con la
llave puesta. Sirve para trabajar en local; no debe desplegarse público sin
una sesión de por medio.

**`apps/web/lib/api/admin.servidor.ts`** — importa `server-only`. Si alguien
lo importa desde un componente cliente, **falla la compilación** en vez de
filtrar la llave al bundle. Eso es intencional.

**Los mockups tienen que servirse desde el mismo origen que el sitio.** El
teñido de prenda (`lib/fabric/prenda.ts`) hace `getImageData()` sobre ellos;
desde otro origen el canvas queda contaminado, el navegador lanza
`SecurityError` y el teñido **se apaga sin decir nada**. Por eso:

- se guardan en S3 con el bucket cerrado,
- se leen siempre por la ruta `/mockups/...`,
- en desarrollo un rewrite de `next.config.ts` los pide a la Lambda,
- en producción los servirá CloudFront con OAC. Misma ruta en los dos lados.

Cloudinary queda descartado para mockups por esta misma razón.

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
- `pnpm type-check` en la raíz. Ojo: `apps/web` **ya trae errores de tipos
  previos** en el admin de productos y en algunos formularios; no son tuyos.
  Filtra por los archivos que tocaste.

---

## Lo que sigue

En orden, de lo más útil a lo más lejano:

1. **Login de admin.** Hoy el admin es una llave compartida y un proxy que la
   pone. Es lo único que impide desplegar el front público.
2. **Migrar catálogo** (productos, categorías públicas, paquetes) a DynamoDB
   y al catálogo materializado en S3.
3. **CloudFront + OAC** para servir `/mockups/*` sin pasar por Lambda, y el
   front estático detrás.
4. **Pedidos.**
5. **Pasarela de pago** — aplazada a propósito hasta el final.

Pendientes chicos anotados:

- La landing de proveedores vive en `/proveedores`, pero `/proveedor` es el
  panel autenticado. Los dos nombres a un carácter de distancia van a doler;
  conviene renombrar antes de que haya enlaces afuera.
- Hay datos con acentos estropeados en DynamoDB (`Detr?s` en los
  `sideLabels` de la plantilla tshirt) de cuando se escribieron con `curl`
  desde Git Bash. Se limpian cuando se toque esa plantilla.
- Proveedores de prueba vivos en Cognito: `taller@bordadostapatios.mx` y
  `prueba.login@kustto.mx`. Bórralos antes de que esto sea real.
