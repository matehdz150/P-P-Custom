# Dónde nos quedamos

_Última actualización: 2 de septiembre de 2026._

Este archivo es el traspaso entre sesiones: lo que **no** se deduce leyendo el
código. Para el mapa del proyecto ve a `README.md`; para el AWS, a
`infra/README.md`. Si algo de aquí ya se hizo, bórralo — este documento sólo
sirve si se mantiene corto y cierto.

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
copiar, y la bitácora.

---

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

## Lo que sigue, en orden

1. **SES.** Es lo más grave que queda. Con el panel cerrado nadie se entera de
   un pedido, y del lado del comprador es peor: el enlace de seguimiento con su
   token **sólo aparece en pantalla y nunca se manda por correo**. Si cierra esa
   pestaña pierde su pedido, porque del token sólo guardamos el hash. El dominio
   `kustto.com.mx` ya existe como identidad en SES con sus **tres CNAME de DKIM
   esperando en el DNS**, y la cuenta sigue en **sandbox**. Es el único pendiente
   que necesita un trámite externo de días: arráncalo antes que nada.
2. **Rechazar un pedido y mover con nota.** La API acepta las dos cosas
   (`cancelado` está en las transiciones, `cambiarEstado` acepta `nota`, y el
   seguimiento del comprador ya la enseña) pero el panel no las manda. Es sólo
   interfaz.
3. **Contraseña del taller.** No hay forma de cambiarla ni de restablecerla: ni
   el taller, ni el admin, ni "olvidé mi contraseña". Hoy se arregla entrando a
   la consola de AWS. El rol de admin **ya tiene `AdminSetUserPassword`**.
4. **El panel en móvil.** La barra lateral es `fixed w-[236px]` con el contenido
   en `ml-[236px]` y **ni un breakpoint**: en un teléfono quedan 154 px útiles.
   Quien produce está en el taller, no en un escritorio.
5. **Login de admin y despliegue.** El proxy `/api/admin/*` sigue siendo una
   puerta abierta y hay que cerrarla antes de que el sitio sea público.

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
- **Restos de un dominio de paquetes que nunca se terminó**, ahora ya
  versionados: `apps/api/src/package-{designs,orders}/`,
  `packages/db/schema/packages/` y las páginas `app/package/*` y
  `app/proveedor/paquetes`. Importan módulos que no existen y **son la mayoría
  de los 17 errores de `pnpm type-check`**. O se retoman o se borran.
- **`components/Provider/ProviderProductForm.tsx` es código muerto**: nadie lo
  importa desde que `AltaProducto` lo reemplazó.
- **`pnpm-lock.yaml` sigue ignorado y sin versionar.**
- La landing de proveedores vive en `/proveedores` y el panel autenticado en
  `/proveedor`. Dos nombres a un carácter de distancia van a doler.

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
