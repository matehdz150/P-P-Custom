# Dónde nos quedamos

_Última actualización: 1 de septiembre de 2026 (tarde)._

Este archivo es el traspaso entre sesiones: lo que **no** se deduce leyendo el
código. Para el mapa del proyecto ve a `README.md`; para el AWS, a
`infra/README.md`. Si algo de aquí ya se hizo, bórralo — este documento sólo
sirve si se mantiene corto y cierto.

---

## Lo último que se terminó

**El admin de categorías y el de proveedores, ya sin Nest de por medio.**
Estaban a medias de una forma que no se veía: la página de categorías *leía*
de DynamoDB pero *escribía* en Postgres, y `/admin/proveedores` nunca se
migró. Con Nest apagado —lo normal ahora— la primera daba 500 y la segunda
`ERR_CONNECTION_REFUSED`.

- `/admin/categorias`: crear, editar y borrar las de producto van a DynamoDB.
  Las de paquete siguen en Nest, pero ya no tumban la página: si la API vieja
  no contesta, esa sección sola muestra un aviso.
- `/admin/proveedores`: lista y alta contra la Lambda. El formulario ya no
  pide contraseña —la genera Cognito— y enseña la temporal una sola vez.
- **`GET /providers` estaba devolviendo `passwordHash`.** Los proveedores
  sembrados antes de Cognito lo traen en la tabla y `sinLlaves` sólo quita
  pk/sk/gsi*. Ahora hay lista blanca de campos.
- Ruta nueva `POST /uploads/imagen-url`: firma subidas a `medios/<carpeta>/`
  para imágenes del catálogo que no son mockups. Las de categoría ya no van
  a Cloudinary. Se leen por `/medios/...`, con su rewrite igual que
  `/mockups/...`.
- **`infra/lambda-admin.sh` ya no inventa una llave si no encuentra el
  archivo.** En una máquina nueva generaba una y la desplegaba, dejando al
  front hablando con la llave vieja. Ahora, si la función existe, su llave y
  su `KUSTTO_POOL_ID` mandan. También se arregló el `--environment` con una
  variable vacía, que rompía el parser del CLI.

Verificado contra AWS real: firma → `PUT` a S3 → lectura por `/medios/...`
con los bytes idénticos, el rechazo de carpetas fuera de la lista blanca, y
que `/providers` ya no trae ningún hash.

**El login de proveedores no estaba roto: el `.env.local` de esta máquina
tenía `NEXT_PUBLIC_COGNITO_CLIENTE` cortado a diez caracteres.** Cognito
contestaba `ResourceNotFoundException` y la pantalla lo enseñaba como "no
pudimos conectar", que manda a revisar el internet. Ahora `ErrorCognito`
distingue los fallos de configuración de los de credenciales, el tipo real
sale por consola, y el aviso dice que el problema es nuestro.

**Y la tabla se limpió.** Tres de los cinco proveedores eran de la siembra
vieja de Postgres: estaban en DynamoDB con su `passwordHash` pero sin cuenta
en Cognito, así que **su login daba `UserNotFoundException` siempre** — y uno
de ellos, `hola@bordadostapatios.mx`, se confundía a simple vista con el que
sí funciona, `taller@bordadostapatios.mx`. Se borraron sus ítems `META` y sus
candados de correo. Ahora la tabla y Cognito coinciden: los mismos dos ids en
los dos lados, y ya no queda ningún hash de contraseña guardado.

La autenticación de proveedores (Lambda `kustto-proveedores`, login en dos
pasos con `NEW_PASSWORD_REQUIRED`, perfil y cierre de sesión) quedó lista la
sesión anterior y sigue en pie.

---

## Fase 1 de productos: el taller ya puede dar de alta

Sin migrar un solo producto de Postgres —son de prueba y se vuelven a
capturar—, lo que se construyó es la **capacidad** de crearlos, con
aprobación del admin de por medio.

- El producto es **un ítem** (`PRODUCT#<id>/META`) con todo dentro: en
  Postgres eran diez tablas y otros tantos joins por ficha.
- Rutas nuevas en `kustto-proveedores`, todas atadas al `sub` del token:
  crear, listar los propios, ver, editar, y firmar la subida de fotos.
- **El asistente de alta ya no pasa por el admin.** Pedía plantillas por
  `/api/admin/*` —con la llave del admin puesta— y categorías a Nest. Ahora
  las lee por `/proveedores/plantillas` y `/proveedores/categorias`. Aquello
  funcionaba sólo porque el proxy no exige sesión; con login de admin, el
  taller se habría quedado sin poder elegir prenda.
