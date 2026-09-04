# Dónde nos quedamos

_Última actualización: 4 de septiembre de 2026._

Este archivo es el traspaso entre sesiones: lo que **no** se deduce leyendo el
código. Para el mapa del proyecto ve a `README.md`; para el AWS, a
`infra/README.md`. Si algo de aquí ya se hizo, bórralo — este documento sólo
sirve si se mantiene corto y cierto.

**Lo último que se hizo, por si sólo lees esto:** el **backoffice ya está
publicado** en `backoffice.kustto.com.mx`, con su propio pool de Cognito
(`kustto-admins`), sus rutas `/admin/*` detrás de un autorizador JWT y **sin la
llave compartida**, que se eliminó. Ver "El backoffice tiene dominio y puerta
propios". Las cuentas se crean con `bash infra/crear-admin.sh correo`.

Antes: la **previsualización sobre
la prenda real** —el taller sube una foto por lado y color y marca las cuatro
esquinas donde imprime; el botón "Probar" del editor proyecta el diseño encima
y se puede descargar en PNG—, el **borrado de productos del taller**, el
**cajón de detalle** en el catálogo del panel, la **portada del panel sin
pedidos** y las **animaciones de entrada y salida** en todo `/cuenta`.
**Todo desplegado** el 4 de septiembre: las dos Lambdas y el sitio.

Antes: las **plantillas** —un paquete de productos con sus cantidades, guardado
para volver a pedirlo—, con su pantalla para crear y editar, el catálogo en un
cajón y el editor sabiendo que diseña PARA una plantilla. Y con ellas salieron
**tres fallos del carrito** al usarlo de verdad: el total en $0, el checkout
del carrito sin precargar el perfil, y el enlace de seguimiento que no abría
después de pagar. Los tres arreglados y desplegados.

Antes: el **panel del comprador como dashboard completo** —sin cabecera ni pie
del sitio, sidebar fijo, y el detalle del pedido dentro— con **repetir un
pedido y guardar diseños con nombre**. Backend probado contra AWS; el aspecto
**no está mirado** (ver "Lo que quedó sin comprobar").

Antes: el **carrito de varios talleres**, completo —se agrega desde el editor,
se ve en `/carrito`, y `/pedir/carrito` cobra una compra que se parte en un
pedido por taller—, con sus dos pantallas rediseñadas. De ese bloque ya sólo
faltan los **correos de la COMPRA**: hoy los avisos salen por parte.

Antes: el sitio publicado en **https://kustto.com.mx** (S3 + CloudFront,
export estático, con el admin deliberadamente fuera), los envíos con Skydropx,
el inventario obligatorio, el buzón de `@kustto.com.mx` y los correos de
pedido. Todo verificado contra AWS, nada en local.

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

**El panel del comprador es `/cuenta`**, una sola ruta con las secciones en
`?s=`. No son varias rutas con layout compartido a propósito: `/cuenta/entrar`
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

## El panel es un dashboard, y repetir pedidos (3 de septiembre)

**Ya no lleva la cabecera ni el pie del sitio.** El armazón es el sidebar más
el área de contenido, cada uno con su propio scroll (`h-screen` +
`overflow-hidden` en el contenedor, `overflow-y-auto` en el `<main>`). Con el
scroll en el `body` la columna se iba hacia arriba al bajar por la lista.

Dos consecuencias que hay que respetar al tocarlo:

- **La marca del sidebar es la única salida al catálogo.** Sin cabecera, no
  hay otra. Si la quitas, el panel se convierte en un callejón.
- **El carrito se enseña en la barra de título del panel**, y sólo cuando
  tiene algo. Vivía en la cabecera del sitio; sin esto, quien acaba de repetir
  un pedido no tiene por dónde llegar a pagarlo sin salirse.

**Las secciones fuera del menú son `?s=pedido` y `?s=repetir`.** Las dos
exigen `&id=`, así que sin él no significan nada y por eso no están en la
lista; en el menú se marca "Pedidos", del que cuelgan.

**El detalle del pedido lo pintan DOS sitios y es el mismo componente**
(`components/Pedido/Detalle.tsx`): el panel y la página pública `/pedido`, a la
que se llega con el token del correo sin tener cuenta. Estaban duplicados y eso
garantizaba que un arreglo cayera sólo en el que se mira, no en el que le llega
al cliente. **No lo vuelvas a separar.**

**Los datos del panel se piden UNA vez** (`components/Cuenta/datos.tsx`). Los
pedidos los necesitan tres sitios —la lista, las pastillas del menú y la
rejilla de diseños— y antes eran tres viajes idénticos; además, cambiar de
sección desmontaba el componente y los volvía a pedir. No es una caché: no
caduca ni revalida, vive mientras el panel esté abierto.

### Repetir: la comparación no se salta

La línea de un pedido **congela** precio, medidas y plazo; el catálogo es de
hoy. Entre un mes y otro sube un precio, se archiva un producto o se acaban los
blancos. Por eso hay dos rutas y no una:

- `GET /cuenta/pedidos/:id/repetir` **lee y compara, no crea nada.** Devuelve
  cada línea con `estado`: `igual`, `precio`, `plazo` o `no_disponible`.
- `POST /cuenta/pedidos/:id/repetir` deja las líneas elegidas en el carrito.

**El POST vuelve a comparar**, aunque el front ya lo hizo al pintar la
pantalla: entre mirar y pulsar puede archivarse un producto, y descubrirlo al
final del checkout es el peor sitio. Lo que se cae vuelve en `descartadas`, y
el front avisa **sin navegar**.

**El arte se copia de servidor a servidor**, de `medios/pedidos/…` a
`carritos/<id nuevo>/…`, con el mismo mapa de nombres que usa `copiarDelCarrito`
al comprar pero al revés. Un arte de producción es de MB —el que se probó, 1.1
MB— y hacer que el navegador lo baje para volver a subirlo lo dobla. Por eso el
rol de `kustto-compradores` necesita **`s3:PutObject` en `carritos/*`**, que se
añadió en `infra/lambda-compradores.sh`.

**Ninguna de las dos crea el pedido.** Acaba en el carrito y sale por el
checkout de siempre. Repetir no puede ser una segunda forma de escribir
pedidos: ahí es donde acaban divergiendo las reglas de precio.

**Un id de carrito nuevo por artículo**, nunca el del pedido viejo: si dos
repeticiones compartieran carpeta, vaciar el carrito de una borraría el arte de
la otra.

### Diseños guardados

**No hay un "guardar" en el editor, y es deliberado.** Un diseño guardado nace
ascendiendo una línea de pedido que ya existe: se le pone nombre y sube. Así
quien compra una vez no ve un concepto nuevo, y quien repite lo tiene arriba.

**El arte se copia, no se referencia.** Un diseño guardado sobrevive a su
pedido; apuntar a `medios/pedidos/<pedido>/…` lo dejaría colgando el día que
ese pedido se limpie.

**El id nace sin `:` ni `.`** (`20260903T192354-df08e579`). Ordena igual que el
ISO y no hay que escaparlo ni en una llave de S3 ni en una URL — el editor lo
recibe por `?diseno=` y lo valida contra una lista blanca.

**`useCarrito` tiene `agregarVarios`** para esto. No es `agregar` en un bucle:
cada `agregar` escribe en las dos mitades, así que repetir cinco líneas
mandaría cinco PATCH a la cuenta y ganaría el último.

### Lo que quedó sin comprobar

**El aspecto del panel logueado no se ha mirado nunca.** Se verificó que
compila (`tsc`, `biome`, y esbuild sobre los trece componentes) y que el
backend funciona, pero no cómo se ve. Falta mirar sobre todo:

- el sidebar y la tira de secciones **en teléfono**,
- el diálogo de ponerle nombre a un diseño,
- el perfil en dos tarjetas a pantalla ancha,
- la barra pegada del resumen en `?s=repetir`.

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

**Turbopack miente sobre archivos que acabas de crear o cambiar.** Mordió dos
veces seguidas el 3 de septiembre, y las dos veces el error apuntaba al sitio
equivocado.

- Un `Module not found: Can't resolve '@/components/Cuenta/Repetir'` con el
  archivo en disco y `tsc` en verde. Otros archivos nuevos de la misma carpeta
  sí resolvían, así que no era "los archivos nuevos fallan".
- Un `Parsing ecmascript source code failed` en `Ajustes.tsx` señalando un `}`
  perfectamente válido.

**Cómo saber que es la caché y no tú:** mira el número de línea que da el
error contra el archivo real. La segunda vez decía `</form>` en la 245 cuando
estaba en la 257 — o sea que estaba compilando una versión doce líneas más
corta. Y comprueba con **otro parser** antes de tocar el código: `tsc
--noEmit`, o `esbuild archivo.tsx --outfile=…`, que da el error exacto si
existe.

Lo primero a veces se arregla tocando el archivo (`printf '\n' >> …`); lo
segundo no se arregló así y hubo que **reiniciar el servidor**. Perdí un rato
buscando un desequilibrio de JSX que no existía — y una comprobación mía a
mano contó mal, porque había un `<label>` dentro de un comentario en prosa.

**`pathname === "/algo"` funciona en `pnpm dev` y falla en producción.** Ya
mordió DOS veces y la segunda dejó una pantalla en blanco.

