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
bash infra/tabla.sh                 # DynamoDB
bash infra/buckets.sh               # S3
bash infra/cors.sh                  # CORS del bucket público
bash infra/cognito.sh               # el pool de proveedores
bash infra/cognito-compradores.sh   # el pool de compradores + Google
bash infra/lambda-admin.sh          # la Lambda de admin + la API Gateway
bash infra/lambda-proveedores.sh    # la Lambda de proveedores + el autorizador
bash infra/lambda-compradores.sh    # la Lambda de la cuenta + su autorizador
bash infra/websocket.sh             # el canal en vivo del panel del taller
bash infra/correo.sh                # SES: dominio, DKIM, SPF, DMARC y buzón
bash infra/lambda-correo.sh         # el reenviador del buzón
bash infra/correo-envio.sh          # el rol de la cuenta root para ENVIAR
bash infra/frontend.sh              # el bucket del sitio, CloudFront y el DNS
bash infra/sitio.sh                 # construye el front y lo publica
```

`lambda-proveedores.sh` **depende** de que la API ya exista, porque cuelga de
ella; si no la encuentra, se detiene y te lo dice. `lambda-admin.sh` lee
`infra/.cognito` si existe, para pasarle el id del pool a la función.

En el día a día se corren **`lambda-admin.sh` y `lambda-proveedores.sh`**, que
además de crear actualizan el código; correrlos en cada cambio es lo esperado.
Y **`sitio.sh`** cada vez que cambia el front o se aprueba un producto: las
URLs se calculan al construir, así que hasta que no se corre, un producto
aprobado no existe en el sitio.

Los tres del correo se corren una vez, y `correo-envio.sh` necesita además
credenciales de la **cuenta root** (perfil `moderateapi`): el envío sale de
allá, no de la cuenta de la app.

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
| Lambda compradores | `kustto-compradores` (rol `kustto-compradores-rol`) |
| Autorizador JWT | `cognito-proveedores` |
| Autorizador JWT | `cognito-compradores` |
| Cognito User Pool | `kustto-proveedores` → `us-east-1_qxIsXIrrV` |
| Cliente del pool | `kustto-proveedores-web` → `6avvk9sa6sv4dpclbprdk4uned` |
| Pool de compradores | `kustto-compradores` → `us-east-1_UPmxJntO3` |
| Cliente del pool | `kustto-compradores-web` → `5qdkohf21epp1e9c6j76vqnc9v` |
| Interfaz alojada | `https://kustto-cuentas.auth.us-east-1.amazoncognito.com` |
| Lambda eventos | `kustto-eventos` (rol `kustto-eventos-rol`) |
| API WebSocket | `kustto-eventos-ws` → `wss://1mdi47dyv4.execute-api.us-east-1.amazonaws.com/prod` |
| Autorizador WS | `cognito-ws` (REQUEST, token en la query string) |
| Bucket del sitio | `kustto-sitio-prod` (cerrado; entra sólo CloudFront) |
| Distribución | `E2UTAKM343NK5Z` → `d1tooh2apdlodr.cloudfront.net` |
| Función de borde | `kustto-urls-bonitas` |
| Control de acceso | `kustto-oac` (OAC, para los dos buckets) |
| Certificado | ACM `kustto.com.mx` + `www`, en us-east-1 |

**Una sola API Gateway para las tres Lambdas.** No hacía falta otra: una API
enruta por camino hacia funciones distintas. Dos serían dos dominios, dos
configuraciones de CORS y después dos comportamientos de CloudFront.

El reparto:

```
GET|POST|PATCH|DELETE /proveedores/{proxy+}  ->  kustto-proveedores, token del pool de TALLERES
GET|POST|PATCH|DELETE /cuenta/{proxy+}       ->  kustto-compradores, token del pool de COMPRADORES
$default                                      ->  kustto-admin, con la llave compartida
```

Las rutas explícitas ganan sobre `$default`, así que no hay que tocar la de
admin para que esto funcione.

**Y son DOS autorizadores, no uno compartido.** El de API Gateway valida
emisor y audiencia, no grupos: con uno solo, un token de taller abriría
`/cuenta/*` y al revés. Cada prefijo apunta al autorizador de su pool, así que
la separación la hace cumplir la plataforma antes de invocar código nuestro —
no depende de que ningún handler se acuerde de comprobarla.

---

## El sitio

**https://kustto.com.mx** es un export estático en S3 detrás de CloudFront. Lo
monta `frontend.sh` y lo publica `sitio.sh`.