- Las fotos van a S3 bajo `medios/productos/<sub>/`, no a Cloudinary.
- El rol `kustto-proveedores-rol` creció lo justo: `PutItem` y
  `TransactWriteItems` (el producto y su candado de slug van juntos) y
  `PutObject` acotado a `medios/productos/*`.

Verificado con el token de un taller real: plantillas y categorías se leen,
la foto sube a su carpeta, el producto se crea con acentos intactos, el slug
repetido se resuelve con sufijo, las cuatro validaciones devuelven 400, y el
producto de otro taller da **404 al leerlo, al editarlo y no aparece en la
lista**.

Decisiones que quedaron grabadas y conviene no deshacer sin pensarlas:

- **Editar un producto aprobado lo regresa a revisión.** Si no, bastaría con
  publicar algo inocuo, esperar el visto bueno y cambiarle el contenido.
- **El slug no se recalcula al editar el nombre**: es la URL pública, y
  moverla rompe los enlaces que ya circulan.
- **`activo` no está en manos del taller.** El asistente ahora dice "Enviar
  a revisión", no "Publicar".

## Fase 2: la bandeja de revisión

El circuito ya cierra. `/admin/revision` lista por estado (esperando,
publicados, regresados), aprueba, y regresa con nota.

- `GET /productos?estado=` sale del `gsi2`, con los más viejos primero: es
  una cola de trabajo, no un listado.
- **Rechazar sin nota devuelve 400.** La nota es lo único que el taller va a
  ver de la revisión; sin ella se queda adivinando qué corregir.
- Sólo se puede revisar lo que está `en_revision`, por condición en el
  `UpdateItem`: si dos personas resuelven lo mismo, la segunda recibe un 409
  con el motivo en vez de pisar la decisión de la primera.
- Aprobar **borra** la nota vieja: dejarla junto a un producto publicado se
  lee como si siguiera habiendo algo mal.
- El nombre del taller se resuelve al leer (un `BatchGet` de los talleres
  distintos de la página), no se guarda dentro del producto: el taller puede
  cambiárselo y la bandeja mentiría.

Probado de punta a punta con la interfaz real: un producto dado de alta
desde el navegador se aprobó y quedó `activo`; otro se regresó con nota, y
el taller la ve en su panel. Las bandejas se reindexan bien —`en_revision`
quedó vacía, y cada uno apareció en la suya— y un estado inventado en la
query devuelve 400.

## El bucle completo: corregir y reenviar

`/proveedor/productos/[id]/editar` cierra el circuito. Es **el mismo
asistente** de alta con el producto cargado dentro, no un formulario aparte:
las reglas de qué falta en cada paso son las mismas, y dos pantallas
distintas habrían divergido en cuanto alguien tocara una.

- La nota del admin va arriba y en **todos** los pasos: es la razón por la
  que el taller entró, y el paso donde está el problema no tiene por qué ser
  el primero.
- `deProductoAAlta` es el camino de vuelta, y el caso delicado son los
  límites: `maxDesigns` y `maxColorsPerDesign` se guardan **ausentes** cuando
  no hay tope, así que hay que reconstruir la palanca de "limitar" desde si
  el número existe. Leerlo al revés le pondría al taller un tope de cero.
- Si el producto está publicado, la pantalla lo avisa antes de guardar: sale
  del catálogo hasta que se apruebe otra vez.
- **La nota sobrevive al reenvío**, a propósito: cuando el producto vuelve a
  la bandeja, el admin ve por qué lo regresó y puede comprobar si de verdad
  se corrigió.

Probado entero: un producto rechazado se abrió con su nota, se le agregó la
talla que faltaba, volvió a `en_revision` con la nota intacta para el admin,
se aprobó —y ahí la nota sí se limpia—, y al cambiarle el precio ya estando
publicado **salió del catálogo solo**, de vuelta a revisión.

---

## El hallazgo que cambia las prioridades

**No existe el dominio de pedidos. En ningún lado.**

No hay módulo `orders` en Nest, no hay carrito, no hay checkout, y el editor no
tiene salida: terminas un diseño y no hay a dónde mandarlo. El `pedidos.ts` del
front sólo lee `/providers/me/orders`, y el "Todavía no te asignamos pedidos"
del panel del taller es un placeholder sobre nada.

Dicho de otra forma: **hoy la app no puede tomar un solo pedido.** Esa es la
distancia real entre un catálogo bonito y un negocio, y es más grande que
cualquiera de los pendientes de infraestructura.