`trailingSlash` se enciende **sólo al exportar** (`next.config.ts`), porque el
export escribe `/catalogo/index.html` y la función de CloudFront resuelve las
URLs bonitas añadiendo `index.html`. Consecuencia: en el sitio publicado
`usePathname()` devuelve `/proveedor/login/` **con barra**, y en desarrollo
sin ella. La comparación contra el literal da falso justo donde nadie la
prueba.

- La primera vez: el layout del catálogo creía estar en una subruta y montaba
  su buscador encima del hero, que ya trae el suyo — **dos buscadores**.
- La segunda (3 de septiembre): `isLogin` daba falso en `/proveedor/login/`,
  el layout montaba el panel en vez del login, y sin sesión el panel devuelve
  `null` → **página en blanco**, con el efecto redirigiendo al mismo sitio en
  bucle. Se llegaba entrando a `/proveedor` sin sesión, que es el camino
  normal. Entrando directo a `/proveedor/login` sin barra sí renderizaba, y
  por eso parecía intermitente.
- Y dos más que nadie había notado: ninguna entrada de la barra lateral quedaba
  marcada como activa, y el aviso de perfil incompleto salía **también dentro
  del propio perfil**.

Se compara con **`mismaRuta()` de `apps/web/lib/rutas.ts`**, que normaliza los
dos lados. Vive en un archivo compartido y no como un `.replace()` suelto por
pantalla justamente porque repetido se olvida: la primera vez se arregló en un
solo sitio y quedó suelto en los otros tres.

Comprobado con el build de export servido en local imitando a CloudFront:
misma URL `/proveedor/login/`, producción `(VACIO)` y el build con el arreglo
enseñando el formulario.

**Los scripts de `infra/` se corren en Windows Y en macOS, y el CLI de AWS no
es el mismo bicho en los dos.** Dos cosas que ya rompieron y que ahora resuelve
`infra/aws.sh` para todos:

- **Git Bash convierte los argumentos que empiezan por `/`** antes de pasarlos
  a un binario nativo. `--paths "/*"` de una invalidación de CloudFront salía
  como `C:/Program Files/Git/*` y AWS contestaba *"invalid invalidation
  paths"*, sin mencionar rutas. Ahora `aws.sh` exporta `MSYS_NO_PATHCONV=1`.
- **Al revés, una ruta de archivo REAL sí hay que traducirla.** El CLI de
  Windows no entiende `/tmp/tmp.XXXX` y falla con `Unable to load paramfile`
  señalando una ruta que para el shell existe. Se pasa por
  **`ruta_cli()`**, que usa `cygpath -m`. Comprobado: con la ruta convertida el
  CLI lee el archivo; sin convertir, falla.

Las dos son **inertes en macOS** —la variable no la lee nadie y `cygpath` no
existe, así que el helper devuelve la ruta tal cual—, que es la única forma de
que un solo script sirva en las dos máquinas. Si añades un `file://` o
`fileb://` con ruta absoluta, pásalo por `ruta_cli`; con ruta relativa (como
los `--zip-file fileb://services/...`) no hace falta.

**Ampliar un rol de IAM no basta: hay que reciclar la Lambda.** Al añadirle
`dynamodb:DeleteItem` al rol de compradores —que le faltaba, y por eso
`DELETE /cuenta/carrito` daba **500 en producción** desde que se escribió— la
función siguió negando durante **90 segundos** con `AccessDeniedException`,
aunque:

- `get-role-policy` ya devolvía la acción,
- `iam simulate-principal-policy` decía **`allowed`**,
- y no había otra política, ni política gestionada de más, ni límite de
  permisos.

El contenedor conserva la autorización vieja. Se destraba forzando contenedores
nuevos:

```bash
aws_ lambda update-function-configuration --function-name kustto-compradores \
  --description "reciclar $(date +%s)"
```

Los scripts NO lo hacen. Si amplías un rol y pruebas enseguida, vas a creer que
tu política está mal — y el simulador te va a decir que está bien, que es lo
que más despista.

**Borrar un pedido a mano NO devuelve las existencias.** (Vuelto a pisar el 3
de septiembre: el `PATCH` de cancelar falló por un token caducado, el borrado
siguió igual, y la gorra quedó en `-4`. Si automatizas la limpieza, **comprueba
que la cancelación respondió** antes de borrar.) El descuento se hace
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

## La prenda real: decidido y construido (4 de septiembre)

La pregunta de "cómo enseñar el diseño sobre algo que no sea un dibujo" ya
tiene respuesta, y no fue la que estaba escrita aquí.

**Lo que se descartó, y por qué.** La idea anterior era una foto de prenda
clara sobre fondo blanco, teñida con `recortarPrenda` + `tenirPrenda` como el
mockup: una foto por lado cubriría todos los colores. Se descartó al plantearlo
en serio: ese teñido **no admite una foto con modelo** —le teñiría la cara— ni
una prenda ya oscura. Se eligió **una foto por lado Y por color**, que cuesta
más trabajo al taller y permite modelo, contexto y prendas negras.

**El modelo.** Cada producto lleva `fotosReales: [{ lado, color, url,
esquinas }]`.

- Las **esquinas van en fracciones de 0 a 1** del ancho y alto de la foto, en
  el orden arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda. En
  píxeles quedarían atadas a la resolución con la que se marcaron y bastaría
  recomprimir la foto para descuadrar el estampado. La Lambda rechaza cualquier
  cosa fuera del `[0,1]`, que además es como se detecta que llegaron en píxeles.
- **Son cuatro puntos y no un rectángulo** a propósito: sobre una prenda de
  verdad la tela cae y el torso va en ángulo, y un rectángulo recto se lee como
  calcomanía pegada.
- La **ruta tiene que ser nuestra** (`/medios/…`). Misma regla que los mockups:
  la composición pasa por un lienzo y una imagen de otro origen lo contamina.

**Dónde está el código.**

| qué | dónde |
| --- | --- |
| la homografía para pintar (CSS `matrix3d`) | `lib/prenda/perspectiva.ts` |
| la misma, rasterizada a PNG | `lib/prenda/componer.ts` |
| el taller marca las esquinas | `components/Provider/alta/PasoPrenda.tsx` |
| el modo "Probar" del editor | `components/Designer/VistaDeLaPrenda.tsx` |

**Para mirar es CSS; para guardar, un lienzo.** En pantalla la proyección cabe
en las dos filas que `matrix3d` reserva a la perspectiva y la hace la GPU,
gratis por fotograma. Eso **no se puede exportar** —el navegador no deja leer
píxeles de una capa transformada—, así que descargar rehace la composición
recorriendo los píxeles del destino e invirtiendo la matriz. Se evaluó partir
el cuadrilátero en triángulos (más rápido) y se descartó: deja costuras finas
que hay que ir tapando dilatando triángulos.

**La mezcla depende del color de la tela.** `multiply` es lo que hace que se
vea impreso —deja pasar pliegues y sombras—, pero multiplicar por blanco no
cambia nada: sobre una prenda oscura una tinta clara desaparecería. Tela clara
va con `multiply`, tela oscura encima sin mezclar. Sin color reconocible se
trata como oscura, que es la caída segura.

**Lo que FALTA de esto:**

- ~~El pedido sigue guardando la composición sobre el MOCKUP.~~ — **hecho** el
  4 de septiembre: el pedido lleva ya los tres archivos. Ver "La prenda real
  llega al taller".
- **Sólo está en el editor de escritorio.** El editor móvil tiene su propia
  cabecera y no lleva el par Editar/Probar.
- **Ningún producto tiene fotos todavía.** Hasta que un taller suba la primera,
  "Probar" cae al mockup con su aviso. El paso del alta es opcional a propósito:
  obligar a dieciséis fotos antes de enviar a revisión frenaría cualquier alta.

Descartado a propósito, y sigue descartado: servicios externos tipo Printful o
Placeit (mandarían el arte del cliente a un tercero y cobran por render) y
renderizar en el servidor (el navegador ya tiene el lienzo y los píxeles).

---

## El taller ya puede quitar productos (4 de septiembre)

`DELETE /proveedores/productos/:id`, y hace **dos cosas distintas** según dónde
esté el producto:

- **`borrador` se borra de verdad**, con su candado de slug. Nunca estuvo en el
  catálogo, así que no puede haber un pedido, un carrito, un favorito ni una
  plantilla apuntándole. Y **no se vuelve a `borrador`**: `actualizar` conserva
  el estado previo o manda a revisión, y el admin sólo pone `activo`,
  `rechazado` o `archivado`. O sea que "está en borrador" equivale a "nunca se
  publicó", y eso alcanza para decidir sin ir a buscar pedidos.
- **Todo lo demás se archiva.** Sale del catálogo (se reescribe `gsi2`, que es
  de donde el catálogo público saca su lista) y desaparece de la lista del
  taller, pero la fila se queda: "volver a pedir" lee el producto de HOY para
  poder decirle al comprador cuál de sus líneas se cayó, y sin la fila esa
  pantalla pierde el nombre.

**Las fotos no se borran de S3.** Las referencia el histórico de pedidos; un
objeto huérfano cuesta céntimos y una miniatura rota en un pedido de hace tres
meses no se deshace.

El candado del slug se suelta **después y por separado**, no en una transacción:
un candado que sobra sólo hace que el siguiente producto con ese nombre reintente
con sufijo, mientras que meterlos juntos dejaría al taller sin poder borrar su
borrador si el candado está raro.