**El bucket sigue cerrado.** Nadie lee de S3: entra CloudFront con un Origin
Access Control y la política del bucket sólo confía en ESA distribución. Un
bucket "de sitio web" sería una segunda puerta, sin HTTPS y sin las reglas de
abajo. Comprobado: pedirle un objeto directo a cualquiera de los dos buckets
responde **403**.

Tres comportamientos, y el reparto no es cosmético:

```
/mockups/*  ->  kustto-publico-prod
/medios/*   ->  kustto-publico-prod
(el resto)  ->  kustto-sitio-prod
```

Los mockups salen **por el mismo dominio que la app** porque el editor hace
`getImageData()` sobre ellos para teñir la prenda: desde otro dominio el
navegador contamina el lienzo y el teñido se apaga sin decir nada. En
desarrollo eso lo hacen los rewrites de Next; aquí, estos dos comportamientos.

**Una función de borde resuelve las URLs bonitas.** El export escribe
`/catalogo/index.html` y la gente pide `/catalogo`. El "documento índice" de S3
sólo existe en los buckets configurados como sitio web —que son públicos—, así
que la reescritura la hace `kustto-urls-bonitas` en `viewer-request`. Deja en
paz cualquier URI con extensión, que es como pasan el JS, el CSS y las
imágenes.

**Los 403 se sirven como 404.** Con OAC, un objeto que no existe da 403 —el
bucket no puede listar, así que no sabe distinguir— y sin esa regla una URL
equivocada enseñaría un XML de acceso denegado en vez de la página de 404.

**El CORS de la API incluye el dominio**, y se configura desde
`lambda-admin.sh`: cambiarlo en la consola dura hasta el siguiente despliegue.

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
CUSTOMER#<sub>        META            la cuenta del comprador y su dirección
ORDER_FOLIO#<folio>   LOCK            candado del folio corto (#481902)
SLUG#<slug>           LOCK            candado de unicidad de slug
CONN#<connectionId>   META            una conexión viva del panel del taller
```

La tabla tiene **TTL activado** sobre el atributo `expiraEn`. Hoy sólo lo usan
las conexiones; lo activa `websocket.sh` si no estaba.

**El diseño editable NO va en el ítem.** Un ítem de DynamoDB no pasa de 400 KB
y el diseño lleva las imágenes del cliente incrustadas: con una foto de verdad
el pedido dejaba de caber y la escritura fallaba con `Item size has exceeded
the maximum allowed size`. Vive en S3 (`…-diseno.json`) y en el ítem queda la
ruta. Vale para cualquier cosa que crezca con lo que suba un cliente.

**Una línea del pedido congela lo que hace falta para producir.** No se lee del
producto al mirarla: el taller puede cambiar su ficha mañana y un pedido de
hace un mes se imprimiría al tamaño de hoy. Por eso la línea copia, además del
precio, el `sku`, el color con su hex, y por cada lado el área declarada
(`anchoCm`/`altoCm`/`dpi`) **y la medida real del archivo**
(`anchoPx`/`altoPx`/`anchoRealCm`/`altoRealCm`), que no siempre coinciden.

**Lo del envío también vive dentro de los ítems que ya existen**, sin llaves
nuevas:

- En el **producto**: `pesoPorTalla` (gramos enteros, indexado por talla —el
  color no cambia el peso) y `caja` (largo/ancho/alto de una pieza).
- En el **proveedor**: `recoleccion` (de dónde sale el paquete; su CP decide el
  precio y la dirección se imprime en la guía), `whatsapp` (la paquetería lo
  exige para recoger), y las cuentas pendientes: `saldoEnvios` acumulado más
  `cargosEnvio`, la lista con pedido, monto y fecha.
- En el **pedido**: `envio` con lo que eligió y pagó el comprador —congelado—,
  `envio.real` con lo que se midió y costó de verdad, y `guia` con el id del
  envío, el rastreo y la URL de la etiqueta.

**`saldoEnvios` es dinero que se debe, no un contador.** Positivo = el taller
debe esa diferencia; negativo = sobró a favor de Kustto. No se cobra todavía
porque no existen pagos al taller: se acumula para poder liquidarlo cuando los
haya, y por eso el desglose por pedido importa tanto como el total.

**Las existencias viven DENTRO del producto**, en un mapa `existencias` con la
llave `color|talla` (o sólo la talla si el producto no tiene colores). Un mapa
de 10 colores × 6 tallas son 60 entradas: nada al lado del límite de 400 KB, y
siendo el mismo ítem el descuento es atómico sin transacción. **Lo lleva todo
producto**: hubo un `controlarStock` opcional y se quitó, porque apagado —que
era el valor por defecto— el aviso de "+N días" no se disparaba nunca. Lo
opcional ahora es `diasExtraSinStock`, que arranca en 0; el porqué está en
`ESTADO.md`.

El mapa **tiene que existir** en el ítem: un `SET existencias.#v = ...` sobre
un producto sin ese atributo revienta con `ValidationException`, y eso pasa
dentro de la transacción del pedido —o sea, checkout caído, no contador mal—.
El alta lo escribe siempre, y el descuento se salta con un grito al log el
producto que no lo tenga.

