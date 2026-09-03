# Dónde nos quedamos

_Última actualización: 2 de septiembre de 2026._

Este archivo es el traspaso entre sesiones: lo que **no** se deduce leyendo el
código. Para el mapa del proyecto ve a `README.md`; para el AWS, a
`infra/README.md`. Si algo de aquí ya se hizo, bórralo — este documento sólo
sirve si se mantiene corto y cierto.

**Lo último que se hizo, por si sólo lees esto:** el sitio ya está publicado
en **https://kustto.com.mx** (S3 + CloudFront, export estático), con el admin
deliberadamente fuera. Antes: los envíos con Skydropx, el inventario
obligatorio, el buzón de `@kustto.com.mx` y los correos de pedido. Todo
verificado contra AWS, nada en local.

---

## El circuito ya cierra

Se puede diseñar, pedir, cobrar el pedido en el panel del taller y moverlo
hasta entregado. Todo verificado contra AWS real, no en local.

**La salida del editor es una pantalla, no un modal.** `/pedir` es un checkout
de cuatro pasos plegables (tallas → contacto → entrega → pago) con el resumen
pegajoso al lado. Recoge dirección completa con los 32 estados, o "recoger con
el taller", que no pide dirección porque nadie la usaría.

**El taller se entera de un pedido sin recargar.** Por WebSocket, no por
sondeo. Ver `infra/README.md`.

**El panel del taller lee pedidos reales** (`/proveedores/pedidos`) y cada uno
abre una ficha con los archivos de producción, contacto, dirección con botón de
copiar, y la bitácora. Tiene buscador por folio, cliente o producto, que
ignora acentos.

---

## Y ahora el comprador tiene cuenta

**Google y correo, los dos por pantalla NUESTRA** (`/cuenta/entrar`). La
interfaz alojada de Cognito se descartó por fea: `identity_provider=Google`
manda directo a Google y esa pantalla no la ve nadie. El correo va por la API
JSON de Cognito, como el login del taller.

**Es OTRO pool** (`kustto-compradores`) y no un grupo dentro del de talleres.
El autorizador de API Gateway valida emisor y audiencia, no grupos: con un
solo pool, un token de taller abriría `/cuenta/*`. Ver `infra/README.md`.

**El panel del comprador es `/cuenta`**, una sola ruta con cuatro pestañas en
`?s=`. No son cuatro rutas con layout compartido a propósito: `/cuenta/entrar`
y `/cuenta/callback` cuelgan del mismo prefijo, y un `layout.tsx` ahí les
pediría sesión justo a las dos pantallas que sirven para no tenerla.

**Los pedidos se encuentran por CORREO, no por cuenta.** Quien pidió como
invitado y luego se registra con ese mismo correo se encuentra su historial ya
puesto, sin migrar nada — `gsi3` ya estaba construido así. El precio: el
handler exige `email_verified`, porque sin eso registrarse con el correo ajeno
bastaría para leerle los pedidos con su dirección dentro.

Por lo mismo, **en el checkout el correo no se edita cuando hay sesión**. Un
pedido hecho con otro correo es válido pero no vuelve a aparecer en "Mis
pedidos" y no hay forma de devolvérselo.

`/pedido?id=…` carga **por sesión o por token**: con sesión no hace falta el
token del enlace, y por eso "Ver detalle" funciona desde el panel.

**Google ya está enganchado** (3 de septiembre). Las credenciales viven en
`infra/.google`, fuera del repo, y las aplica `infra/cognito-compradores.sh`.
Comprobado siguiendo la redirección completa: Cognito manda a Google con el
`client_id` correcto y Google contesta con su pantalla de inicio de sesión, sin
`redirect_uri_mismatch` ni `invalid_client` — o sea que el URI de redirección
de Cognito está autorizado del lado de Google. **No hizo falta republicar el
sitio**: el bundle ya llevaba el dominio de Cognito, y lo que cambió fue sólo
la configuración del pool.

---

## Existencias del taller: cuenta obligatoria, días extra opcionales

**Se puede vender sin blancos.** Fue una decisión explícita: en vez de bloquear,
se avisa de más días y el taller compra la prenda. De ahí sale todo lo demás:

- El descuento **no lleva condición**, así que el stock puede quedar negativo.
  Un `-2` no es un error: es "compra 2 para sacar lo que ya vendiste".
- Va **dentro de la misma transacción** que el pedido. Aparte habría dos formas
  de quedar a medias.
- La línea del pedido **congela** `diasPrometidos` y `faltantes`, como ya
  congela el precio y las medidas.
- Al cancelar se devuelve; al entregar no, que esas prendas se fueron.

### Se quitó el interruptor `controlarStock` (2 de septiembre)

Era opcional por producto y **apagado por defecto**, con la idea de que el
taller que compra el blanco por trabajo "no tiene nada que contar". Dos
problemas:

- Con el interruptor apagado el aviso de "+N días" **no se disparaba nunca**.
  Un taller con la bodega vacía cotizaba el mismo plazo que uno lleno, y ese
  aviso es la mitad del trato que se decidió.
- Ese taller **sí cuenta**: siempre es cero, y entonces `faltantes` le sale
  como lista de compras. Lo que no tiene son días extra.

Ahora **todo producto lleva cuenta** y lo configurable es `diasExtraSinStock`,
que arranca en 0. Esa separación es el punto: si se hubiera vuelto obligatorio
el conteo dejando los días como estaban, al taller que compra por trabajo se le
cotizaría `diasProduccion + extra` cuando `diasProduccion` **ya incluye ir a
comprar** — sobre-prometiendo el plazo en el caso mayoritario, y en la
dirección que el cliente ve.

`minimoAlerta` **sí sigue siendo opcional** (0 lo apaga): con conteo universal,
un producto que siempre está en cero dispararía la alerta de existencias bajas
en cada carga del panel, y una alerta que salta siempre no avisa de nada.

Verificado contra AWS después del cambio, con un producto que **antes tenía el
control apagado**: pedir 5 habiendo 0 lo dejó en `-5`, anotó
`faltantes: [{M, 5}]` y prometió **5 días, no 12** —los base, sin inflar,
porque su `diasExtraSinStock` es 0—; cancelar lo devolvió a 0.