La ruta `DELETE` **ya existía** en API Gateway (el script la crea en su bucle),
así que no hubo cambio de infraestructura.

Para recuperar un archivado no hay botón: se abre desde "Ver archivados" en la
lista y se manda otra vez a revisión con el botón que ya trae el asistente.

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
- **`infra/sitio.sh` borra `.next` y `out` antes de construir.** Compartir
  `.next` con el servidor de desarrollo rompe la compilación: ahí quedan los
  tipos que Next genera por ruta, incluidos los del admin que el script
  aparta, y falla con un `Cannot find name` señalando un archivo que ya no
  existe.

  **Se intentó con `distDir` y salió mucho peor.** Con un `distDir` propio,
  `output: export` escribe el HTML DENTRO de esa carpeta en vez de en `out/`,
  así que el script siguió subiendo un `out/` viejo: **dos publicaciones
  seguidas no publicaron nada**, y el sitio parecía actualizado porque
  respondía 200. Si tocas esto, **comprueba la fecha de
  `apps/web/out/index.html` después de construir** — o el número de archivos,
  que ahí cambió de 508 a 527.
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

## El carrito de varios talleres: decidido, sin construir

Cambia una regla que hoy está en el código: **la API rechaza un pedido que
mezcle talleres**. Eso deja de ser cierto — pero no porque un pedido pase a
tener varios talleres, sino porque aparece algo encima.

**Una COMPRA que se parte en un pedido por taller.** El cliente ve una compra;
por dentro nace un pedido por taller, cada uno con su bitácora, su envío, su
guía y su estado. Se eligió así porque el taller produce, cobra y envía lo
suyo: con un pedido multi-taller, el estado dejaría de ser del pedido y pasaría
a ser de cada línea, y la separación entre talleres —que hoy la impone la
llave— habría que imponerla en cada lectura y cada escritura.

Lo decidido, punto por punto:

| | |
|---|---|
| envío | uno por taller, **desglosado** en el checkout |
| entrega | se elige **por parte**: recoger con uno y envío con otro es válido |
| si un taller no puede | se marca esa parte y el cliente decide; la compra sigue |
| seguimiento | **una pantalla** con las partes dentro, un enlace, un correo al comprar |
| avisos siguientes | por parte, sólo cuando cambia algo que le importe |
| pago (cuando llegue) | **un cargo**; Kustto liquida a cada taller, como ya hace con `saldoEnvios` |
| cancelar | el taller cancela **su parte** y sólo en `nuevo`; devuelve sus existencias |
| carrito | en el navegador sin cuenta, en la tabla con sesión, y al entrar se funden |
| el arte | **se sube a S3 al agregar al carrito**; el carrito guarda rutas |
| lo que nadie compra | se borra solo a los **30 días** por ciclo de vida de S3 |

### Lo que se deriva, y hay que respetar al construirlo

- **El folio es de la compra**, y cada parte es `#481902-1`, `#481902-2`. El
  cliente dice un número y el taller reconoce el suyo dentro.
- **Sin índice nuevo.** Los tres GSI ya están ocupados (taller, estado,
  correo). La compra guarda la lista de sus pedidos y cada pedido su
  `compraId`: leer una compra es un `GetItem` más un `BatchGet`, no un índice.
  En `/cuenta` se listan compras porque el `gsi3` (`BUYER#<correo>`) admite las
  dos cosas distinguidas por el prefijo del `sk`.
- **Todo se crea en UNA transacción**: la compra, sus pedidos, los candados de
  folio y los descuentos de existencias. Media compra escrita sería peor que
  ninguna. Ojo al límite de **100 ítems** por transacción: pone un tope
  práctico a cuántas líneas y talleres caben en una compra, y hay que
  rechazarlo con un mensaje claro en vez de fallar con un error de AWS.
- **Cotizar por taller multiplica las llamadas a Skydropx, que admite 2 por
  segundo.** Ya tumbó el checkout una vez con siete clics en "+1". Con tres
  talleres son tres cotizaciones: hay que espaciarlas, no lanzarlas en
  paralelo.
- **La ruta que firma subidas del carrito es pública y sin sesión**, como la
  de crear pedidos. Va con tipo y tamaño limitados y bajo su propio prefijo
  (`carritos/…`), que es el que caduca a los 30 días. **Al comprar, el arte se
  copia fuera de ese prefijo**: si se dejara donde está, la regla de limpieza
  borraría el arte de un pedido pagado.

### Paso 1: hecho (3 de septiembre)

`PURCHASE#` existe, la creación reparte por taller y todo se escribe en una
transacción. Verificado contra AWS: una compra de dos talleres nació con sus
partes `#696914-1` y `#696914-2`, cada taller vio **sólo la suya**, y el
comprador vio la compra entera con su enlace. Sin token, 401.

Lo que hay que saber para seguir:

- **El token es de la compra y cada pedido guarda la misma huella.** Así el
  enlace del correo abre la compra y también sirve para mirar una parte
  suelta, sin inventar un segundo token.
- **`seguimiento` acepta id de pedido o de compra**, y con UNA sola parte
  devuelve la parte con el folio de la compra al lado. Por eso el front actual
  siguió funcionando sin tocarlo: no tiene que saber que existen las compras
  hasta que de verdad haya varias.
- **El índice de la línea viaja con ella.** Al repartir por taller el orden
  cambia, y las subidas del arte se emparejan por ese índice: sin él, el arte
  de una línea acabaría en la ruta de otra.
- **Multi-taller con envío devuelve 400 a propósito**, explicando por qué.
  Cada taller manda desde su dirección y eso son varias cotizaciones — es el
  paso 4. Mejor decirlo que cobrar un envío que sólo cubre a uno.

### Paso 2: las subidas del carrito (3 de septiembre)

`POST /publico/carrito/subidas` firma las escrituras, y el arte vive en
`carritos/<itemId>/` hasta que alguien compra.

- **El destino lo decide el servidor.** El `itemId` se genera en la Lambda: del
  cuerpo no sale ni un trozo de la ruta. Probado con un `carritoId` de
  `../../medios/pedidos`: se limpia y no sale de su prefijo.
- **El tamaño se firma, y S3 lo comprueba.** Se declara cuántos bytes pesa y
  eso entra en la firma. Verificado: declarando 40 bytes y mandando 26, S3
  responde **403**. Sin esto, el "límite" sería una promesa que nadie aplica.
- **`carritos/` caduca a los 30 días**, y también sus versiones antiguas: el
  bucket tiene versionado, así que sin `NoncurrentVersionExpiration` borrar
  sólo deja una marca y se sigue pagando lo de abajo.
- **Al comprar, el arte se COPIA fuera de ese prefijo**, antes de escribir la
  compra. Si fallara, lo que queda son objetos que nadie referencia; al revés
  quedaría un pedido sin arte. Si el arte no aparece —lo normal es que el
  carrito haya caducado— se dice en voz alta y no se crea la compra; la
  colocación y el diseño editable, en cambio, no la bloquean.
- Una línea que viene del carrito **no recibe URL de subida**: ya está subida,
  y devolvérsela haría que el navegador la subiera dos veces.

Verificado de punta a punta contra AWS: subir al carrito, pedir con ese
`carritoId`, y comprobar que el arte quedó en `medios/pedidos/…` y se sirve por
el dominio.

### Paso 3: el carrito (3 de septiembre)

Se agrega desde el editor —botón junto a "Pedir este diseño"—, se ve en
`/carrito`, y vive en dos sitios: el navegador siempre, y la cuenta si hay
sesión.

- **El carrito guarda rutas, no archivos.** Al agregar, el arte se exporta y
  se sube a `carritos/…` (paso 2); lo que queda en el navegador son rutas,
  cantidades y una miniatura en JPEG. La que sale del editor mide 700 px y en
  base64 llena el cupo de `localStorage` con cuatro artículos. Esa miniatura
  mide **480 px desde el 3 de septiembre** — ver "La miniatura" más abajo.
- **Al entrar gana la UNIÓN**, no el más nuevo: quien agregó algo sin haber
  entrado no lo pierde por identificarse, y lo del teléfono tampoco. Se
  deduplica por `carritoId`, que es lo único de verdad único — dos artículos
  del mismo producto con diseños distintos son cosas distintas.
- **La cuenta puede fallar sin consecuencias.** Siempre se escribe primero en
  el navegador; guardar en la tabla es lo que permite verlo desde otro
  aparato, no el carrito.
- **La exportación del lienzo se extrajo** a `lib/designer/exportarParaPedido`
  porque ahora la usan dos caminos —pedir y agregar—, y es la parte más
  delicada del editor: quitar el mockup sin dejar rastro, respetar los DPI y
  escribirle la resolución al PNG. Duplicarla era tener dos versiones de eso.
- `GET/PATCH/DELETE /cuenta/carrito`, detrás del pool de compradores.
  **PATCH y no PUT**: la API Gateway declara una ruta por método y PUT no está
  entre los suyos; añadirlo obligaba a tocar infraestructura y CORS sin ganar
  nada.

**Lo que falta y no se puede comprobar por API:** agregar de verdad desde el
editor. Necesita un navegador con lienzo. Verificado sí: que la ruta del
carrito exige sesión (401 sin token) y que las pantallas cargan.

