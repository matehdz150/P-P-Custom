# La infraestructura

Estos scripts **son** la definición del AWS de Kustto. No hay Terraform ni
CDK a propósito: son siete archivos de bash, cada uno idempotente, y se leen
de arriba abajo. Cuando algo no cuadre entre este documento y un script, el
script gana.

Todo asume el perfil **`kustto-admin`** en **`us-east-1`**, cuenta
**`218897024535`**. `aws.sh` no es ejecutable por sí solo: los demás lo
cargan con `source` para tener la función `aws_`, que aplica perfil y región
y encuentra el binario aunque no esté en el PATH de Git Bash.

---

## Orden de ejecución

Desde cero, en una cuenta vacía:

```bash
bash infra/tabla.sh              # DynamoDB
bash infra/buckets.sh            # S3
bash infra/cors.sh               # CORS del bucket público
bash infra/cognito.sh            # el pool de proveedores
bash infra/lambda-admin.sh       # la Lambda de admin + la API Gateway
bash infra/lambda-proveedores.sh # la Lambda de proveedores + el autorizador
```

`lambda-proveedores.sh` **depende** de que la API ya exista, porque cuelga de
ella; si no la encuentra, se detiene y te lo dice. `lambda-admin.sh` lee
`infra/.cognito` si existe, para pasarle el id del pool a la función.

En el día a día sólo se corren los dos últimos, que además de crear
**actualizan el código**. Correrlos en cada cambio es lo esperado.

---

## Lo que existe hoy

| Recurso | Nombre / id |
|---|---|
| Tabla DynamoDB | `kustto-prod` |
| Bucket público | `kustto-publico-prod` |
| Bucket privado | `kustto-privado-prod` |
| Lambda admin | `kustto-admin` (rol `kustto-admin-rol`) |
| Lambda proveedores | `kustto-proveedores` (rol `kustto-proveedores-rol`) |
| API Gateway (HTTP) | `kustto-admin-api` → `https://kd8ydpp2c6.execute-api.us-east-1.amazonaws.com` |
| Autorizador JWT | `cognito-proveedores` |
| Cognito User Pool | `kustto-proveedores` → `us-east-1_qxIsXIrrV` |
| Cliente del pool | `kustto-proveedores-web` → `6avvk9sa6sv4dpclbprdk4uned` |

**Una sola API Gateway para las dos Lambdas.** No hacía falta una segunda:
una API enruta por camino hacia funciones distintas. Dos serían dos
dominios, dos configuraciones de CORS y después dos comportamientos de
CloudFront.

El reparto:

```
GET|POST|PATCH|DELETE /proveedores/{proxy+}  ->  kustto-proveedores, con token de Cognito
$default                                      ->  kustto-admin, con la llave compartida
```

Las rutas explícitas ganan sobre `$default`, así que no hay que tocar la de
admin para que esto funcione.

---

## La tabla

Tabla única, `PAY_PER_REQUEST`, llaves `pk`/`sk`, tres índices (`gsi1`,
`gsi2`, `gsi3`) con proyección `ALL`, y streams en `NEW_AND_OLD_IMAGES` para
cuando toque materializar el catálogo.

```
CATEGORY              CAT#<id>        una categoría de producto
TEMPLATE              TPL#<id>        una plantilla de prenda
PRODUCT#<id>          META            el producto completo, en un solo ítem
PROVIDER#<id>         META            el perfil del taller
PROVIDER_EMAIL#<mail> LOCK            candado de unicidad de correo
ORDER#<id>            META            el pedido con sus líneas y su bitácora
ORDER_FOLIO#<folio>   LOCK            candado del folio corto (#2418)
SLUG#<slug>           LOCK            candado de unicidad de slug
```

**El reparto del espacio de llaves vive en un solo archivo**
(`services/*/src/lib/dynamo.ts`, el objeto `llaves`) a propósito: es la
decisión más cara de deshacer en DynamoDB, y desperdigada por los handlers
se vuelve imposible de cambiar.

Dos cosas que no son obvias:

- **Las colecciones chicas comparten partición.** Categorías y plantillas
  viven todas bajo `pk = "CATEGORY"` / `pk = "TEMPLATE"` para que listarlas
  sea un `Query` y no un `Scan`. Son decenas de ítems que casi nunca se
  escriben, así que la partición caliente no es un riesgo aquí.
- **Los candados existen porque en Dynamo no hay `UNIQUE`.** La unicidad se
  hace con un ítem extra escrito en la misma `TransactWriteItems` con
  `attribute_not_exists(pk)`. Si el candado ya está, la transacción entera
  falla y no queda nada a medias.

Los productos se listan por dos caminos, y ninguno recorre la tabla:

- `gsi1` con `PROVIDER_PRODUCTS#<sub>` — "mis productos" en el panel del
  taller, del más nuevo al más viejo porque la fecha va en la llave de orden.