Los dos productos que ya existían se rellenaron con su mapa en ceros y se les
borró el atributo `controlarStock`. Hacía falta: escribir dentro de un mapa
inexistente revienta con `ValidationException`, y eso habría tumbado el
checkout, no un contador. Por si queda alguno, `descuentosDeStock` se salta el
producto sin mapa y lo grita al log en vez de tirar el pedido.

**Lo que falta de esto:** el aviso al comprador ("+7 días, se produce bajo
pedido") en el editor y el checkout, las alertas de existencias bajas en el
panel, y la capacidad semanal del taller —que NO se guarda: se calcula sumando
las piezas de sus pedidos en `nuevo` y `produccion`, porque un contador
guardado se desincroniza y una suma no puede—.

Ojo con el aviso ahora que la cuenta es universal: sólo tiene sentido enseñarlo
cuando el producto tiene `diasExtraSinStock > 0`. Con 0, faltar blancos no
cambia el plazo y decirle al comprador "se produce bajo pedido" sería ruido.

---

## Envíos con Skydropx

Del flujo de 12 pasos, **los pasos 1 al 9 funcionan** contra el **sandbox**,
verificados de punta a punta. Falta la interfaz del taller para pedir la guía
y el webhook de tracking.

```
1  Cliente arma el pedido        ✅ (un producto; el carrito sigue pendiente)
2  Checkout captura dirección    ✅
3  Kustto cotiza                 ✅  POST /publico/envios/cotizar
4  Total = productos + envío     ✅  el checkout enseña 2 opciones
5  Cliente paga                  ⬜  Stripe, sin empezar
6  Pedido creado                 ✅  ya existía
7  Taller acepta                 ✅  mover a producción ES aceptar
8  Taller confirma peso real     ✅  formulario en la ficha del pedido
9  Comprar la guía               ✅  POST /proveedores/pedidos/:id/guia
10 Descargar la etiqueta         ✅  con sondeo; ver el aviso de abajo
11 Entrega a la paquetería       —   fuera del sistema
12 Tracking                      ✅  webhook con firma HMAC verificada
```

**Las credenciales de sandbox están en `infra/.skydropx`** (fuera del repo).
Las leen `infra/lambda-admin.sh` (cotizar) y `infra/lambda-proveedores.sh`
(comprar guía). Sin ellas todo lo demás sigue andando.

### Datos que hubo que crear para que esto existiera

- **Dirección de recolección del taller** (`recoleccion` en su ítem). Es el CP
  de origen y se imprime en la guía. Se valida como bloque: o completa o nada.
- **`whatsapp` del taller.** La paquetería lo EXIGE para recoger; sin él
  Skydropx responde 422. Se avisa antes de llegar a ese error.
- **`pesoPorTalla` en el producto**, en gramos enteros. **Por TALLA, no por
  variante**: el color no cambia lo que pesa una prenda, y por variante serían
  60 casillas para obtener 6 números.
- **`caja` del producto** (largo/ancho/alto de UNA pieza), para poder cotizar
  antes de que el paquete exista.

### Seis cosas de su API que la documentación no dice, o dice mal

Todas costaron tiempo. Ninguna está en su documentación.

1. **El host del sandbox es `sb-pro.skydropx.com`**, NO `api-pro.skydropx.com`
   como dice la doc para ambos entornos. Con el de la doc responde
   `invalid_client` y parece que las credenciales están mal.
2. **Cotizar es asíncrono.** Crear la cotización devuelve un id y las tarifas
   en `pending`; tardan unos 5 s y llegan de a poco. Por eso son dos rutas y
   espera el navegador, no una Lambda.
3. **`area_level3` (la colonia) es obligatoria.** Sin ella rechaza; no adivina.
4. **La etiqueta viaja en `included[]`, no en el envío.** Ver la trampa de
   abajo: es la que más tiempo costó.
5. **El envío usa `packages`, la cotización usa `parcel`.** Mandando `parcels`
   al crear el envío contesta *"consignment_note es requerido en todos los
   paquetes"* — como si faltara el dato, no como si la clave estuviera mal.
5. **`package_number` tiene que coincidir con el de la cotización.** Para un
   solo bulto es `1`. Con `0` rechaza.
6. **México exige códigos de carta porte** en cada paquete: `consignment_note`
   (clave SAT) y `package_type`. Hoy van fijos en `53102500` (ropa) y `4G`
   (caja de cartón), configurables por `KUSTTO_CLAVE_SAT` y
   `KUSTTO_TIPO_EMPAQUE`. **Son datos fiscales: confírmalos con el contador
   antes de facturar en serio**, y si se venden termos o gorras habrá que
   variar la clave por producto.

### El límite de 2 peticiones por segundo ya mordió

Se midió: siete clics en "+1" dispararon siete cotizaciones en 434 ms y
Skydropx devolvió **429 a todas**, que salían como 500. Ahora hay tres
defensas y conviene no quitar ninguna:

1. **El checkout espera 700 ms** a que la persona deje de tocar antes de
   cotizar. El código postal ya estaba a salvo porque sólo cuenta completo;
   las cantidades no, porque cualquier valor es válido.
2. **La Lambda reintenta** hasta tres veces con espera creciente. El límite se
   mide por cuenta, o sea entre todas las Lambdas a la vez: no se puede
   respetar contando en memoria porque cada invocación vive en su contenedor.
3. **Un 429 sale como 429, no como 500.** No es un fallo del pedido; con un
   500 el navegador se rinde.

### El precio del envío NO viene del navegador

El checkout manda **sólo** `cotizacionId` y `tarifaId`. La Lambda le pregunta
el precio a Skydropx. Comprobado mandando `"precio": 1` en el cuerpo: se
guardó el real, $35.46. Es la misma regla que el precio del producto.

El envío queda **congelado** en el pedido (paquetería, servicio, precio, días)
como ya se congelan el precio y las medidas: la cotización caduca del lado de
Skydropx y el precio de mañana no es el que pagó esa persona.

### La guía se compra con el peso REAL, y por eso se recotiza

`POST /proveedores/pedidos/:id/guia` recibe el peso y las medidas que el
taller acaba de medir y hace tres cosas:

1. **Recotiza.** NO reusa la cotización del checkout: ésa salió de un peso
   estimado. Comprar sobre la vieja imprime una etiqueta con un peso que no
   es, y la paquetería repesa y factura la diferencia semanas después, cuando
   ya nadie se acuerda del pedido.
2. **Busca la MISMA paquetería y servicio** que eligió el comprador —por
   nombre, no por id, que los ids son de cada cotización—. Cambiársela a
   alguien que ya pagó es cambiarle el trato. Si ya no está, cae a la más
   barata que no tarde más de lo prometido.
3. **Compra** y anota la diferencia.

`ConditionExpression: attribute_not_exists(guia)`: sin eso, dos clics seguidos
compran dos guías y se pagan las dos.

**La etiqueta NO está lista al comprar, y esperarla dentro de la función fue
un error.** El envío nace en `in_progress` y cada paquetería tarda lo suyo:
con ampm seguía sin etiqueta minutos después. Ninguna espera razonable la
habría alcanzado — sólo habría gastado los 29 segundos y muerto por timeout
DESPUÉS de que el envío ya se pagó. Por eso hay una ruta aparte,
`GET /proveedores/pedidos/:id/guia`, que el panel consulta hasta que aparece.
Con FedEx salió al instante; depende de la paquetería.

**La Lambda de proveedores está en 29 segundos, no 15.** Comprar una guía son
cuatro llamadas encadenadas a Skydropx. Con 15 moría a media compra, que es
peor que un error: el envío puede haberse pagado y el pedido no enterarse. 29
es el techo — API Gateway corta a los 30.

### El precio del envío NO viene del navegador

El checkout manda **sólo** `cotizacionId` y `tarifaId`. La Lambda le pregunta
el precio a Skydropx. Comprobado mandando `"precio": 1` en el cuerpo: se
guardó el real, $35.46. Es la misma regla que el precio del producto.

El envío queda **congelado** en el pedido (paquetería, servicio, precio, días)
como ya se congelan el precio y las medidas: la cotización caduca del lado de
Skydropx y el precio de mañana no es el que pagó esa persona.

Al comprar la guía se añade `envio.real` con lo que se midió, lo que costó de
verdad y la diferencia. **Manda lo que Skydropx COBRÓ**, no la tarifa que
había cotizado: son dos números distintos y el que sale de la cuenta es el
primero.

### La diferencia de peso se ANOTA, no se cobra

Se decidió que la paga el taller. Pero **no existen pagos al taller**, así que
no hay de dónde descontar. Se registra igual, en dos sitios:

- en el pedido, dentro de `envio.real.diferencia`;
- en el proveedor, como `saldoEnvios` acumulado más `cargosEnvio`, una lista
  con el pedido, el monto y la fecha.

El desglose no es adorno: un total sin detalle no se puede defender ante quien
lo va a pagar. Y si no se registrara desde ahora, cuando existan las
liquidaciones no habría nada que cobrar hacia atrás.

Positivo = costó más de lo cobrado y lo debe el taller. Negativo = sobró, a
favor de Kustto. Verificado con un pedido real: cobrado $35.46, costo real
$34.95, `saldoEnvios: -0.51`.

Si anotar el cargo falla, **se grita al log y no se tira el envío**: la guía ya
se compró y lo que se pierde es un apunte contable.

### Las pantallas del taller ya existen (2 de septiembre)

`components/Proveedor/EnvioDelPedido.tsx`, dentro de la ficha del pedido. Tres
estados: medir y comprar, esperando la etiqueta, y etiqueta lista.

- **El sondeo se rinde a los 8 intentos** (~40 s) y deja un botón manual. No es
  precaución teórica: el pedido 922995 lleva **más de un día** con la guía
  comprada y `etiquetaUrl` en `null` —ampm en el sandbox no la genera—. Sondear
  para siempre con la pestaña abierta gastaría invocaciones sin fin.
- **La etiqueta se abre en pestaña nueva, no se "descarga".** La sirve la
  paquetería desde SU dominio y ahí el navegador ignora `download`. Prometer
  una descarga y abrir una pestaña es peor que decirlo.
- **Un 409 al comprar no se enseña como error**: significa que ya hay guía
  —otra pestaña, doble clic— así que se recarga y aparece.
- Se enseña siempre lo que costó de verdad y la diferencia, no sólo cuando es
  desfavorable: un cargo que aparece sólo cuando duele parece un castigo
  escondido.

Verificado contra AWS: compra en **7.9 s** recotizando con las medidas reales
(0.62 kg, 30×24×8) y respetando la paquetería que eligió el comprador; segundo
intento **409**; el cargo anotado (`saldoEnvios` de −0.51 a −1.03).

**El formulario va vacío**: el pedido NO guarda el peso estimado con el que se
cotizó en el checkout, sólo el resultado. Si se quisiera pre-rellenar habría
que guardarlo al crear el pedido.

### Cotizar no es poder despachar (3 de septiembre)

**Sólo Paquetexpress genera etiqueta en el sandbox.** ampm devuelve
`Credential '…' was not found in cache` o se queda en `in_progress` sin
etiqueta para siempre; tresguerras tampoco la produce. De seis pedidos con
guía: las dos de Paquetexpress salieron, una de ampm murió, otra se colgó, y
una de tresguerras sigue esperando. (Una de ampm sí funcionó, así que en el
sandbox es intermitente, no imposible.)

Lo grave no es el fallo de la paquetería: es **cuándo** ocurre. El cliente
elige el envío en el checkout, el pedido queda cobrado, y sólo al ir a comprar
la guía se descubre que esa paquetería no puede despachar. El taller se queda
sin salida y el pedido atascado con el dinero dentro.

Por eso ahora se puede acotar lo que se OFRECE, con `SKYDROPX_PAQUETERIAS`
(lista separada por comas; vacío = todas). Hoy vale `paquetexpress`, puesto
desde los scripts de despliegue. Verificado tras aplicarlo: una cotización real
devuelve sus tres servicios y ninguna otra paquetería.

Cuando estén dadas de alta las credenciales que faltan:

```bash
KUSTTO_PAQUETERIAS= bash infra/lambda-admin.sh
KUSTTO_PAQUETERIAS= bash infra/lambda-proveedores.sh
```

**Los pedidos que ya se compraron con ampm o tresguerras siguen atascados.**
Reintentar vuelve a usar la paquetería que eligió el comprador, así que
fallará igual: hay que dar de alta esa credencial o resolverlos a mano.

### Lo que falta de envíos

- **Varios bultos.** Todo asume un paquete por pedido. Cincuenta playeras no
  van en una caja; hoy hay un tope de 500 piezas que devuelve "escríbenos".
- **El cliente de Skydropx está duplicado** en `services/admin/src/lib/` y
  `services/proveedores/src/lib/`. Sigue la convención del repo —cada servicio
  con su `lib/`— pero es el archivo más grande que se copia, y si divergen va a
  doler. El de proveedores tiene además `comprarGuia` y `consultarEnvio`.

## Lo que se le entrega al taller para producir

Es lo que más ha costado afinar y lo que más fácil se rompe sin que nadie se
entere. Por cada lado dibujado salen **dos** archivos:

| | qué es | para qué |
|---|---|---|
| `arte` | recortado al área, transparente, a los DPI | va a máquina |
| `colocacion` | la prenda con el diseño encima | comprobar **dónde** va |

Y tres decisiones que conviene no deshacer:

- **Las medidas se congelan en la línea del pedido**, como el precio. Viven en
  `printSides` del producto y el taller puede cambiarlas mañana; si la ficha
  las leyera de ahí, un pedido de hace un mes se imprimiría al tamaño de hoy.
- **Se guarda la medida REAL del archivo, no la declarada.** No coinciden
  cuando el área de la plantilla no tiene la proporción de los centímetros
  declarados. La ficha enseña la real y avisa si se desvían más de medio
  centímetro, porque eso lo corrige el taller en su plantilla.
- **Al PNG hay que escribirle el DPI a mano** (`lib/designer/dpi.ts`). Ver
  abajo.

---

## Trampas que ya mordieron

**Borrar un pedido a mano NO devuelve las existencias.** El descuento se hace
en la misma transacción que el pedido y sólo lo revierte `cancelado`. Al
limpiar pedidos de prueba hay que **cancelarlos primero y borrarlos después**,
o el stock se queda descontado para siempre sin nada que lo explique.
Comprobado al limpiar: cancelar devolvió la gorra de 8 a 9 y la playera de −4
a −2.

**El comprador veía el margen del taller.** `sinSecretos` sólo quitaba la huella
del token, así que en el seguimiento y en `/cuenta` viajaban la **etiqueta** —un
documento operativo del taller— y el **costo real del envío**: $161.41 pagados
contra $209.93 cobrados, con la resta a la vista. Ahora hay un `paraComprador`
que recorta `envio` y `guia` a lo que necesita quien compró. **Está duplicado en
`services/admin` y `services/compradores`** porque cada servicio tiene su `lib`:
es un filtro de seguridad, así que si tocas uno toca el otro.

**La etiqueta no está en el envío, está en el PAQUETE.** `label_url`,
`tracking_number` y `tracking_url_provider` viven en `included[]` con
`type: "package"`, NO en `data.attributes`. Leyendo sólo los atributos del
envío, `label_url` sale `undefined` **siempre**: un envío de paquetexpress en
`success` y `paid`, con su PDF ya generado, se veía en el panel como "la
paquetería está preparando la etiqueta" para siempre. Por eso `aGuia` recibe
ahora el documento entero y no `data.attributes`. Verificado: la etiqueta baja
como **PDF de 64 KB**.

Se usa el `tracking_number` del paquete y no el `master_tracking_number` del
envío: el segundo existe antes que la guía y con varios bultos sería otro
número.

**Un envío puede MORIR, y se veía igual que uno lento.** `aGuia` sólo leía
`label_url`: un envío en `workflow_status: error` quedaba sin etiqueta para
siempre y el panel decía "la paquetería está tardando". Pasó con dos envíos
reales —`CREDENTIAL_SERVICE_PROVIDER_NOT_FOUND`, la cuenta del sandbox no tiene
dada de alta a ampm— y Skydropx **reembolsó** el cobro. Ahora se leen
`workflow_status` y `error_detail`, un envío muerto se dice tal cual con su
motivo, y **se puede reintentar**: la condición de "una sola guía" ya no
bloquea si la anterior falló, porque si no el pedido se quedaba sin guía para
siempre y sin forma de arreglarlo.

**El teléfono del comprador era opcional y la paquetería lo exige.** Entró un
pedido sin él; al ir a comprar la guía, Skydropx devolvía **422** y salía como
"Error interno". Ahora: obligatorio en el checkout, obligatorio en la API al
crear el pedido (10 dígitos, contando sólo dígitos para no rechazar un teléfono
bueno por cómo esté escrito), y una guardia antes de llamar a Skydropx que dice
qué falta y de quién. Además **un 422 sale como 400 con el mensaje de
Skydropx**, no como 500: es un dato que corregir, no un fallo nuestro.

**`guias.ts` devolvía `tokenHuella` al taller.** Usaba `sinLlaves` en vez de
`sinSecretos`, así que la huella del token de seguimiento del comprador viajaba
en la respuesta de comprar la guía —justo lo que el archivo de al lado prohíbe
explícitamente—. `sinSecretos` ahora se exporta para que no haya dos versiones
de la regla.

**Un despliegue desde otra máquina borraba las credenciales de Skydropx.**
`update-function-configuration` sustituye el entorno ENTERO, y los scripts
sólo ponían `SKYDROPX_*` si existía `infra/.skydropx` en local. Desde un equipo
sin ese archivo —el `.gitignore` lo deja fuera— el despliegue las borraba y
cotizar dejaba de funcionar **sin un solo error a la vista**. Arreglado el 2 de
septiembre en `lambda-admin.sh` y `lambda-proveedores.sh`: si el repo no las
trae y la función sí, mandan las suyas, igual que ya se hacía con la llave del
admin, el pool y el endpoint del WebSocket. Verificado desplegando las dos
funciones sin el archivo y comprobando que las credenciales siguen puestas.

**Ojo con esto en general:** cualquier variable de entorno nueva que sólo salga
de un archivo local necesita el mismo trato, o el siguiente despliegue desde
otro equipo la borra.

**Un ítem de DynamoDB no pasa de 400 KB, y el diseño no cabe.** El diseño
editable lleva dentro las imágenes que sube el cliente como data URL. Con
formas y texto cabía; en cuanto alguien arrastra una foto de verdad, el pedido
entero deja de caber y `escribirConFolio` falla con `Item size has exceeded the
maximum allowed size`, que desde el navegador se ve como un **500 al pedir**.
Ahora el diseño va a S3 con su URL firmada, igual que el arte, y en el ítem
sólo queda la ruta. De paso el cuerpo del POST bajó de **3 MB a 509 bytes**.

**Las subidas se emparejan por `indice`, no por lado.** Cada entrada de
`subidas` dice a qué línea del pedido pertenece. Emparejar sólo por `lado`
funcionaba mientras el pedido llevara un único producto y se habría roto en
silencio con dos que compartieran lado.

**`canvas.toDataURL()` no escribe la resolución.** Un PNG sin chunk `pHYs` se
abre asumiendo 72 DPI: comprobado con un arte real, 3307 × 4283 px se
interpretaban como **116 × 151 cm** en vez de 28. El archivo abre bien, se ve
bien, y sólo se nota cuando sale la prenda. `conDpi()` inserta el chunk tras
`IHDR` con su CRC. Si alguien "simplifica" esa función, vuelve el problema y es
mudo.

**Un `clearTimeout` en la limpieza de un efecto puede matar la única
ejecución.** En modo estricto React monta, limpia y vuelve a montar. Con un
guardia de "esto corre una sola vez" en una ref, la limpieza cancela el
temporizador del primer montaje y el guardia impide el segundo: no corre nunca.
Pasó en `SalidaAPedir` y dejaba "Preparando tu pedido" girando para siempre.

**Ninguna consulta paginaba, y DynamoDB corta en 1 MB sin avisar.** Había 11
`Query` en los servicios y ninguna leía `LastEvaluatedKey`: la respuesta llega
a medias, sin excepción y sin log. Demostrado con 40 ítems de 30 KB — una
página devolvía **35 de 40**. Ahora todas pasan por `consultarTodo`, que sigue
las páginas y avisa en el log si corta por el tope. **Un `Query` nuevo sin ese
helper vuelve a perder filas en silencio.**

**El folio se agotaba a los 9 000 pedidos.** Eran 4 dígitos —9 000 valores— y
no se liberan nunca: a los 3 000 pedidos fallaba 1 de cada 730, a los 6 000
uno de cada 11, y a los 9 000 no entraba ni uno más. Nunca. Ahora son **6
dígitos**. Los folios viejos de 4 conviven sin problema.

**Biome reescribe `new RegExp("[\\u0300-\\u036f]")` a expresión literal, y las
herramientas de edición convierten los escapes en el carácter combinante de
verdad.** Pasó tres veces en una sesión. Donde importe, se arma en tiempo de
ejecución con `String.fromCharCode` — ver `apps/web/lib/texto.ts`. Si editas
`DIACRITICOS` en cualquier archivo, comprueba los bytes después.

**El servidor de desarrollo cachea los mockups y tapa un 404.** Las respuestas
de `/mockups/*` llevan `cache-control: immutable`. En el navegador se veía la
prenda; contra la Lambda, `/publico/mockups/tshirtfront.png` responde **404**.
Comprueba siempre contra la API, no contra `localhost:3000`.

---

## La decisión abierta: mockups de verdad

**Hoy el mockup es un dibujo de línea, no una fotografía**, y trae el recuadro
punteado del área y una marca de agua **incrustados en el PNG**. Por eso la
referencia de colocación que recibe el taller sale con el punteado dentro.

No se puede hacer una previsualización realista con eso. Ninguna técnica de
composición convierte un dibujo vectorial en una foto.

**Lo que falta es material, no código.** Hace falta una foto por prenda y por
lado, sin guías ni marcas incrustadas y con fondo liso. En cuanto haya una:

- `lib/fabric/prenda.ts` **ya resuelve lo difícil**. `recortarPrenda` separa la
  prenda del fondo y la deja en gris, y ese gris **es** el mapa de pliegues,
  costuras y sombras. `tenirPrenda` ya lo multiplica para teñir.
- El realismo sale de multiplicar ese sombreado **encima del arte**: sobre una
  prenda blanca el multiply no hace nada salvo donde hay sombra, que es
  justo el efecto de tinta sobre tela.
- Un mapa de desplazamiento —para que el arte se deforme siguiendo las
  arrugas— es el paso siguiente, y sólo vale la pena si con el sombreado sigue
  viéndose plano.

Descartado a propósito: servicios externos tipo Printful o Placeit (mandarían
el arte del cliente a un tercero y cobran por render) y renderizar en el
servidor (el navegador ya tiene el lienzo y los píxeles).

---

## El sitio ya está publicado

**https://kustto.com.mx** sirve desde S3 + CloudFront, con export estático y
URLs bonitas: cada producto es HTML pre-renderizado e indexable.

| | |
|---|---|
| distribución | `E2UTAKM343NK5Z` → `d1tooh2apdlodr.cloudfront.net` |
| bucket del sitio | `kustto-sitio-prod` (cerrado; entra sólo CloudFront) |
| lo monta | `infra/frontend.sh` (infraestructura) |
| lo publica | `infra/sitio.sh` (construye y sube) |

**El precio de la decisión, que hay que tener presente:** un producto aprobado
**no aparece en el sitio hasta que se vuelve a correr `infra/sitio.sh`**. Las
URLs se calculan al construir. Se automatizará cuando duela.

Verificado tras publicar: el apex y `www` responden, `http` redirige a `https`,
`/catalogo` y una ficha de producto cargan, los mockups y los medios llegan por
el mismo dominio —que es lo que el editor necesita para leer sus píxeles—, los
dos buckets siguen dando **403** a quien los pida directo, y una URL inventada
da **404** y no un XML de S3.

### Tres cosas que costaron y no se deducen

- **`output: "export"` no admite una ruta dinámica que no genere ninguna URL.**
  `/proveedores/[slug]` y `/package/[id]` tenían `generateStaticParams` que
  devolvía `[]` a propósito, y el build falla con "is missing
  generateStaticParams()" —que señala justo lo que sí está—. Ponerles
  `dynamicParams = false` **no** basta. Se apartan al construir, como el admin:
  igualmente leen de Nest, que no se despliega.
- **El export necesita su propia carpeta de build** (`distDir: ".next-sitio"`).
  Compartir `.next` con el servidor de desarrollo rompía la compilación: ahí
  quedan los tipos que Next genera por ruta, incluidos los del admin apartado,
  y fallaba con un `Cannot find name` señalando un archivo que ya no existe.
- **El CORS se configura desde `lambda-admin.sh`, y antes lo reescribía con un
  solo origen en cada despliegue.** Cambiarlo a mano en la consola habría
  durado hasta el siguiente `bash infra/lambda-admin.sh`, y el sitio se habría
  quedado sin datos sin un solo error en los registros. Ahora es una lista
  (`KUSTTO_ORIGENES`) con el de desarrollo y los dos de producción, en JSON
  porque la forma corta del CLI usa la coma para separar claves. Lo mismo en
  `cors.sh` para las subidas directas a S3.

### Lo que falta

1. **El admin no se publica, y es a propósito.** El proxy `/api/admin/*` lleva
   la llave puesta. Comprobado tras publicar: `/admin` y `/api/admin/*` dan
   **404** en el sitio. Se usa en local con `pnpm --filter web dev` hasta que
   tenga login propio. Se aparta moviendo carpetas en `infra/sitio.sh` —un
   apaño consciente—; la salida buena, cuando crezca, es que sea su propia
   aplicación en el monorepo.
2. **Redesplegar al aprobar un producto.** Hoy es manual.
3. **El sitio se construye con `.env.local`**, o sea con las variables de la
   máquina de quien publica, y eso ya mordió: al primer despliegue le faltaba
   `NEXT_PUBLIC_KUSTTO_WS`, así que **el panel del taller salió a producción
   sin canal en vivo** —no se enteraba de un pedido nuevo hasta recargar— y el
   único rastro era un aviso en la consola del navegador. Arreglado y
   republicado. Hace falta un `.env.production` versionado con lo que no es
   secreto (la URL de la API, el WebSocket, los pools) para que dos personas
   publiquen lo mismo; mientras no exista, **antes de publicar compara las
   `NEXT_PUBLIC_*` que usa el código con las que tiene tu `.env.local`**.

### El dominio apuntaba a otra zona — arreglado, esperando al registro

Esto tuvo bloqueado durante un día el certificado de ACM, la verificación de
SES, el DKIM y la llegada del correo. Las cuatro parecían "hay que esperar" y
ninguna lo era.

**Hay DOS cuentas de AWS y conviene tenerlo claro:**

| | cuenta | para qué |
|---|---|---|
| `kustto-admin` | 218897024535 | toda la app: tabla, buckets, Lambdas, SES, ACM, la hosted zone buena |
| `root-admin` | 467685081574 | **el registro del dominio** (Route53 Domains). También tiene `belza.com.mx`, `matehdz.com` y `visoracloud.com` — no tocar |

`kustto.com.mx` está comprado en la cuenta root, y estaba delegado a una
hosted zone de ESA cuenta que sólo tenía dos registros: el SOA y un NS del
apex editado a mano para apuntar a la zona buena.

**Eso no funciona, y engaña.** La zona vacía es autoritativa para el dominio,
así que cuando un resolutor le pregunta responde ella misma "no existe" en
lugar de reenviar. Los NS de dentro no re-delegan nada.

**Y engaña al comprobarlo:** preguntarle a un resolutor público por los NS
devuelve el registro NS de la zona equivocada y parece correcto. Así me
equivoqué yo y escribí aquí que era cuestión de esperar. La pregunta correcta
es al TLD:

```bash
nslookup -type=NS kustto.com.mx i.mx-ns.mx
```

**Arreglado y propagado** el 2 de septiembre con
`route53domains update-domain-nameservers` en la cuenta root, apuntando a los
cuatro de la zona buena (`ns-67.awsdns-08.com`, `ns-806.awsdns-36.net`,
`ns-1037.awsdns-01.org`, `ns-1865.awsdns-41.co.uk`).

El TLD ya devuelve los nuevos, y todo resuelve en resolutores públicos: el TXT
de verificación, el MX a `inbound-smtp.us-east-1` y los tres DKIM. **El
certificado de ACM pasó a `ISSUED`**, que es la prueba de que el arreglo
funcionó.

**El dominio y el DKIM quedaron en `SUCCESS`** poco después, y el buzón recibe:
se probó mandando un correo a `hola@kustto.com.mx` y llegó reenviado. Cayó en
spam la primera vez, que es lo normal en un dominio recién nacido; a raíz de
eso se pusieron SPF, DMARC y el MAIL FROM propio (ver más abajo).

### La zona huérfana ahora es un ESPEJO. No la borres todavía.

Después de propagar, Gmail seguía rebotando el correo con:

```
DNS type 'mx' ... responded with code NOERROR ... had no relevant answers
```

`NOERROR` sin datos, **no** `NXDOMAIN`: el resolutor llegó a un servidor
autoritativo y ése le dijo "el dominio existe, pero no tiene MX". Sólo lo
podía decir la zona vacía. Google tenía cacheada la delegación vieja, y la
delegación en el TLD lleva **TTL de 2 días**.

Esperar 48 horas no valía la pena, así que el 2 de septiembre se copiaron a
`Z0661018HWVA3HQPWD42` (cuenta root) los mismos registros con TTL 300: el MX,
el TXT `_amazonses` y los tres DKIM. Ahora **los dos juegos de nameservers
responden igual**, así que da lo mismo cuál tenga cacheado quien pregunte.

**Consecuencia:** esa zona ya NO es basura inofensiva, es parte del camino. No
se borra hasta que la delegación vieja haya caducado en todas partes —dos días
desde el cambio— y aun entonces, comprobando antes que ningún resolutor
público la siga usando. Cuando se borre, hay que acordarse de que los
registros de verdad viven en la zona de `kustto-admin`.

### Route53: hay DOS juegos de DKIM y los dos están vivos

Corregido el 3 de septiembre. Antes decía aquí que los tres CNAME
`_domainkey` de la zona eran "tokens viejos de una identidad borrada, que no
usa nadie". **Es falso, y era una invitación a borrarlos.**

Son los DKIM de la identidad `kustto.com.mx` de la **cuenta root**
(`467685081574`), que es la que manda el correo de verdad:

- `ui6peram…`, `6vf7srsa…`, `kfq7qcoy…` → identidad de la **cuenta root**, la
  que firma lo que sale. **NO SE BORRAN.**
- `rhwzjikm…`, `5k3xyapq…`, `pshmhqws…` → identidad de la **cuenta de la app**
  (`218897024535`), la que recibe en el buzón.

Los dos juegos conviven porque el nombre del registro lleva el token dentro.
El error salió de mirar sólo una cuenta: la identidad de la app pedía unos
tokens, en la zona había otros, y de ahí a "están muertos" hay un paso muy
corto y muy equivocado.

El **MX** apunta a `inbound-smtp.us-east-1.amazonaws.com`, la recepción de SES
en la cuenta de la app. Ése tampoco se toca.

### El envío sale de la cuenta root, y NO por la vía que parece

**Corregido el 3 de septiembre tras probarlo.** Aquí decía que autorizar la
identidad bastaba y que "la cuota y la reputación son las del dueño de la
identidad". **Es falso.**

`kustto.com.mx` está verificado en las dos cuentas y **sólo una sirve para
enviar**:

| cuenta | SES |
|---|---|
| `218897024535` (la app) | **sandbox**: 200/día, sólo a direcciones verificadas |
| `467685081574` (root) | **producción**: 50 000/día, 14/s |

**LO QUE NO FUNCIONA.** SES deja que una cuenta envíe con la identidad
verificada de otra (`FromEmailAddressIdentityArn`, su *sending authorization*).
Parece la solución y no lo es: **la cuota y el sandbox son los de quien LLAMA**.
Montado así, el envío se contaba en la cuenta de la app —se vio en su
`SentLast24Hours`— y seguía rechazando destinatarios sin verificar.

Engañó porque la primera prueba manual salió bien, por dos motivos que no
aplicaban a las Lambdas: el usuario con el que probé tiene `AdministratorAccess`
y el destinatario **estaba verificado** en la cuenta de la app.

**LO QUE SÍ.** Un rol en la cuenta root (`kustto-correo`) que las Lambdas
asumen. Así quien llama a SES es la cuenta root, con su acceso a producción. Lo
monta `infra/correo-envio.sh`, que es idempotente y necesita los dos lados: el
rol allá con su relación de confianza, y el permiso para asumirlo acá. Con uno
solo el error dice "no autorizado" sin aclarar cuál falta.

Se confía en **los dos roles uno a uno**, no en la cuenta entera: con
`:root` cualquier cosa que corriera en la cuenta de la app podría enviar como
`kustto.com.mx`.

Verificado el 3 de septiembre: un pedido a `notificaciones@belza.com.mx` —**sin
verificar** en la cuenta de la app— disparó sus dos correos, y la métrica `Send`
de la cuenta root los contó. Esa es la prueba de que el sandbox quedó fuera.

### Lo que se puso para que el correo no caiga en spam

El primer reenvío llegó a spam, y al mirar por qué faltaban tres cosas —las
tres afectan también a los correos de pedido, no sólo al buzón—:

| | |
|---|---|
| SPF en el dominio | `v=spf1 include:amazonses.com ~all` |
| SPF del sobre | igual, en `correo.kustto.com.mx` |
| MX del sobre | `feedback-smtp.us-east-1.amazonses.com` |
| DMARC | `v=DMARC1; p=none; adkim=r; aspf=r` |
| MAIL FROM propio en SES | `correo.kustto.com.mx`, estado `SUCCESS` |

**El MAIL FROM propio es el que más pesa.** Por defecto SES pone
`amazonses.com` como remitente del SOBRE, que es distinto del `From` que lee
la gente. SPF se comprueba contra el sobre, así que sin esto **SPF no alinea**
con el `From` y DMARC sólo podía pasar por DKIM.

`~all` y no `-all`, `p=none` y no `quarantine`: endurecerlos en un dominio
recién nacido tira correo legítimo sin que nadie se entere. Se suben cuando
lleve semanas enviando limpio.

Todo eso está en `infra/correo.sh` y **también en la zona espejo**, que
mientras dure la caché vieja tiene que decir lo mismo.

Lo que no arregla ninguna configuración es la reputación de un dominio que
mandó su primer correo ayer: mejora con volumen y con que la gente los abra.

---

## Los correos que salen

Cinco, todos con `enviar()`, que **nunca lanza**: se mandan después de que el
pedido está escrito, así que un fallo de correo no puede tumbar un pedido.

| cuándo | a quién | qué lleva |
|---|---|---|
| pedido creado | comprador | su **enlace de seguimiento** |
| pedido creado | taller | folio, producto, piezas, importe |
| pasa a `listo` | comprador | con `recoger`: **dónde y con quién**; con envío, aviso a secas |
| pasa a `enviado` | comprador | paquetería y número de rastreo |
| pasa a `entregado` | comprador | cierre, y 7 días para reportar algo |

**De `produccion` NO se avisa, a propósito.** Entre que entra el pedido y que
está hecho no hay nada que el comprador pueda hacer, y un correo que no pide
nada ni cambia nada enseña a ignorar los que sí importan.

**El de `listo` con `recoger` es EL correo de esos pedidos.** Después de él ya
no hay ningún otro estado que le avise de nada a quien compró: si no lleva la
dirección del taller y su teléfono, nadie se entera de que puede ir por su
prenda. Por eso `avisarQueEstaListo` lee el ítem del taller —una lectura de más
que sólo se paga cuando el método es `recoger`.

**El del comprador es el que importa.** Ese enlace es lo ÚNICO que da acceso al
pedido a quien pidió sin cuenta: del token sólo se guarda la huella, así que si
se pierde no hay forma de devolvérselo ni por soporte. Antes sólo aparecía en
pantalla y cerrar la pestaña bastaba para perderlo.

**Dos de ellos se disparan desde DOS sitios**, porque el estado lo puede mover
el taller a mano (`services/proveedores`) o la paquetería por webhook
(`services/admin`):

- **"va en camino"** — el taller lo marca, o lo marca el webhook.
- **"llegó"** — el taller lo marca cuando el cliente RECOGIÓ; el webhook cuando
  la paquetería ENTREGÓ. `permitidos()` reparte: con envío el taller no puede
  marcar `entregado`, porque eso lo sabe quien la llevó, no quien la hizo.

("ya está listo" sale sólo de proveedores: eso lo sabe quien produce.) Por eso `correo.ts` y `plantillas.ts` están **duplicados en
los dos servicios**: cada uno es su propio bundle, como ya pasa con
`skydropx.ts`. **Copia los archivos enteros al cambiarlos** — si las plantillas
divergen, el mismo cliente recibe un texto u otro según quién movió el pedido, y
eso no sale en ninguna prueba. Si aparece un tercer disparador, la salida buena
es una Lambda sobre el stream de DynamoDB: los streams ya están activados.

En los dos casos el correo va **después** del `UpdateItem` con su condición, así
que dos clics a la vez sólo mandan uno.

Los correos van en **texto y HTML**. El texto no es un respaldo de segunda: los
filtros de spam castigan el sólo-HTML y hay clientes que no lo pintan. El HTML
va en tablas con estilos en línea porque Gmail borra las hojas de estilo y
Outlook renderiza con Word.

---

## Lo que sigue, en orden

1. **El perfil del taller, obligatorio de verdad.** Un taller sin dirección de
   recolección desaparece del checkout con envío —`leerOrigen` no cotiza y al
   comprador le sale "este taller no envía todavía"— y uno sin teléfono no puede
   comprar la guía, que es peor porque para entonces el pedido ya está cobrado.
   Ya hay un aviso en el panel (`components/Proveedor/AvisoDePerfil.tsx`) y el
   teléfono por fin se puede escribir desde el perfil, pero **nada obliga a
   completarlo al darse de alta**: hoy un taller puede empezar a vender sin
   ninguno de los dos. `Bordados Tapatíos` está así en producción.
2. **Cerrar las existencias.** El backend está y verificado; falta lo que se
   ve: el aviso de "+N días, se produce bajo pedido" en el editor y el
   checkout, la alerta de bajas en el panel, y la capacidad semanal. Sin el
   aviso, el comprador no se entera de que tarda más hasta que lee su
   confirmación — y ese aviso es la mitad del trato que se decidió.
3. **Rechazar un pedido y mover con nota.** La API acepta las dos cosas y el
   seguimiento del comprador ya enseña la nota, pero el panel no las manda. Es
   sólo interfaz. Dos avisos: **cancelar devuelve existencias**, así que el
   botón hace más de lo que parece; y desde el 3 de septiembre **sólo se puede
   cancelar en `nuevo`**, antes de que el taller empiece.
4. **Contraseña del taller.** No hay forma de cambiarla ni de restablecerla: ni
   el taller, ni el admin, ni "olvidé mi contraseña". Hoy se arregla entrando a
   la consola de AWS. El rol de admin **ya tiene `AdminSetUserPassword`**.
5. **El panel en móvil.** La barra lateral es `fixed w-[236px]` con el contenido
   en `ml-[236px]` y **ni un breakpoint**: en un teléfono quedan 154 px útiles.
   Quien produce está en el taller, no en un escritorio.
6. **Login de admin.** El proxy `/api/admin/*` sigue siendo una puerta abierta.
   Mientras no exista, el admin se queda fuera del sitio público (ver arriba).

---

## Cosas que hay que limpiar

- **Faltan mockups, y en producción se nota.** El frente de `tshirt` ya está
  arreglado —apunta a `mockups/tshirt/front-8cdcbb1aa538.png`, que sí existe—
  pero **el reverso de la playera y la gorra siguen dando 404**
  (`/mockups/tshirtback.png`, `/mockups/cap.png`): esas imágenes no están en
  ningún sitio y hay que subirlas desde `/admin/mockups`. Sin ellas el editor
  abre sin prenda de fondo. Ojo al comprobarlo: el servidor de desarrollo
  cachea los mockups con `immutable` y tapa el 404 — hay que mirar contra la
  API o contra el sitio publicado.
- **El área de esa plantilla es 270 × 350 px** (proporción 0.771) y el producto
  declara 28 × 35 cm (0.8). De ahí sale la desviación de 1.3 cm que avisa la
  ficha. Cambiando el rectángulo a **280 × 350** cuadra exacto.
- **Los productos no tienen colores capturados.** "Tshirt basico" tiene cero, y
  por eso los pedidos salen con `colorPrenda: null`. Para producir importa: el
  color decide si lleva subbase blanca.
- **Proveedores de prueba vivos en Cognito.** Bórralos antes de abrir esto.
  - `prueba.login@kustto.mx`, contraseña `kustto2026taller`, permanente.
  - `taller@bordadostapatios.mx`, **sin contraseña conocida**: se cambió al
    probar el reto y Cognito no la devuelve.
- **`pnpm-lock.yaml` sigue ignorado y sin versionar.** Con dos máquinas en
  juego es lo que más puede doler: `pnpm install` resuelve versiones frescas.
- La landing de proveedores vive en `/proveedores` y el panel autenticado en
  `/proveedor`. Dos nombres a un carácter de distancia van a doler.
- **El asistente de alta exige 2 fotos y sólo pone el botón en gris.** Un
  taller que suba una se queda bloqueado sin entender por qué. Al producto de
  prueba se le duplicó una foto para poder avanzar.
- **La app de Google puede estar en modo "Testing".** Google ya está enganchado
  (ver abajo), pero si la pantalla de consentimiento sigue en Testing **sólo
  entran los correos listados como probadores**: cualquier otro recibe "acceso
  bloqueado" y desde nuestro lado se ve como un login que no vuelve. Se abre
  con "Publish app" en console.cloud.google.com, y con `openid/email/profile`
  no hay revisión de por medio.
- **Cuentas de prueba en el pool de compradores** además de las de talleres.
- **Hay ~250 archivos modificados sin commitear** que son casi todo formato:
  una pasada de Biome mezclada con conversión CRLF de trabajar desde macOS y
  Windows. **No hay `.gitattributes`** y `core.autocrlf` está en `true`.
  Mientras siga así, cualquier diff real queda enterrado.

---

## Si vienes de otra máquina

1. Clona y sigue "Puesta en marcha en una máquina nueva" del `README.md`.
2. Los secretos (`services/admin/.clave-admin`, `infra/.cognito`,
   `infra/.cognito-compradores`, `infra/.websocket`, el `.env` del front) **se
   recuperan de AWS**, no hay que llevarlos a mano: los `.cognito*` y
   `.websocket` los reescriben sus scripts, que son idempotentes.
   **`infra/.skydropx` e `infra/.google` NO se recuperan** —son credenciales de
   terceros— pero ya no hacen falta para desplegar: los scripts conservan lo
   que la función tenga puesto.
3. Reinicia el servidor de desarrollo después de instalar, o los títulos salen
   en Poppins en vez de Figtree: el `@theme` de Tailwind sólo se recompila al
   arrancar.
4. El proyecto se desarrolló en Windows y ahora también en macOS. Los scripts de
   `infra/` funcionan igual en los dos: `aws.sh` encuentra el CLI por
   `command -v` y sólo cae a la ruta de Windows si hace falta.