"Continuar" lleva a `/pedir/carrito`, el checkout multi-parte del paso 4.
Estuvo deshabilitado mientras esa pantalla no existía: llevar a un formulario
de un solo producto habría sido peor que decirlo.

### Paso 4: el backend del checkout multi-parte (3 de septiembre)

Ya se puede pedir a varios talleres a la vez, cada uno con su entrega.

- **`POST /publico/envios/cotizar-compra`** cotiza UNA por taller y las
  **espacia 600 ms**, porque Skydropx admite 2 por segundo y eso ya tumbó el
  checkout una vez. El espaciado se hace en la Lambda y no en el navegador: si
  dependiera del cliente, bastaría con abrir dos pestañas.
- **Un taller que no puede no tumba la compra.** Vuelve con su `error` y los
  demás con sus tarifas; el cliente decide si lo quita o lo recoge. Verificado
  con dos talleres: uno cotizó Paquetexpress y el otro avisó de que no tiene
  envíos configurados.
- **La entrega se elige por parte.** `partes: [{proveedorId, entrega, envio}]`.
  Si no viene —el checkout de un producto, que sigue vivo— vale la global.
  Probado: una compra con una parte por envío ($209.93) y otra para recoger.
- **La compra sólo guarda una `entrega` común si todas coinciden.** Con
  métodos distintos guarda `null`: poner la de una parte como si fuera la de
  todas es de esos datos que después se leen mal.

**Ojo con `armarPaquete`: dice "este taller no tiene envíos configurados" por
TRES motivos distintos** —sin dirección de recolección, sin medidas de caja, o
sin peso para la talla pedida—. Al cliente le da igual, pero para diagnosticar
confunde: en una prueba parecía que faltaba la dirección y lo que faltaba era
el peso de esa talla.

**Y el redondeo:** los totales se guardaban con coma flotante
(`809.9300000000001`). Se redondea a centavos AL SUMAR, no al pintar: si sólo
se arreglara en pantalla, el número guardado seguiría siendo el feo.

### Las pantallas del carrito, rediseñadas (3 de septiembre)

`/carrito` y la cabecera. Lo que cambió es de fondo, no de pintura, y todo
sale del sistema que ya había —Figtree y Poppins, `tinta`, `lima`, `hueso`,
radios de 10 px, campos de 1.5 px a `tinta/20`—. El fondo `gris` sobre
tarjetas `hueso` no es nuevo: es la misma envoltura que ya usaban los correos.

**La lista se AGRUPA POR TALLER, y ésa es la decisión.** La compra ya se parte
sola en un pedido por taller, y eso se avisaba en un párrafo gris encima de
todo que nadie leía. Agrupado, cada bloque numerado ES el paquete que va a
llegar: lo cuenta la estructura. Se agrupa por `proveedorId` y **no por el
nombre** — dos talleres pueden llamarse igual, y el que parte la compra es el
id.

**Las tallas son contadores, no `<input type="number">`.** En un carrito se
sube y baja de uno en uno, y meter el cursor en un campo para cambiar un 2 por
un 3 es trabajo de más. 44 px de alto en el teléfono, que es el mínimo táctil.

**El resumen va en `tinta`** porque es lo único de la pantalla que decide
algo, y en una página de tarjetas claras necesitaba ser el ancla. El `lima`
queda para el total y el botón, así el acento significa "esto es lo siguiente"
en vez de gastarse en decoración. Pegajoso al lado en pantalla ancha; **fijo
al borde inferior en el teléfono**, porque con la lista larga un botón al
final del scroll obliga a recorrer todo el carrito y esconde cuánto llevas.

Dos trampas de CSS que ya mordieron y están comentadas en el código:

- **`/carrito` era la ÚNICA ruta de la tienda sin `layout.tsx`**, así que se
  abría sin cabecera y sin pie, con el fondo cortado a media pantalla. Ahora
  tiene el suyo, y es una **columna flex con el centro creciendo**: sin
  `flex-grow` el gris no llega al pie cuando el carrito trae poco.
- La barra fija del teléfono se declara con **`max-lg:fixed`**, no con un
  `fixed` que después se deshaga con `lg:inset-auto`. Ése y `bottom-0` tocan
  la misma propiedad con la misma especificidad, así que cuál gana dependería
  del orden en que Tailwind emita las dos reglas.

### La miniatura del carrito: 480 px, y por qué (3 de septiembre)

Se veía sucia. Estaba en **240 px con JPEG 0.7**, un tamaño elegido cuando el
carrito la enseñaba a 96 px. La pantalla nueva la enseña a 132 px —el diseño
es lo que la persona reconoce— y en un aparato retina eso son 264 px reales:
**se estaba ampliando**. Ahora son 480 px a 0.82, con suavizado alto.

Medido pasando un mockup real del proyecto por la misma tubería, con el tope
de `MAXIMO_ARTICULOS` (30):

| | por artículo | carrito lleno |
|---|---|---|
| 240 px · 0.70 | 6.9 KB | 0.20 MB |
| 480 px · 0.82 | 22.5 KB | 0.66 MB |

`localStorage` da unos 5 MB, así que en el peor caso pasa del 4% al 13%.

**Las miniaturas VIEJAS no se arreglan solas.** Se generan al agregar, y la
original de 700 px ya no está en el navegador para rehacerlas: un artículo que
lleve tiempo en el carrito conserva su imagen de 240 px hasta que se quite y
se vuelva a agregar.

**480 está cerca del techo.** La colocación sale del editor a 700 px
(`ANCHO_VISTA_PREVIA`), así que subir mucho más no aporta. Si algún día hace
falta más nitidez, la salida NO es subir el número —el base64 crece con el
cuadrado del ancho— sino servir la colocación que **ya está en S3** bajo
`carritos/…`, que hoy no tiene comportamiento en CloudFront.

### La cabecera: dónde va el verde (3 de septiembre)

Quedó recargada al entrar el carrito, y ordenarla obligó a decidir qué merece
el acento. Ahora: izquierda = navegar el sitio, derecha = lo tuyo.

**El verde va en "Empieza a diseñar", NO en "Iniciar sesión".** Se probó
ponerlo en la cuenta, como en cualquier plantilla de SaaS, y es un error caro
aquí: **en Kustto se puede pedir sin cuenta** —la ruta pública no exige sesión
y el seguimiento viaja en el enlace del correo—, así que hacer de la sesión el
botón más fuerte de la página le diría a todo el mundo que hace falta
registrarse para comprar. Por lo mismo **no hay botón de "Registrarse"**:
registrarse queda a un clic dentro de la cuenta.

**"Soy proveedor" bajó al nav de la izquierda**, más apagado. Va dirigido a
otro público —talleres, no compradores— y junto al carrito competía con las
acciones de quien sí viene a comprar. Sigue en el menú de móvil.

**El carrito cierra la fila y está SIEMPRE**, apagado mientras esté vacío. Se
probó esconderlo en vacío para dejarle sitio al verde y se descartó: un
carrito que aparece y desaparece no se aprende, y al montarse empujaba el
resto de la cabecera porque el contador arranca en cero y se llena después.
El contador **no se pinta al pre-renderizar**: el sitio es estático detrás de
CloudFront y un número metido en el HTML se cachearía con el de una persona.

### El orden para construirlo

1. ~~El modelo y la creación~~ — **hecho**.
2. ~~Las subidas del carrito~~ — **el backend, hecho** (3 de septiembre).
   Falta el botón del editor, que va con el carrito del paso 3: sin carrito no
   hay dónde guardar lo que devuelve.
3. ~~El carrito en el front~~ — **hecho**, y rediseñado el 3 de septiembre.
4. ~~El checkout multi-parte~~ — **hecho**: el backend y la pantalla
   `/pedir/carrito`, que agrupa por taller y cotiza el envío de cada uno.
   `/pedir` sigue vivo para el checkout de un solo producto.
5. **Seguimiento y correos** de la compra. La PANTALLA ya está (3 de
   septiembre): `/pedido?id=<compra>&token=…` abre la compra y pinta una
   sección por taller. Faltan **los correos**: hoy los avisos salen por PEDIDO
   —o sea por parte—, así que una compra de dos talleres manda dos de cada
   cosa sin decir que son la misma compra.
6. **El panel del taller** casi no cambia: ya ve sólo lo suyo. Sólo enseñar de
   qué compra viene su parte.

---

## Plantillas: el paquete que se vuelve a pedir (3 de septiembre)

Una plantilla guarda **una combinación** —el kit de bienvenida: playera, tote
y termo, con estas cantidades— para volver a pedirla sin armarla de cero. No es
"repetir" con otro nombre: repetir clona un pedido tal cual, y una plantilla es
una receta que se ajusta entre una vez y otra, y que puede mezclar líneas de
pedidos DISTINTOS.

El backend ya existía. Lo que se hizo fue la pantalla, y por el camino salieron
tres cosas que estaban rotas de raíz.

### El editor tenía que saber para qué se diseña

Ponerle diseño a un producto de la plantilla abría `/design/<id>` a secas, y
ese editor **agrega al carrito**: la plantilla se quedaba a medias sin decirlo.
Ahora la URL lleva `?plantilla=<clave>` y el `DesignerContext` guarda ese
destino, así que **la barra de abajo cambia de botones** —"Agregar a la
plantilla", y desaparece "Pedir este diseño"— y la flecha de volver regresa a
la plantilla, no al catálogo. El editor es EL MISMO; lo único que cambia es la
salida y a qué prefijo de S3 sube el arte (`medios/plantillas/`, que no caduca,
en vez de `carritos/`, que se limpia a los 30 días).