**Pueden quedar negativas y es información, no un fallo.** Se decidió que se
puede comprar sin blancos —al cliente se le avisan más días y el taller los
compra—, así que el descuento no lleva `ConditionExpression`. Un `-2` significa
"compra 2 para sacar lo que ya vendiste". Ponerle condición devolvería una
trampa: `escribirConFolio` reintenta seis veces cualquier
`TransactionCanceledException`, y se quedaría reintentando algo que nunca va a
funcionar para acabar culpando al folio.

**El folio es de SEIS dígitos, y el número importa.** Empezó con cuatro —9 000
valores, que no se liberan nunca— y eso era un techo para la vida del negocio:
a los 6 000 pedidos fallaba uno de cada once, y a los 9 000 no entraba ninguno.
Con 900 000 el problema desaparece. Los folios viejos de cuatro conviven sin
problema, que son cadenas.

**Ninguna consulta puede ir sin paginar.** DynamoDB corta toda respuesta de
`Query` en 1 MB y devuelve `LastEvaluatedKey`; quien no lo lee recibe filas de
menos **sin error de por medio**. Por eso todas pasan por `consultarTodo`
(`services/*/src/lib/dynamo.ts`), que sigue las páginas y avisa en el log si
corta por su tope. Se comprobó con 40 ítems de 30 KB: una sola página devolvía
35.

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

**`CUSTOMER#` y `BUYER#` son la misma persona y NO son el mismo prefijo.**
`BUYER#` vive en `gsi3` y va por **correo**; `CUSTOMER#` es llave primaria y va
por el **`sub`** de Cognito. Están separados a propósito: si compartieran
prefijo, alguien acabaría escribiendo uno donde va el otro. Y el correo es el
que ata los pedidos justamente porque se puede pedir sin cuenta — quien se
registra después con ese correo se encuentra su historial ya puesto, sin
migrar nada.

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

### Los compradores van en OTRO pool

`cognito-compradores.sh` crea `kustto-compradores`, y que sea un pool aparte
es la decisión importante, no un detalle de orden.

**El autorizador JWT de `/proveedores/*` valida emisor y audiencia, no
grupos.** Si los compradores sacaran su token del pool de talleres, ese token
pasaría el autorizador y lo único que separaría a un comprador de un taller
serían comprobaciones dentro del handler — la misma clase de separación
frágil que ya está señalada abajo, en Permisos. Con dos pools el emisor no
coincide y no hay nada que recordar comprobar.

Las tres diferencias con el pool de talleres, todas a propósito:

- **Con autoregistro** (`AllowAdminCreateUserOnly=false`). Al taller lo damos
  de alta nosotros; el comprador se registra solo.
- **Sin `USER_PASSWORD_AUTH`.** La contraseña del comprador nunca se teclea en
  una página nuestra: Google y el correo van los dos por la interfaz alojada
  de Cognito, que es una redirección con PKCE. Así no existe un formulario
  nuestro que pueda filtrar una contraseña.
- **Con dominio de interfaz alojada**, que el de talleres no necesita. La URI
  de redirección que Google exige cuelga de él:
  `…/oauth2/idpresponse`.

El script corre en dos fases. Sin `infra/.google` crea el pool, el dominio y
el cliente, e imprime la URI que hay que pegar en la consola de Google; con el
archivo, además engancha Google y lo añade al cliente. El secreto **no se
imprime nunca** y no se recupera de AWS: lo guarda Google y sólo se enseña al
crear el cliente. Si se pierde, se rota allá y se vuelve a correr el script.

Un mapeo que parece cosmético y no lo es: **`email_verified` se mapea desde
Google**. Sin él el usuario federado entra como no verificado, y el correo
verificado es lo que ata un pedido a su dueño (`gsi3` es `BUYER#<correo>`).
Confiar en un correo sin comprobar deja que alguien se registre con el de otro
y le lea los pedidos.

**Cognito va a duplicar al usuario que entre por los dos caminos.** El mismo
correo por Google y por contraseña son dos usuarios con `sub` distinto; se unen
a mano con `AdminLinkProviderForUser`. Mientras eso no exista, el historial se
lee por el correo verificado y no se parte.

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

## El canal en vivo

