# Dónde nos quedamos

_Última actualización: 2 de septiembre de 2026._

Este archivo es el traspaso entre sesiones: lo que **no** se deduce leyendo el
código. Para el mapa del proyecto ve a `README.md`; para el AWS, a
`infra/README.md`. Si algo de aquí ya se hizo, bórralo — este documento sólo
sirve si se mantiene corto y cierto.

**Lo último que se hizo, por si sólo lees esto:** los envíos con Skydropx
(cotizar en el checkout y comprar la guía con el peso real), el inventario
obligatorio con ajustes por diálogo, el buzón de `@kustto.com.mx`, y el
arreglo de la delegación del dominio que tenía bloqueados el certificado y el
correo. Todo verificado contra AWS, nada en local.

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
8  Taller confirma peso real     ✅  API sí, pantalla NO
9  Comprar la guía               ✅  POST /proveedores/pedidos/:id/guia
10 Descargar la etiqueta         ⚠️  API sí, pantalla NO
11 Entrega a la paquetería       —   fuera del sistema
12 Tracking                      ⬜  falta el webhook
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
4. **El envío usa `packages`, la cotización usa `parcel`.** Mandando `parcels`
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

### Lo que falta de envíos

- **Las dos pantallas del taller**: el formulario de peso y medidas, y el botón
  de descargar la etiqueta. El backend está y probado; la interfaz no existe.
- **El webhook de tracking** (paso 12), que necesita una ruta pública con
  verificación de firma.
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

## El despliegue del front: a medias, y dónde exactamente

Se eligió **S3 + CloudFront con export estático** y **URLs bonitas**: cada
producto es HTML pre-renderizado e indexable. El precio de esa decisión, que
hay que tener presente: **un producto aprobado no aparece en el sitio hasta que
se vuelve a construir y subir.** Se automatizará cuando duela.

### Lo que ya está hecho

- **El proyecto vuelve a compilar.** No lo hacía: los restos del dominio de
  paquetes importaban funciones que no existían. Se borraron
  (`apps/api/src/package-{designs,orders}`, el esquema, `app/package/*/disenar`
  y `/resumen`, `app/proveedor/paquetes`, `ProviderProductForm`, `packageMode`)
  y se arreglaron los 17 errores de tipos que arrastraba el admin.
  **`pnpm type-check` está en cero y `pnpm build` pasa.**
- **Las rutas que nunca se pueden pre-renderizar pasaron a query**, porque su
  contenido se crea después de desplegar:
  - `/pedido/[id]` → **`/pedido?id=…&token=…`** (`enlaceDeSeguimiento` ya lo
    genera así).
  - `/proveedor/productos/[id]/editar` → **`/proveedor/productos/editar?id=…`**.
  - Las dos van envueltas en `<Suspense>`: sin él, `useSearchParams` revienta
    el pre-renderizado.
- **Las públicas conservan su URL** con `generateStaticParams`
  (`lib/build/parametros.ts`): `/product/[id]`, `/design/[productId]` y
  `/catalogo/productos/[id]` —cuyo `[id]` es una CATEGORÍA, no un producto—.
- `/proveedores/[slug]` y `/package/[id]` generan **cero URLs a propósito**:
  leen de Nest, que no se despliega, y no hay endpoint público que liste
  talleres. Están partidas en `page.tsx` + `Vista.tsx` porque una página
  `"use client"` no puede exportar `generateStaticParams`.
- **Certificado ACM pedido** para `kustto.com.mx` y `www`, con sus dos CNAME de
  validación ya puestos en Route53. Estaba en `PENDING_VALIDATION`.

### Lo que falta

1. **Sacar el admin del despliegue.** Es lo ÚNICO que queda bloqueando
   `output: "export"`: quedan tres rutas dinámicas y las tres son suyas
   (`/admin/categorias`, `/admin/paquetes/[id]`, `/api/admin/[...ruta]`). El
   proxy con la llave no puede ni debe salir a internet.
2. **`next.config.ts`**: `output: "export"`, `images.unoptimized: true`, y
   quitar los `rewrites()` —que no existen en un export— pasándolos a
   comportamientos de CloudFront para `/mockups/*` y `/medios/*`.
3. **`infra/frontend.sh`** (idempotente, como los demás): bucket privado,
   distribución de CloudFront con OAC, los tres comportamientos, y los ALIAS de
   Route53 para el apex y `www`.
4. **Comprobar que el certificado se emitió** y engancharlo a la distribución.
   No se va a emitir hasta que se arregle la delegación — ver abajo.

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

### Route53: los DKIM que hay son de SES, y están muertos