### El arte volvía como fila NUEVA, y duplicaba el producto

`agregarAlBorrador` sólo sabía añadir. Al darle "Ponerle diseño" a un producto
que ya estaba en la lista, el arte volvía como una fila más: te quedaba el
hueco vacío **y** una copia con diseño. Por eso cada fila del borrador tiene
ahora una `clave` local que viaja en la URL, y `guardarEnBorrador` pega el
diseño encima de ESA fila **respetándole las tallas** que ya se ajustaron.

### No se podía pedir un kit

La fila nacía con una talla y sólo tenía `−` y `+`. "Cinco chicas y diez
medianas" —que es media razón de ser de una plantilla— no cabía. Se añadió
`+ Talla` (las que el producto tiene y no están puestas) y `−` en 1 quita esa
talla, si queda otra.

### Editar una guardada es la MISMA pantalla

`ArmarPlantilla` sirve para crear y para editar: sólo cambian de dónde salen
los productos al abrir y a qué llamada se manda al guardar. El borrador lleva
`plantillaId` para no mezclar dos cosas a medias, y **manda sobre lo guardado
sólo si es de esa misma plantilla** —es lo que quedó del paso por el editor y
tirarlo sería perder el diseño recién hecho—. La siembra corre **una vez por
plantilla**, no cada vez que cambia la referencia del objeto: la lista de
arriba puede volver a pedirse y volver a sembrar borraría lo editado.

`rutaDelBorrador()` decide a dónde vuelve el editor (`&nueva=1` o
`&editar=<id>`). Con la ruta equivocada el arte sube bien y aterriza en una
pantalla que no lo enseña, que se lee como si se hubiera perdido.

### El diseño costó cuatro vueltas, y la que quedó es la aburrida

Se probó: bloque de color con tres pasos numerados, barra oscura propia, y
**dos columnas con el catálogo fijo a la izquierda**. Las tres se descartaron
por lo mismo: la pantalla dejaba de parecerse al resto del panel. Con dos
columnas era peor —dos rejillas de tarjetas compitiendo, sin saber cuál estabas
construyendo—.

Lo que quedó es el patrón de `Ajustes`: párrafo de una línea arriba, dos
tarjetas blancas (`Qué lleva`, `Cómo se llama`), campos de 52 px y el botón
píldora al final con "Nada se guarda hasta que lo confirmes". El catálogo
vuelve a abrirse en un **cajón** (`components/ui/drawer`), con buscador y
categorías, y **se cierra al elegir**: ver la pieza caer en la lista es lo que
explica qué pasó.

**Si vas a tocar esta pantalla, no le pongas cabecera propia.** La vista se
adueña de la del panel con `useCabeceraDelPanel` (`components/Cuenta/pantalla`)
— mismo tipo de 55 px, misma flecha que el detalle de un pedido — y pone
"Nueva plantilla". Antes decía "Plantillas" encima de la pantalla de crear una,
que es un título mintiendo mientras ocupa media pantalla en un teléfono.

### La tarjeta de producto es un control, no un contenedor

`ElegirDelCatalogo` envolvía la tarjeta entera en un `<button>`, y la tarjeta
trae dentro un `<a>` a diseñar y el corazón de favoritos. Además de ser HTML
inválido —React lo gritaba en consola—, **el enlace de dentro ganaba el clic**:
elegir un producto te llevaba al editor en modo carrito en vez de agregarlo.
Ahora `TarjetaProducto` acepta `onElegir` y con él la ficha se dibuja como
`<button>`, sin enlace dentro; el corazón sólo aparece si le pasas `onFavorito`.

El catálogo entero (buscador, categorías, favoritos, rejilla) vive en
`components/Cuenta/ExplorarCatalogo` y lo usan la sección Catálogo del panel y
el cajón. Su rejilla es `auto-fill` y no `md:grid-cols-3`: mira el ancho que
hay, no el de la ventana.

---

## Tres fallos del carrito que salieron al usarlo (3 de septiembre)

### El total salía en $0 — `pricing.basePrice`, no `basePrice`

Cargar una plantilla al carrito metía los artículos bien y el total quedaba en
cero. **El precio del producto está en `Item.pricing.basePrice`**; el código de
plantillas leía `producto.basePrice`, que no existe. No falla ni avisa:
devuelve 0.

Había dos sitios mal, y el segundo era peor porque no se veía: en el camino de
"plantilla hecha desde un pedido", el `?? linea.unitario` de respaldo tapaba el
error y entregaba **el precio de hace meses** mientras el comentario prometía
el de hoy. Y a los dos les faltaba el recargo por lados: el checkout cobra
`basePrice + (lados − 1) × perSidePrice` (`aLinea` en services/admin).

Ahora hay **una sola función**, `precioDeHoy(producto, cuantosLados)`, exportada
desde `services/compradores/src/rutas/pedidos.ts`, que usan los tres caminos al
carrito —repetir, cargar una plantilla y la plantilla con arte propio—.
**Desplegada y verificada** bajando el zip de la Lambda, no el local.

### El checkout del carrito no precargaba nada

`/pedir` rellenaba nombre, correo, WhatsApp y dirección de quien tenía sesión;
`/pedir/carrito` no. Con los datos en la cuenta, llegar por el carrito obligaba
a teclear la dirección entera otra vez. Se sacó a `lib/pedido/precargar` y
ahora los dos checkouts llaman al mismo `usePrecargarPerfil`. De paso, el
**correo se bloquea con sesión** también en el del carrito: los pedidos se
buscan por correo (`gsi3`), y dejarlo editable mandaba la compra al historial
de otra persona.

### El enlace de seguimiento no abría después de pagar

`/pedido?id=…&token=…` respondía "no encontramos ese pedido en tu cuenta" justo
después de comprar desde el carrito. **El enlace lleva el id de la COMPRA**, y
la pantalla, al ver sesión abierta, iba a la ruta de la cuenta — que sólo sabe
de pedidos—. La ruta pública con token resuelve las dos cosas. Ahora **manda el
token cuando lo hay**, y la de la cuenta queda de respaldo para enlaces viejos.

Del mismo origen salió otro: la compra vive en la **misma partición gsi3** que
sus partes (`COMPRA#<fecha>#<id>` contra `<fecha>#<id>`), y `listar()` no
filtraba: la lista de pedidos de la cuenta enseñaba la compra como una fila más,
sin líneas. Ahora se filtra por `pk` (`ORDER#` contra `PURCHASE#`).

Y la pantalla de seguimiento ya sabe pintar una compra de **varios talleres**:
una sección por parte, cada una con su estado, su envío y su guía. Fundirlas
obligaría a inventar un estado común que no existe —¿qué es "enviado" cuando
una parte salió y la otra no?—. Con un solo taller la API sigue devolviendo la
parte sola, así que ese camino sólo se pisa cuando de verdad hay varias.

**Falta desplegar**: la Lambda de compradores lleva el filtro de `listar()`
(`bash infra/lambda-compradores.sh`) y el front, todo lo demás
(`bash infra/sitio.sh`).

---

## El panel del comprador, esta tanda (4 de septiembre)

**La portada sin pedidos dejó de ser un recuadro punteado.** Quien se registra
aterriza justo ahí, y lo que veía era el sitio contestando "no tienes nada" a
alguien que todavía no había podido tener nada. Ahora ocupa el sitio del pedido
en curso —tarjeta oscura, mismo radio, mismo hueco— para que la pantalla no se
reorganice con el primer pedido, y **la rejilla de productos es el atajo**: cada
ficha abre el editor de ese producto. Mandar sólo a `?s=catalogo` es pedirle a
quien acaba de entrar que empiece por buscar. Está en `Inicio.tsx`,
componente `Bienvenida`.

**El catálogo abre un cajón de detalle** (`FichaEnSheet.tsx`) en vez de ir
derecho al editor: mirar catálogo es comparar, y con una ruta aparte cada
comparación cuesta dos navegaciones y se pierden los filtros y el scroll. Abre
con lo que ya trae la lista y **completa después** lo único que falta —los
nombres de los lados imprimibles, el precio del lado extra—, porque una rueda
sobre el cajón entero cambiaría un cajón instantáneo por uno lento a cambio de
un dato secundario. Las fichas se recuerdan en memoria: el `next: { revalidate }`
de `publico()` **no existe en el navegador** y sin la caché comparar tres
productos yendo y viniendo son diez peticiones.

El cajón NO abre en el cajón de armar plantillas: ahí la tarjeta selecciona, y
meter un detalle de por medio convertiría cada producto de un kit en dos clics.

**Animaciones de entrada y salida en todo `/cuenta`** (`Cuenta/animaciones.tsx`).
Tres cosas que no hay que deshacer:

- **No es el ritmo de las landings.** `Animaciones/Entrada` dura 0.68 s; aquí se
  cambia de sección quince veces por sesión y a esa frecuencia lo mismo se
  siente como que la aplicación va lenta. Entrada 0.26 s, salida 0.14 s.
- **El escalonado se corta en el octavo.** Con `staggerChildren` el retraso
  crece sin fin: treinta pedidos a 35 ms son más de un segundo hasta el último.