Un pedido nuevo aparece en el panel del taller sin recargar. Lo empuja una
API **WebSocket** aparte, `kustto-eventos-ws`.

**Por qué es una segunda API.** Las de API Gateway son de un protocolo o del
otro: una HTTP no admite rutas WebSocket. Al contrario que la de proveedores
—que cuelga de la de admin— aquí no había elección.

```
$connect     -> kustto-eventos, con autorizador (apunta la conexión)
$disconnect  -> kustto-eventos                  (borra el apunte)
$default     -> kustto-eventos                  (hoy no hace nada)
```

**El token viaja en la query string, y no es un descuido.** `new WebSocket(url)`
no deja poner cabeceras, así que no hay `Authorization` posible. Por eso el
autorizador es de tipo `REQUEST` sobre `route.request.querystring.token`, y
por eso la Lambda valida el JWT contra el pool **a mano**: las APIs WebSocket
no tienen autorizador JWT de fábrica como las HTTP. Se comprueban firma,
emisor, audiencia, caducidad y `token_use`; saltarse cualquiera convierte la
comprobación en teatro. El costo conocido: la URL con el token puede acabar
en los registros de acceso. Se compensa con que son tokens de una hora y con
que por ahí no sale un solo dato.

**El autorizador sólo puede ir en `$connect`.** Es la única ruta donde API
Gateway lo admite; una vez aceptada la conexión el permiso ya está dado. Del
autorizador sale el `proveedorId` por el `context`, y **es la única fuente**:
si viniera del cliente, cualquiera escucharía los pedidos de otro.

**Qué se manda: un aviso, no el pedido.** El navegador recibe
`{"tipo":"pedido-nuevo",…}` y recarga su lista por la API de siempre. Mandar
los datos por aquí duplicaría en un segundo camino las reglas de qué ve cada
taller, y dos caminos con las mismas reglas es como acaban divergiendo.

**Las conexiones viven en la tabla**, un ítem por conexión:

```
CONN#<connectionId>   META    la conexión, con su taller en gsi1
```

Se guarda así por las dos direcciones que hacen falta: al desconectar sólo
llega el `connectionId` y la llave primaria basta para borrarlo; al publicar
hay que ir del taller a sus conexiones, y eso es el Query de `gsi1`. Lleva
`expiraEn` con **TTL activado** en la tabla: si una Lambda muere sin procesar
el `$disconnect`, el ítem se va solo en vez de quedarse haciendo que se le
escriba a un fantasma. Un 410 al publicar también lo borra en el momento.

**Las APIs WebSocket no tienen `--auto-deploy`**: `websocket.sh` corre
`create-deployment` en cada ejecución. Si cambias rutas y no ves el efecto,
es que faltó desplegar.

**El endpoint se le mete a `kustto-admin` como `KUSTTO_WS_ENDPOINT`**, y
`lambda-admin.sh` lo conserva leyéndolo de la función igual que hace con la
llave y el pool: `update-function-configuration` sustituye el entorno entero,
así que sin conservarlo cada despliegue del admin apagaría los avisos sin
decir nada.

---

## El rastreo de Skydropx

`POST /publico/envios/rastreo` en `kustto-admin`. Es la **única ruta que mueve
un pedido sin que nadie de la casa haya entrado**, así que todo lo de aquí es
por eso.

**Se configura en el panel de Skydropx**, no por API: sección **Envíos**,
método **HMAC**, header `Authorization`. El secreto lo elegimos nosotros —no lo
da Skydropx— y vive en `infra/.skydropx-webhook` y en la variable
`SKYDROPX_WEBHOOK_SECRETO` de la Lambda. `lambda-admin.sh` lo conserva leyéndolo
de la función, como la llave del admin.

**Sin secreto configurado se rechaza todo.** Una ruta pública que mueve pedidos
a "entregado" y acepta cualquier cosa mientras falte una variable de entorno es
una puerta abierta que nadie nota hasta que alguien la usa.

### La forma real del aviso, comprobada

La documentación pública **se corta antes de la sección de webhooks**. Esto sale
de un aviso de verdad:

```
data.type                           = "packages"
data.attributes.status              = "in_transit"   ← NO tracking_status
data.attributes.returned            = false          ← la devolución es bandera aparte
data.relationships.shipment.data.id                  ← NO attributes.shipment_id
```

Los dos campos que parecían obvios se llaman de otra forma, y el primer aviso
real entró y **se ignoró en silencio**. También llegan `tracking_number` y
`tracking_url_provider`, que se guardan si el pedido no los tenía —nunca se
pisan: lo de la compra manda—.

