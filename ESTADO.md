# Dónde nos quedamos

_Última actualización: 1 de septiembre de 2026._

Este archivo es el traspaso entre sesiones: lo que **no** se deduce leyendo el
código. Para el mapa del proyecto ve a `README.md`; para el AWS, a
`infra/README.md`. Si algo de aquí ya se hizo, bórralo — este documento sólo
sirve si se mantiene corto y cierto.

---

## Lo último que se terminó

La autenticación de proveedores, de punta a punta y verificada contra AWS real:

- Lambda `kustto-proveedores` detrás del autorizador JWT de Cognito, con
  `GET/PATCH /proveedores/yo` y lista blanca de campos.
- Pantalla de login en dos pasos (`/proveedor/login`): contraseña temporal →
  reto `NEW_PASSWORD_REQUIRED` → panel.
- El panel, el perfil y el cierre de sesión ya **no tocan la API de Nest**.

Probado por la interfaz: alta desde admin, primer ingreso, cambio de
contraseña, carga del perfil, guardado y salida. Y que un `PATCH` con `email` e
`id` en el cuerpo los ignora.

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

Lo segundo: el front todavía le pide a Nest **16 endpoints** (productos,
categorías públicas, paquetes, cuentas de comprador, productos del proveedor).
Mientras siga así, desplegar sin Nest deja el catálogo vacío, y desplegar *con*
Nest es exactamente el servidor que no se quiere pagar.

---

## El orden propuesto

1. **Catálogo a DynamoDB** — productos, categorías públicas, paquetes. Es la
   única pieza que bloquea todo lo demás: los pedidos referencian productos, y
   el despliegue necesita que el catálogo salga de algo que no sea Postgres.
   Se hace igual, se vaya después a donde se vaya.
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

- **Proveedores de prueba vivos en Cognito**: `taller@bordadostapatios.mx`
  (contraseña `kustto-prueba-2026`) y `prueba.login@kustto.mx` (contraseña
  `taller2026kustto`). Bórralos.
- **Acentos estropeados en DynamoDB**: `Detr?s` en los `sideLabels` de la
  plantilla `tshirt`, de cuando se escribieron con `curl` desde Git Bash.
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