- **`<MotionConfig reducedMotion="user">` está en la raíz del panel**, una sola
  vez. Comprobarlo pieza por pieza sería asegurarse de que alguna se queda sin
  ello.

Las filas de la tabla de pedidos se animan con `motion.tr` y no con un
envoltorio: entre `<tbody>` y `<tr>` no cabe un `<div>` —el navegador lo saca de
la tabla y la fila se desmonta.

---

## El backoffice tiene dominio y puerta propios (4 de septiembre)

El admin ya no es "eso que sólo corre en local". Vive en
**https://backoffice.kustto.com.mx**, con su bucket, su distribución y su
propio pool de Cognito.

### Lo que había, y por qué bloqueaba todo

El admin del navegador llamaba a `/api/admin/*`, un route handler de Next que
agregaba `x-clave-admin` del lado del servidor. En la API Gateway las rutas de
admin eran el `$default` **sin autorizador**: la única puerta era esa llave. El
propio archivo lo decía —"⚠️ MIENTRAS NO HAYA LOGIN, ESTE PROXY ES UNA PUERTA
ABIERTA"— y por eso `sitio.sh` apartaba el admin del build.

Publicarlo tal cual habría dejado la llave en el bundle: una página estática no
puede guardar un secreto.

### Cómo quedó

**Un TERCER pool**, `kustto-admins` (`infra/cognito-admin.sh`). El autorizador
JWT valida emisor y audiencia, no grupos: con un pool compartido, el token de
cualquier comprador registrado pasaría el autorizador de `/admin/*`. Con uno
por público es imposible por construcción, que es el mismo argumento por el que
compradores y talleres ya no lo comparten.

Sin autoregistro: las cuentas se crean con `bash infra/crear-admin.sh correo`,
que deja que Cognito genere y mande la contraseña temporal — una elegida por
nosotros acabaría en el historial del terminal.

**Las rutas de admin se movieron a `/admin/{proxy+}`** con ese autorizador,
como `/cuenta/*` y `/proveedores/*`. Un método por ruta y nunca `ANY`, por lo
del preflight. El prefijo lo quita el handler en un solo sitio, así que el
router sigue registrando `/templates`, `/productos`…

**La llave murió.** La Lambda ya no la acepta y se borraron
`app/api/admin/[...ruta]/route.ts` y `lib/api/admin.servidor.ts`. Lo que no
cuelgue de `/admin/` y no esté en `ABIERTAS` contesta **404** — ni 401 ni 403:
distinguirlos le diría a quien prueba rutas cuáles existen.

Comprobado contra la API desplegada, no en local:

| | |
|---|---|
| `/admin/*` sin token | 401 |
| `/admin/*` con token basura | 401 |
| `/templates` (ruta vieja) | 404 |
| `/templates` **con la llave vieja** | 404 |
| `/publico/catalogo` | 200 |
| preflight de `/admin/*` | 204 |

### El subdominio no es estética

Una ruta de `kustto.com.mx` compartiría origen con la tienda, y con él
`localStorage`, las cookies y el alcance de un XSS: un fallo en el editor o en
una dependencia alcanzaría los tokens del backoffice. En otro subdominio son
dos almacenes distintos y lo garantiza el navegador. Y separa el despliegue:
publicar la tienda no puede publicar el panel por accidente.

`infra/backoffice.sh` crea todo —incluido el **certificado**, que hubo que
pedir aparte: el del sitio cubre `kustto.com.mx` y `www`, y un certificado de
ACM es inmutable—. Comparte con `frontend.sh` el OAC y la función de URLs
bonitas: son mecanismos, no permisos.

`infra/sitio-backoffice.sh` publica. Es el gemelo de `sitio.sh` con la
selección al revés: sube `out/admin/**` y `out/_next/**`, y nada de la tienda.

### Tres cosas que costaron

**`app/admin/paquetes/[id]` no se podía exportar.** Una ruta dinámica exige
conocer sus URLs en el build. Pasó a `?id=`, como el seguimiento de pedidos.

**`app/admin/categorias/page.tsx` era un componente async de servidor.** Sin
servidor y sin llave, no había forma de que siguiera siéndolo: ahora pide desde
el navegador con el token.

**El login se compartió, no se copió.** `lib/auth/pool.ts` es una fábrica
—entrar, resolver el reto de contraseña temporal, renovar— y `cognito.ts`
(talleres) y `admin.ts` (backoffice) sólo le pasan su id de cliente y su llave
de `localStorage`. Cada pool con la suya: compartirla haría que entrar al
backoffice cerrara la sesión del taller en la misma máquina.

### Lo que se rompió al publicarlo, y cómo (4 de septiembre)

Nada de esto se vio al desplegar. Salió al usar el panel.

**CORS: subir un mockup moría en el preflight.** El navegador sube DIRECTO a
S3 con una URL prefirmada —el archivo nunca pasa por la API— y la lista de
`AllowedOrigins` del bucket no tenía el backoffice. Está en `infra/cors.sh` y
ahora incluye los cuatro orígenes. El error señalaba a S3, que es donde no
está la causa: el preflight de un PUT prefirmado es una petición que nadie
escribe en el código de la app y no aparece buscando.

**La política del bucket de contenido dejó fuera al sitio público, y eso fue
culpa del despliegue del backoffice.** `frontend-politica.py` guardaba UN
`AWS:SourceArn` y borraba la sentencia por `Sid` antes de escribir la suya: al
correr `backoffice.sh`, `kustto-publico-prod` pasó a confiar sólo en la
distribución nueva. Las imágenes de la tienda siguieron viéndose un rato por
la caché de CloudFront. Ahora la condición lleva una LISTA que se une, así que
las dos distribuciones conviven; comprobado: el bucket de contenido tiene dos
y cada sitio el suyo.

**`frontend.sh` no podía ACTUALIZAR la distribución, sólo crearla.** Se
descubrió al intentar reparar lo anterior. `create-distribution` acepta que
falten campos y les pone el valor por defecto; `update-distribution` los exige
y responde `IllegalUpdate: <campo> is missing for the resource` — **uno cada
vez**, así que hay que descubrirlos de a uno. Eran cinco: `Logging`,
`OriginGroups`, `Restrictions`, `WebACLId`, `ContinuousDeploymentPolicyId` y
`Staging`. Ya están en `frontend-config.py` y los dos scripts corren de nuevo
sin tocar nada.

**Faltaban `icon.svg` y `apple-icon.png` en el bucket del backoffice.** Next
los inyecta en el `<head>` de TODAS las páginas con ruta absoluta a la raíz, y
`sitio-backoffice.sh` sólo subía `out/admin` y `out/_next`. Cada pantalla del
panel pedía `/icon.svg` y recibía 403. Se suben esos tres archivos —con
`404.html`, que es a donde CloudFront manda los errores— enumerados uno por
uno: sincronizar la raíz entera publicaría las imágenes de la tienda en el
otro dominio.

**Sigue fallando, y no es del backoffice:** alguna pantalla del admin llama a
`/products` de la API de Nest y recibe 503. Es la sección de paquetes, que
nunca migró.

### Lo que hay que saber para tocarlo

- **El guardia del front NO es la seguridad.** `app/admin/Guardia.tsx` sólo
  evita enseñar un panel vacío. Lo que cierra el backoffice es el autorizador
  de la API: sin token no hay un solo dato, se pinte lo que se pinte.
- **`services/admin/.clave-admin` ya no sirve para nada.** Bórralo.
- **La sección de paquetes sigue hablándole a la API de Nest**, que no se
  despliega. Se publica porque compila, pero no carga nada: en la consola se
  ve como `ApiError: API 503 en /products`.
- Sesión corta a propósito: 1 hora de acceso y **1 día** de refresco, contra
  los 30 días de un comprador.

---

## El catálogo va en vivo y las páginas horneadas: se rompe solo (4 de septiembre)

Un taller dio de alta una gorra, salió en el catálogo, y al pulsarla
`/design/<id>` contestó **404**. Al mirarlo, **los dos productos publicados
daban 404**: el sitio se había construido cuando el catálogo tenía otros tres.

**No es que el producto falte, es que se ve y se rompe.** El catálogo se pide
en vivo a la API —así que lo nuevo aparece al instante— pero `/design/<id>` y
`/product/<id>` se pre-generan en el build con `generateStaticParams`
(`lib/build/parametros.ts`). Entre una publicación y la siguiente, todo lo que
el taller dé de alta es una tarjeta que lleva a ninguna parte.

Se arregló republicando (`bash infra/sitio.sh`), y **eso hay que hacerlo cada
vez que se aprueba un producto**. Mientras no se arregle de raíz, aprobar un
producto sin republicar deja la tienda enseñando algo que no se puede abrir.

**La salida buena no es acordarse.** `/design/<id>` no lo indexa nadie —es una
aplicación, no contenido— así que no tiene por qué pre-generarse: puede
resolverlo el navegador leyendo el id de la ruta, con la función de CloudFront
mandando `/design/*` a una sola página. Horneado se queda `/product/<id>`, que
sí es lo que ve Google. Con eso, aprobar un producto lo vuelve utilizable al
instante y sólo su ficha pública espera al siguiente despliegue.

---

## La prenda real llega al taller, y el cliente tiene biblioteca (4 de septiembre)