Los nombres se normalizan a minúsculas: el panel los lista como `In_transit` y
`Picked_up`.

### Del envío al pedido

```
ENVIO#<envioId>       LOCK     apunta al pedido
```

Se escribe al comprar la guía. Sin él habría que recorrer la tabla en cada
aviso. **Los pedidos anteriores a esto no tienen apunte y no reciben rastreo.**

### Reglas que no hay que deshacer

- **Nunca retrocede.** Los avisos llegan desordenados; un `delivered` puede
  adelantar a un `in_transit`. Si el pedido ya está más adelante, no entra.
- **`delivered_to_branch` NO es entregado.** Para la paquetería su trabajo
  terminó; para quien compró, el paquete sigue sin estar en su mano.
- **Los repetidos no ensucian la bitácora.** Un webhook reintenta por diseño, y
  esa bitácora la ve el comprador.
- **`exception`, `in_return`, `retained`, `canceled`, `destroyed` y
  `returned: true`** no mueven el pedido pero sí se anotan: un paquete devuelto
  que nadie mira durante semanas es peor que un estado de más.

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

- **`kustto-compradores-rol`**: el más estrecho de los tres.
  `GetItem`/`PutItem`/`Query` sobre la tabla y sus índices, y nada más. Sin
  borrar, sin S3, sin Cognito, sin transacciones — un comprador no crea nada
  que otro tenga que ver.

  **Lo que IAM tampoco puede hacer aquí:** la política deja leer cualquier
  ítem de la tabla. Lo único que impide que un comprador lea los pedidos de
  otro es que el handler arma la consulta con el correo del token *y* exige
  que venga con `email_verified`. Sin esa comprobación, registrarse con el
  correo ajeno bastaría para leerle los pedidos con su dirección dentro.

Las políticas de los roles se escriben en **cada** ejecución del script,
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
| `infra/.websocket` | `bash infra/websocket.sh` — idempotente; los ids no son secretos |
| `infra/.cognito-compradores` | `bash infra/cognito-compradores.sh` — idempotente; tampoco son secretos |
| `infra/.frontend` | `bash infra/frontend.sh` — el id de la distribución, que tampoco es secreto |
| `infra/.google` | **NO se recupera**: son credenciales de terceros, de console.cloud.google.com |
| `infra/.google` | **De AWS no se recupera.** Lo guarda Google y sólo lo enseña al crear el cliente de OAuth: si se pierde, se rota en su consola |
| `infra/.skydropx` | **De AWS tampoco.** Se sacan del panel de Skydropx, en Conexiones → API. Ver abajo |
| `services/*/dist/`, `*.zip` | se regeneran al desplegar |

### Las credenciales de Skydropx

`infra/.skydropx` lleva cuatro líneas y lo leen **dos** scripts:
`lambda-admin.sh` (cotizar) y `lambda-proveedores.sh` (comprar guías).

```
SKYDROPX_ENTORNO=sandbox
SKYDROPX_HOST=https://sb-pro.skydropx.com
SKYDROPX_CLIENT_ID=…
SKYDROPX_CLIENT_SECRET=…
```

**El host del sandbox es `sb-pro.skydropx.com`.** La documentación oficial dice
que las llamadas van a `api-pro.skydropx.com` en los dos entornos: es falso, y
con ése responde `invalid_client`, que parece un problema de credenciales.

Las de sandbox y las de producción son **cuentas distintas** con su propio
panel y su propio saldo. El sandbox arranca con $1,000 MXN de mentira y las
guías que se compran ahí se descuentan de ese saldo (`payment_status: "paid"`).

Sin este archivo las funciones arrancan igual: no se puede cotizar ni comprar
guías, y el checkout se queda con "recoger con el taller".

Los ids de `.cognito` **no son secretos** (viajan al navegador por diseño);
está fuera del repo sólo porque es un archivo generado.

---

## Cómo comprobar que todo respira

> **Comprueba siempre contra la API, no contra `localhost:3000`.** Las
> respuestas de `/mockups/*` y `/medios/*` llevan `cache-control: immutable`, y
> el servidor de desarrollo las cachea: un archivo que ya no existe puede
> seguir devolviendo 200 por ahí durante horas. Ya tapó un 404 real.

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

# El canal en vivo rechaza sin token (y con uno inventado)
#   Con un token bueno la conexión abre; ver abajo cómo sacarlo.
node -e "const w=new WebSocket('wss://1mdi47dyv4.execute-api.us-east-1.amazonaws.com/prod');w.onopen=()=>console.log('ABIERTA');w.onerror=()=>console.log('rechazada');setTimeout(()=>process.exit(0),5000)"
# -> rechazada

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