Lo segundo: el front todavía le pide a Nest los productos, las categorías
públicas, los paquetes, las cuentas de comprador y los productos del
proveedor. Mientras siga así, desplegar sin Nest deja el catálogo vacío, y
desplegar *con* Nest es exactamente el servidor que no se quiere pagar. El
admin ya no está en esa lista: lo único suyo que sigue en Nest son productos
y paquetes, que se van con el catálogo.

---

## El orden propuesto

1. **Que el catálogo público se lea de DynamoDB.** Escribir productos ya está
   resuelto de las dos puntas (el taller los crea, el admin los aprueba); lo
   que sigue en Postgres son las LECTURAS: `/catalogo`, la página de producto
   y los paquetes. Aquí es donde por fin hay que resolver la decisión abierta
   de abajo.
2. **Pedidos** — diseño guardado, pedido creado, asignado a un taller, con su
   bitácora de estados.
3. **Login de admin y despliegue** — el proxy `/api/admin/*` es una puerta
   abierta; hay que cerrarla antes de que el sitio sea público.

---

## Decisión abierta (sin resolver)

**Cómo se leen los listados del catálogo.** Dos caminos y no da igual:

- **JSON materializado en S3.** Un stream de DynamoDB —ya están activados en la
  tabla— reescribe un JSON del catálogo cada vez que cambia un producto. Leer
  cuesta prácticamente cero: S3 + CloudFront, sin Lambda por visita. Más
  maquinaria, y los cambios tardan segundos en verse.
- **Query directo a DynamoDB.** Más simple y siempre fresco, pero exige un
  índice por cada filtro y se paga Lambda + lectura en cada carga.

El modelo de datos y la escritura son iguales en los dos casos, así que se
puede empezar por ahí y decidir con el código delante.

---

## Cosas que hay que limpiar antes de que esto sea real

- **Proveedores de prueba vivos en Cognito.** Bórralos antes de abrir esto.
  - `prueba.login@kustto.mx`, contraseña `kustto2026taller`, puesta como
    permanente para poder entrar al panel sin el reto de primer ingreso.
  - `taller@bordadostapatios.mx`, **sin contraseña conocida**: se cambió al
    probar el reto y Cognito no la devuelve. Se recupera con
    `admin-set-user-password` o se borra la cuenta.
- **El admin no puede restablecerle la contraseña a un taller.** Si un
  proveedor pierde su temporal, hoy hay que entrar a la consola de AWS. El
  rol de la Lambda ya tiene `AdminSetUserPassword`, así que es una ruta
  corta: `POST /providers/:id/contrasena`, temporal nueva devuelta una vez.
- **Acentos estropeados en DynamoDB**: `Detr?s` en los `sideLabels` de la
  plantilla `tshirt`, de cuando se escribieron con `curl` desde Git Bash.
- **`components/Provider/ProviderProductForm.tsx` es código muerto**: nadie
  lo importa desde que `AltaProducto` lo reemplazó, y es lo único que queda
  usando `createProviderProduct` contra Nest. Se puede borrar junto con esa
  función y `getMyProducts` de `lib/api/providers.ts`.
- **Restos de un dominio de paquetes que nunca se terminó**, sin versionar y
  del 3 de junio: `apps/api/src/package-{designs,orders}/`,
  `packages/db/schema/packages/package_{designs,orders}.ts` y las páginas
  `app/package/[id]/{disenar,resumen}` y `app/proveedor/paquetes`. Importan
  `user_designs` y `orders/orders`, que ya no existen; no están en
  `app.module.ts` ni en el índice del esquema, pero **sí rompen
  `pnpm type-check`**. O se retoman o se borran.
- **`pnpm-lock.yaml` sigue ignorado y sin versionar.** Para trabajar desde
  varias máquinas conviene versionarlo; es quitar una línea del `.gitignore`.
- **`apps/web` ya trae errores de tipos previos** en el admin de productos y
  algunos formularios. No vienen de la migración; alguien tendrá que sentarse
  con ellos.
- La landing de proveedores vive en `/proveedores` y el panel autenticado en
  `/proveedor`. Dos nombres a un carácter de distancia van a doler; conviene
  renombrar antes de que haya enlaces afuera.

---

## Si vienes de otra máquina

1. Clona y sigue "Puesta en marcha en una máquina nueva" del `README.md`.
2. Los tres secretos (`services/admin/.clave-admin`, `infra/.cognito`,
   `apps/web/.env.local`) **se recuperan de AWS**, no hay que llevarlos a mano.
3. Reinicia el servidor de desarrollo después de instalar, o los títulos salen
   en Poppins en vez de Figtree: el `@theme` de Tailwind sólo se recompila al
   arrancar.