### El pedido ya lleva la foto de la prenda

Era lo que quedaba pendiente de "La prenda real": el pedido guardaba la
composición sobre el MOCKUP y nada más. Ahora, por cada lado, salen **tres**
archivos en vez de dos:

| | qué es | para qué |
|---|---|---|
| `arte` | recortado al área, transparente, a los DPI | va a máquina |
| `colocacion` | la prenda dibujada con el diseño encima | comprobar **dónde** va |
| `prenda` | la FOTO REAL con el diseño proyectado | ver **qué esperaba** quien pidió |

**Va ADEMÁS de `colocacion`, no en su lugar.** El mockup es un dibujo de línea
y sirve para cuadrar la posición con geometría limpia; la foto real tiene
pliegues y caída, y sirve para otra pregunta. Sustituir una por otra habría
perdido la que usa el taller para producir.

Se compone en el navegador con `componerPrenda`, el mismo rasterizador que ya
usaba la descarga — el `ESTADO` anterior decía que era "enchufarlo donde hoy
corre `exportarColocacion`", y fue eso.

**Es OPCIONAL en toda la cadena, y tiene que seguir siéndolo.** Hay una foto
por lado Y por color, el paso del alta es opcional y hoy casi ningún producto
las tiene. Así que:

- `sobreLaPrendaReal` devuelve nulo sin drama si no hay foto, y también si
  componer falla: recorre píxeles y puede quedarse sin memoria.
- La copia del carrito al pedido va con `false` (no obligatoria). Un pedido ya
  cobrado no se puede caer porque falte una imagen de referencia.
- La **ruta se escribe siempre** en la línea; el archivo puede no existir.
  Comprobarlo en el servidor costaría una llamada a S3 por lado y por pedido,
  así que lo resuelve la ficha del taller: si la imagen no carga, la casilla no
  se enseña. Por eso la tarjeta pasa de dos columnas a tres sola.

Toca los tres servicios: los topes de `firmarSubidas` (de 14 a 20 archivos por
subida — son tres por lado), la copia al comprar, `aLinea`, el firmado del
camino de `/pedir`, y repetir un pedido y cargar una plantilla, que también se
la llevan.

### La biblioteca de imágenes del comprador

Quien pide para su empresa sube el MISMO logo cada vez, y el editor lo olvidaba
al cerrarse. Ahora lo que se sube queda en `medios/imagenes/<sub>/` —que **no
caduca**, al revés que `carritos/`— y la próxima vez está a un clic.

- **Pide sesión, y no es una limitación que superar**: sin cuenta no hay dónde
  colgar la biblioteca. Quien diseña sin entrar sube archivos como siempre; lo
  único que no tiene es memoria, y el panel lo dice invitando a entrar.
- **Guardar no puede romper diseñar.** La imagen entra al lienzo ANTES de
  intentar subirla: si la biblioteca falla, lo que la persona vino a hacer ya
  está hecho.
- **La URL es relativa (`/medios/…`), nunca la de S3.** El editor mete la
  imagen en un lienzo y luego lo exporta: otra procedencia lo contamina y
  `toDataURL` lanza `SecurityError`, o sea que el pedido se queda sin archivo
  de producción. Por lo mismo el `<img>` va con `crossOrigin="anonymous"`.
- **SVG no se acepta.** No es cosa del lienzo: un SVG puede traer `<script>` y
  esto se sirve desde NUESTRO origen, donde vive la sesión de todo el mundo.
- **Borrar borra también el objeto de S3**, y es el único prefijo donde la
  Lambda de compradores puede borrar. Son archivos personales que alguien pidió
  quitar; dejarlos ahí después de decir "borrada" sería mentir. No toca ningún
  pedido: lo que va a máquina se copió a `medios/pedidos/` al comprar.
- Tope: 15 MB por imagen, 60 por cuenta.

El panel es **el mismo en escritorio y en móvil** (`BibliotecaDeImagenes`).
De paso se cayeron los botones de **Dropbox y Google Drive** del panel de
escritorio: no tenían `onClick` desde siempre.

**Desplegado**: las dos Lambdas y el sitio.

---

## La página de "no existe" ya explica qué pasó (4 de septiembre)

Un diseño guardado de un producto que el taller quitó llevaba a `/design/<id>`
y salía el 404 de Next: **"This page could not be found"**, en inglés y sin
decir nada. A quien llega ahí desde SU diseño eso no le explica por qué.

`app/not-found.tsx` mira la ruta y cambia el texto: en `/design/*` o
`/product/*` dice **"Este producto ya no está disponible"**, con el matiz que
importa —la copia guardada sigue ahí, lo que ya no se puede es pedirla— y una
salida a Mis diseños además del catálogo.

**NO distingue por qué falta, a propósito.** Llegar ahí tiene dos causas que
desde el navegador se ven igual: el taller quitó el producto, o el producto es
más nuevo que el sitio (las páginas se hornean y el catálogo va en vivo — ver
la sección de arriba). Sin preguntarle a la API no hay forma de saber cuál, y
la respuesta es la misma. Prometer un diagnóstico que no se tiene es peor.

**El editor también podía quedarse colgado.** Si la página SÍ se horneó pero el
producto ya no está en la API, `loadProductTemplate` rechazaba y no lo cogía
nadie: la rueda giraba para siempre. Ahora se llama a `notFound()` — y no un
`router.replace`, porque la página de error mira la ruta para decidir el texto
y navegar a otro sitio le quitaría justo ese dato.

**Lo que se acepta:** la página se pre-renderiza sin URL, así que el HTML sale
con el texto genérico y el específico aparece al hidratar. Un parpadeo de un
fotograma, y el texto genérico nunca es falso.

---

## Tazas y termos: el motor está, la cadena no (4 de septiembre)

### Por qué no valía lo que ya había

`componerPrenda` invierte una **homografía**: cuatro esquinas definen un
**plano**, y sobre una playera eso es correcto. Una taza es un **cilindro**.
Con la homografía el arte queda como calcomanía pegada plana — las letras de
los extremos no se comprimen y el diseño no se curva hacia el borde. Falla
justo donde se mira.

Y CSS tampoco: `matrix3d` es proyectiva, o sea planos. **El preview en vivo de
un cilindro no puede ser CSS**, tiene que ser un lienzo que se repinta. Ésa es
la diferencia de fondo con la prenda, no la matemática.

### El rasterizador, que ya está (`lib/prenda/cilindro.ts`)

De frente un cilindro enseña **180° de sus 360°**, comprimidos hacia los
bordes. Para un píxel a la fracción horizontal `u` del cuerpo visible:

```
θ  = asin(2u − 1)          el ángulo sobre el cilindro, de −90° a +90°
sx = centro + θ / 2π       la columna del arte, en fracción de 0 a 1
```

`asin` es lo que produce la compresión. **Comprobado numéricamente**: el span
visible da exactamente 0.5 —medio wrap— y el 10% de foto del borde cubre
0.1024 del arte contra 0.0319 en el centro, o sea **3.2× más comprimido**.

Dos detalles que no son adorno:

- **En horizontal el muestreo ENVUELVE, en vertical recorta.** El arte da la
  vuelta: su borde derecho continúa en el izquierdo. Arriba y abajo se acaba la
  taza.
- **`bombeo`**: el filo de una taza fotografiada de frente es una elipse, no
  una recta, y la banda impresa la sigue. Se aplica con `cos θ`, que vale 1 en
  el centro y 0 en los bordes.

`sideKey` acepta ya `"wrap"`. **Un producto con envoltura no tiene ningún otro
lado**: no es un lado más.

### El sangrado, de punta a punta (4 de septiembre)

Lo que bloqueaba vender una taza. El papel de sublimación se mueve al prensar,
así que el arte tiene que seguir habiendo **más allá** del área imprimible; sin
eso queda una línea blanca en el filo, y en una taza el estampado llega al
borde siempre.

**Dónde estaba la trampa.** No era ampliar el recorte al exportar:
`makeAreaClip` recortaba los objetos **al área exacta**, así que fuera de ella
no existía ni un píxel y ampliar el recorte sólo habría añadido vacío. El
sangrado sirve porque el cliente PUEDE pintar en él.

La cadena, y por qué cada eslabón está donde está:

| dónde | qué hace |
|---|---|
| `printSides.sangradoCm` | lo declara el taller, en el alta, junto al ancho y los DPI |
| `loadProductTemplate` | lo pasa a **píxeles** y se lo pega a cada área |
| `makeAreaClip` | recorta al área **+ sangrado**, así que se puede pintar ahí |
| `exportarArteDeLado` | recorta al área + sangrado, con el multiplicador del ÁREA |
| ficha del taller | lo **resta** antes de comparar, y lo dice en pantalla |

**El multiplicador sale del área, no del recorte.** Es lo que mantiene la
escala: el estampado tiene que medir los centímetros declarados; lo que crece
es el archivo, no lo impreso.

**La ficha lo resta o el aviso miente.** Sin eso, "revisa el área de la
plantilla" saltaría en cada pedido con sangrado, y un aviso que salta siempre
se aprende a ignorar. Además lo enseña: quien abre el PNG y lo mide se
encuentra milímetros de más, y sin decirlo parece un error.

**Comprobado numéricamente** con una taza real (20 × 8.5 cm, 3 mm, 300 dpi):