- `gsi2` con `PRODUCT_ESTADO#<estado>` — la bandeja de revisión del admin. El
  ítem se reindexa en cada cambio de estado; si un `UpdateExpression` se
  olvida de reescribir `gsi2sk`, el producto se queda en la bandeja vieja.

Los pedidos usan los tres índices, y por eso son los que agotan el juego:
`gsi1` los del taller, `gsi2` la cola por estado, `gsi3` los de un correo —lo
que permite pedir sin cuenta y aun así ver los propios—. Si hiciera falta un
cuarto reparto, hay que replantear, no añadir un índice más.

Lo que sigue sin índice es el **catálogo público** filtrado por técnica,
color o días de producción: eso lo resolverá el catálogo materializado en S3,
y es la decisión que sigue abierta.

---

## Los buckets

Los dos con **acceso público bloqueado**, versionado y cifrado AES256.
"Público" en `kustto-publico-prod` significa *el contenido está destinado al
público*, no *el bucket está abierto*. Verificado: un `GET` directo a S3
responde **403**.

Cómo entra y sale un mockup:

1. El navegador pide permiso a la Lambda (`POST /uploads/mockup-url`).
2. La Lambda firma una URL de escritura de corta vida.
3. El navegador hace `PUT` **directo a S3**. Así no hay límite de tamaño de
   API Gateway ni se paga tiempo de Lambda moviendo bytes.
4. Para leerlo, la app usa la ruta `/mockups/...`, **nunca la URL de S3**.

`cors.sh` abre `PUT`/`GET`/`HEAD` desde `http://localhost:3000` en el bucket
público, y sólo eso: sin ese CORS el `PUT` del paso 3 no sale del navegador.
Cuando haya dominio real hay que agregarlo ahí.

Las imágenes del catálogo que **no** son mockups (la foto de una categoría,
por ejemplo) usan el mismo camino por `POST /uploads/imagen-url`, pero caen
en `medios/<carpeta>/` y se leen por `/medios/...`. Están separadas de
`mockups/` a propósito: no son el mismo caso de caché el día que entre
CloudFront, y así una subida de catálogo no puede sobrescribir el mockup de
una plantilla en uso. La carpeta llega del navegador, así que la Lambda la
valida contra una lista blanca (`categorias`, `paquetes`, `productos`).

---

## Cognito

Pool `kustto-proveedores`. Tres decisiones quedan grabadas en `cognito.sh`:

- **Sin autoregistro** (`AllowAdminCreateUserOnly=true`). Los talleres no se
  dan de alta solos: los crea el admin. Sin esto, cualquiera con la URL se
  registra como proveedor.
- **Cliente sin secreto.** Lo usa el navegador, y un secreto en el navegador
  no es un secreto. La seguridad la da el pool, no un string escondido.
- **`USER_PASSWORD_AUTH`, todavía no SRP.** Es lo que sabe hacer el front
  hoy. SRP es más robusto y es el siguiente paso natural.

Tokens de 1 hora, refresh de 30 días. Contraseñas de 10+ con minúscula y
número.

### El `sub` ES el id del proveedor

El alta (`services/admin/src/rutas/proveedores.ts`) crea primero el usuario
en Cognito, toma el `sub` que devuelve y lo usa **como id en DynamoDB**. Eso
elimina una tabla de equivalencias y, sobre todo, elimina el bug clásico: el
token dice una cosa y la base dice otra. Cuando el proveedor llega con su
JWT, el `sub` apunta directo a su ítem.

La contraseña **no se guarda de nuestro lado**. La administra Cognito, que
además obliga a cambiarla en el primer ingreso: `AdminCreateUser` con
`MessageAction: "SUPPRESS"` genera una temporal que la API devuelve **una
sola vez**, para que el admin se la pase al taller a mano. No queda guardada
en ningún lado.

---

## La autorización, en dos sabores

**Admin: llave compartida.** El header `x-clave-admin` se compara en tiempo
constante (`exigirLlave` en `services/admin/src/handler.ts`) — una
comparación normal con `===` filtra por cuánto tarda en fallar. La llave la
genera `lambda-admin.sh` sola la primera vez, la guarda en
`services/admin/.clave-admin` (en `.gitignore`) y la pone como variable de
entorno de la Lambda. Nunca se imprime en pantalla.

Es temporal y sabemos por qué es insuficiente: no distingue personas, no se
revoca por usuario y vive en un proxy que la pone a cualquiera que alcance el
servidor de Next.

**Proveedores: autorizador JWT de API Gateway.** El token lo valida la
plataforma —firma, caducidad, audiencia— **antes** de invocar la función.
Una petición sin token válido nunca llega a ejecutar código nuestro, ni se
paga. El handler sólo lee `sub` de las claims; no verifica nada.

### La trampa del `ANY` (ya resuelta, no la reintroduzcas)

La ruta empezó siendo `ANY /proveedores/{proxy+}`. **`ANY` incluye
`OPTIONS`**, así que el preflight del navegador caía en la ruta con
autorizador — y un preflight no lleva `Authorization`, por diseño. Resultado:
401 sin cabeceras CORS y un `Failed to fetch` en el navegador que no dice
absolutamente nada.