Corregido el 2 de septiembre tras comprobarlo contra AWS. El diagnóstico
anterior decía que los tres CNAME de `_domainkey` eran "de un correo en uso, no
de SES". **Sí son de SES**: apuntan a `*.dkim.amazonses.com`. Lo que pasa es
que son tokens **viejos**, de una identidad que se borró y se volvió a crear —
recrearla regenera los tokens.

- En la zona están `6vf7srsa…`, `kfq7qcoy…`, `ui6peram…`
- SES espera `rhwzjikm…`, `5k3xyapq…`, `pshmhqws…`

Ninguno coincide, y comprobé las identidades de `kustto.com.mx` en us-east-1,
us-east-2 y us-west-2: **las tres esperan los mismos tres tokens nuevos**. O
sea que los que están en el DNS no los usa nadie.

Así que añadir los tres actuales es seguro y es el desbloqueo. Los viejos se
pueden dejar mientras tanto: no estorban, sólo sobran.

El **MX sí está en uso**: apunta a `inbound-smtp.us-east-1.amazonaws.com`, que
es la recepción de SES en esta misma cuenta. Ése no se toca.

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

## Lo que sigue, en orden

1. **SES.** Es lo más grave que queda. Con el panel cerrado nadie se entera de
   un pedido, y del lado del comprador es peor: el enlace de seguimiento con su
   token **sólo aparece en pantalla y nunca se manda por correo**. Si cierra esa
   pestaña pierde su pedido, porque del token sólo guardamos el hash. El dominio
   `kustto.com.mx` ya existe como identidad en SES con sus **tres CNAME de DKIM
   esperando en el DNS**, y la cuenta sigue en **sandbox**. Es el único pendiente
   que necesita un trámite externo de días: arráncalo antes que nada.
2. **Cerrar las existencias.** El backend está y verificado; falta lo que se
   ve: el aviso de "+N días, se produce bajo pedido" en el editor y el
   checkout, la alerta de bajas en el panel, y la capacidad semanal. Sin el
   aviso, el comprador no se entera de que tarda más hasta que lee su
   confirmación — y ese aviso es la mitad del trato que se decidió.
3. **Rechazar un pedido y mover con nota.** La API acepta las dos cosas
   (`cancelado` está en las transiciones, `cambiarEstado` acepta `nota`, y el
   seguimiento del comprador ya la enseña) pero el panel no las manda. Es sólo
   interfaz. Ojo: **cancelar ya devuelve existencias**, así que el botón hace
   más de lo que parece.
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

- **La plantilla `tshirt` apunta a mockups que no existen.** `/mockups/tshirtfront.png`
  y `tshirtback.png` dan 404; lo que hay en S3 es
  `mockups/tshirt/front-8cdcbb1aa538.png`. En producción saldría sin prenda.
- **El área de esa plantilla es 270 × 350 px** (proporción 0.771) y el producto
  declara 28 × 35 cm (0.8). De ahí sale la desviación de 1.3 cm que avisa la
  ficha. Cambiando el rectángulo a **280 × 350** cuadra exacto.
- **Acentos estropeados en DynamoDB**: `Detr?s` en los `sideLabels` de la
  plantilla `tshirt`, de cuando se escribieron con `curl` desde Git Bash.
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
- **Pedidos de prueba con guía comprada** en el sandbox de Skydropx. Consumen
  saldo de mentira, así que da igual, pero ensucian la bandeja del taller.
- **Cuentas de prueba en el pool de compradores** además de las de talleres.
- **Hay ~250 archivos modificados sin commitear** que son casi todo formato:
  una pasada de Biome mezclada con conversión CRLF de trabajar desde macOS y
  Windows. **No hay `.gitattributes`** y `core.autocrlf` está en `true`.
  Mientras siga así, cualquier diff real queda enterrado.

---

## Si vienes de otra máquina

1. Clona y sigue "Puesta en marcha en una máquina nueva" del `README.md`.
2. Los secretos (`services/admin/.clave-admin`, `infra/.cognito`,
   `infra/.websocket`, el `.env` del front) **se recuperan de AWS**, no hay que
   llevarlos a mano.
3. Reinicia el servidor de desarrollo después de instalar, o los títulos salen
   en Poppins en vez de Figtree: el `@theme` de Tailwind sólo se recompila al
   arrancar.
4. El proyecto se desarrolló en Windows y ahora también en macOS. Los scripts de
   `infra/` funcionan igual en los dos: `aws.sh` encuentra el CLI por
   `command -v` y sólo cae a la ruta de Windows si hace falta.