```
archivo   2433 × 1075 px  =  20.6 × 9.1 cm   ← desborda, correcto
la ficha                     20.0 × 8.5 cm   ← lo declarado, sin aviso falso
```

**Con tope de 2 cm**, y no por gusto: ese número dimensiona el ARCHIVO. Un 100
mal tecleado no da un aviso, da un PNG de cientos de megas que revienta el tope
de subida **después** de que el cliente pagó.

**Cero es una respuesta legítima y es la común.** Un estampado que no llega al
borde no lleva sangrado, y ponerlo por defecto haría desbordar arte que luego
se recorta contra la prenda.

### La forma se declara en la PLANTILLA (4 de septiembre)

`data.forma: "plano" | "cilindro" | "cono"`, elegida en el paso de **Identidad**
del asistente de mockups — antes que los lados y antes que el área.

**POR QUÉ EN LA PLANTILLA Y NO EN EL PRODUCTO.** Ser un cilindro es una
propiedad del OBJETO. Si viviera en el producto, dos talleres que usan la misma
plantilla de taza podrían discrepar sobre si es un cilindro, y eso no significa
nada.

**POR QUÉ EN IDENTIDAD Y NO MÁS ADELANTE.** Decide qué pregunta el paso
siguiente: un cilindro tiene UN lado —la envoltura de 360°— así que elegirlo
**salta el paso de Lados** en vez de pedir que alguien escriba "wrap" a mano y
se acuerde de borrar "front". Elegir la forma repone los lados sola.

El salto va en las DOS navegaciones. Sólo hacia adelante dejaría una pantalla a
la que se llega retrocediendo. Y el número de pasos no cambia: recalcular los
índices habría obligado a tocar `sideIndex`, `isReview` y las dos
navegaciones, que es donde se cuela un paso inalcanzable.

**El servidor lo comprueba, no sólo el asistente.** Una plantilla no plana con
más de un lado se rechaza: el asistente es una pantalla y esto es el modelo.
Ausente = `plano`, que es lo que eran todas las plantillas de antes; no hay que
migrar nada.

**`cono` se puede guardar y todavía NO se dibuja.** Un vaso que se estrecha no
se despliega en un rectángulo sino en un **sector de corona circular**; meterle
un rectángulo saca el estampado torcido y las horizontales dejan de serlo. Está
en el enum desde el primer día porque añadirlo después es migrar todas las
plantillas, y la tarjeta del asistente lo dice en voz alta.

**Lo que la forma decide HOY**: el modo "Probar" **no proyecta** sobre la foto
real si el producto no es plano. La proyección de ahí es una homografía —cuatro
esquinas son un plano— y sobre una taza saldría como calcomanía pegada. Cae al
mockup con su aviso, igual que un producto sin fotos. Enseñar un preview
mentiroso en la pantalla que existe para no mentir habría sido peor que no
tenerla.

Las guías del wrap —costura, zona del asa— **vienen dibujadas en el propio
mockup** y no hacen falta como datos todavía. Volverlas datos vale la pena sólo
cuando se quiera AVISAR ("esto queda detrás del asa"), no para dibujarlas.

### El preview cilíndrico, enchufado (4 de septiembre)

Los tres pasos que faltaban. Una taza con foto ya se ve como una taza.

**La foto lleva UNA geometría, no dos.** `fotosReales` gana `banda` y
`esquinas` pasa a opcional: cuatro esquinas si el producto es plano, una banda
si es un cilindro. El servidor rechaza que vengan las dos —"es una cosa o la
otra"— y que no venga ninguna.

**QUIÉN DECIDE QUÉ RASTERIZADOR: LA FOTO, NO LA PLANTILLA.** Está escrito igual
en los tres sitios que componen —la vista, la descarga y `exportarParaPedido`—
y es a propósito: la foto trae la geometría con la que se marcó, así que una
foto de banda sólo se puede componer como cilindro **aunque alguien cambie la
forma de la plantilla después**. `forma` decide qué se PIDE en el alta; la foto
decide qué se PINTA. Por eso `VistaDeLaPrenda` ya no recibe `forma`.

**El paso del alta es el mismo, con otro marcador.** `PasoPrenda` recibe la
forma y enseña `MarcarCuadro` o `MarcarBanda`: la pregunta es la misma —dónde
cae lo impreso— y lo que cambia es la respuesta. La banda son cuatro bordes
arrastrables y dos deslizadores (curvatura del filo, qué parte mira al frente).

**Las guías verticales del marcador no son adorno.** Se dibujan en las
posiciones que ocupan columnas repartidas por igual en la ENVOLTURA —la inversa
de `θ = asin(2u − 1)`— así que se ven apretarse hacia los bordes. Es la única
forma de comprobar de un vistazo que la banda cubre el cuerpo: si las guías del
borde caen sobre el fondo, sobra banda.

**"Probar" rasteriza UNA VEZ, y con eso basta.** Aquí se cae lo que llamé "lo
caro": el preview en vivo sobre lienzo **no hace falta**. `matrix3d` no puede
con un cilindro, pero "Probar" es una vista aparte y no el lienzo de edición —
nadie arrastra nada mientras la mira. Se compone al entrar y se enseña el PNG.
Repintar por fotograma sólo haría falta para ver la taza girar, que no es lo
que esa pantalla contesta.

Dentro: se rehace sólo al cambiar arte, color o foto; mientras compone se
enseña la foto sola —parpadear a blanco para volver con lo mismo se lee como un
fallo—; y se descarta el resultado si el efecto ya se volvió a disparar, porque
una composición lenta puede llegar después de una rápida y pintar el color
anterior.

**Lo que queda**: nadie ha subido todavía una foto de taza, así que esto no se
ha visto funcionando de punta a punta. Y `cono` sigue guardándose sin dibujarse.

### Lo que FALTA, y en qué orden

1. ~~El sangrado~~ · ~~el paso del alta~~ · ~~enchufar el rasterizador~~ —
   **hechos** el 4 de septiembre.
2. **Que un taller suba la primera foto de taza.** Sin ella no hay banda que
   marcar ni preview que enseñar. Es el mismo punto 0 que ya estaba para las
   playeras.
3. **El cono.** Se guarda y no se dibuja: un vaso que se estrecha se despliega
   en un sector de corona circular, no en un rectángulo. Necesita otro
   rasterizador y un dato más en la banda.

### Decidido, para no volver a discutirlo

**El asa va FIJA y la declara el taller**, no la elige el cliente. Elegirla
obligaría a rotar el arte respecto de la costura, que es otra cosa. Se puede
añadir después sin deshacer nada: `centro` de `BandaCilindrica` es justo el
grado de libertad que haría falta.

---

## Lo que sigue, en orden

0. **Que un taller suba las primeras fotos de prenda real.** Todo el camino
   está construido y desplegado, pero sin una sola foto en la tabla "Probar"
   sigue cayendo al mockup y nadie ha visto la proyección con una foto de
   verdad. Es lo más barato de la lista y lo que valida el trabajo más grande
   de la tanda anterior. Ver "La prenda real".
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
6. ~~**Login de admin.**~~ — **hecho** (4 de septiembre): pool propio, rutas
   `/admin/*` detrás de un autorizador JWT y el panel publicado en
   `backoffice.kustto.com.mx`. La llave compartida ya no existe.

---

## Cosas que hay que limpiar

- **CORS acepta los puertos 3000, 3001 y 3002 de desarrollo**, no sólo el
  3000. Next salta al siguiente cuando el anterior está ocupado —y lo está en
  cuanto queda un `pnpm dev` colgado o se levantan dos a la vez—, así que el
  navegador pasa a pedir desde otro puerto y la API contesta un preflight sin
  cabeceras. El error que sale es **"Failed to fetch"**, que no menciona ni el
  puerto ni CORS. Si algún día hace falta un cuarto, está en `infra/cors.sh` y
  `infra/lambda-admin.sh`; correr los dos scripts basta.

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
  Mientras siga así, cualquier diff real queda enterrado. Y por lo mismo: **no
  corras `pnpm format` sobre todo el repo** — ya reformateó 393 archivos de una
  vez y revertirlo fue peor que el problema. Formatea sólo lo que tocaste.
- **El trabajo del panel del comprador está SIN COMMITEAR**, mezclado con esa
  churn. Lo nuevo son `components/Cuenta/{Sidebar,datos,Repetir,DetallePedido,
  NombrarDiseno}.tsx`, `components/Pedido/Detalle.tsx`,
  `services/compradores/src/lib/medios.ts` y
  `services/compradores/src/rutas/disenos.ts`.
- **La Lambda de compradores ya está desplegada con todo esto** (24.1 kb), y su
  rol tiene el `PutObject` en `carritos/*`. El **front NO está publicado**: el
  panel nuevo sólo existe en local.
- **Los datos de la prueba de repetir se borraron** —la carpeta de `carritos/`,
  los dos archivos de `medios/disenos/prueba-repetir/` y su ítem en DynamoDB—,
  así que si ves un diseño de un `sub` llamado `prueba-repetir`, es nuevo.

---

## Si vienes de otra máquina

1. Clona y sigue "Puesta en marcha en una máquina nueva" del `README.md`.
2. Los secretos (`infra/.cognito`, `infra/.cognito-compradores`,
   `infra/.cognito-admin`, `infra/.websocket`, el `.env` del front) **se
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