Por eso hay **una ruta por método** y ninguna `ANY`: dejando `OPTIONS` sin
ruta, API Gateway lo contesta solo con la configuración de CORS de la API.

`lambda-proveedores.sh` borra la ruta `ANY` si la encuentra, para que
volverla a crear a mano no pase desapercibido.

---

## Permisos

Cada rol ve lo mínimo:

- **`kustto-admin-rol`**: `GetItem`/`PutItem`/`UpdateItem`/`DeleteItem`/
  `Query`/`TransactWriteItems` sobre `kustto-prod` y sus índices;
  `PutObject`/`GetObject` sobre `kustto-publico-prod/*`; `AdminCreateUser` y
  `AdminSetUserPassword` en Cognito.
- **`kustto-proveedores-rol`**: `GetItem`/`PutItem`/`UpdateItem`/`Query`/
  `TransactWriteItems` sobre la misma tabla, y `PutObject` **sólo** bajo
  `kustto-publico-prod/medios/productos/*`. Sin borrar, sin Cognito.

  Creció cuando el taller pasó a dar de alta productos: `PutItem` y la
  transacción son para escribir el producto junto a su candado de slug.

  **Lo que IAM no puede hacer aquí:** la política es de la función, no del
  taller, así que autoriza escribir en la carpeta de cualquiera. Lo único
  que separa a un taller de otro es que la Lambda arma la ruta con el `sub`
  del token (`services/proveedores/src/rutas/subidas.ts`). Si esa carpeta
  llegara a salir del cuerpo de la petición, la separación desaparece sin
  que ningún permiso proteste.

Las políticas de los dos roles se escriben en **cada** ejecución del script,
no sólo al crear el rol. Estaban dentro del `if` de creación, y así ampliar
una no surtía efecto justo donde el rol ya existía: se descubría con un
`AccessDenied` en producción.

Al crear un rol los scripts esperan 12 segundos antes de seguir. No es
supersticioso: IAM es eventualmente consistente y crear la Lambda de
inmediato falla con un error que parece de permisos y no lo es.

---

## Detalles de Windows que ya mordieron

- **Git Bash no trae `zip`.** Los scripts caen a `Compress-Archive` de
  PowerShell.
- **`curl -d` con acentos desde Git Bash estropea el UTF-8.** Si mandas
  `Metales Querétaro` en línea de comandos puedes acabar con un slug
  `metales-quer-taro` y creer que el bug está en la regex. No lo está: manda
  el JSON como archivo (`--data-binary @archivo.json`).
- Por lo mismo, el rango de diacríticos combinantes se construye desde una
  cadena ASCII (`new RegExp("[\\u0300-\\u036f]", "g")`) en vez de escribirlo
  como caracteres literales: escrito literal depende de la codificación con
  que se guarde el archivo, y si se estropea el slug sale mal sin que nadie
  se entere.

---

## Archivos que no van al repo

| Archivo | Cómo se recupera |
|---|---|
| `services/admin/.clave-admin` | `bash infra/lambda-admin.sh` lo rehace con la llave que ya tiene la función |
| `infra/.cognito` | `bash infra/cognito.sh` — idempotente, no crea nada nuevo |
| `services/*/dist/`, `*.zip` | se regeneran al desplegar |

Los ids de `.cognito` **no son secretos** (viajan al navegador por diseño);
está fuera del repo sólo porque es un archivo generado.

---

## Cómo comprobar que todo respira

```bash
# El admin exige llave
curl -s -o /dev/null -w "%{http_code}\n" https://kd8ydpp2c6.execute-api.us-east-1.amazonaws.com/templates
# -> 401

# Con llave, lista plantillas
curl -s -H "x-clave-admin: $(cat services/admin/.clave-admin)" https://kd8ydpp2c6.execute-api.us-east-1.amazonaws.com/templates

# Proveedores rechaza sin token, y también rechaza la llave de admin
curl -s -o /dev/null -w "%{http_code}\n" https://kd8ydpp2c6.execute-api.us-east-1.amazonaws.com/proveedores/yo
# -> 401

# El preflight SÍ pasa (si esto da 401, alguien volvió a poner una ruta ANY)
curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  https://kd8ydpp2c6.execute-api.us-east-1.amazonaws.com/proveedores/yo
# -> 204

# El bucket está cerrado
curl -s -o /dev/null -w "%{http_code}\n" https://kustto-publico-prod.s3.amazonaws.com/mockups/
# -> 403
```

Para conseguir un token y probar el panel a mano:

```bash
source infra/aws.sh && source infra/.cognito
aws_ cognito-idp initiate-auth \
  --client-id "$KUSTTO_POOL_CLIENTE" \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters "USERNAME=<correo>,PASSWORD=<contraseña>" \
  --query "AuthenticationResult.IdToken" --output text
```
