# Notas para Claude

Lee `README.md` primero: ahí está el estado de la migración y la puesta en
marcha. Esto son las reglas de trabajo que no se deducen del código.

## Idioma

**Todo en español**: comentarios, mensajes de error, nombres de variables y
funciones nuevas, mensajes de commit. Lo viejo en inglés se deja como está
hasta que haya una razón para tocarlo — no hagas una pasada de traducción.

## Comentarios

Explican **por qué**, nunca qué. Si el comentario se puede deducir leyendo la
línea de abajo, sobra. Los que valen la pena son los que evitan que alguien
"arregle" algo a propósito:

- por qué los mockups tienen que ser del mismo origen,
- por qué la ruta no puede ser `ANY`,
- por qué la comparación de la llave es en tiempo constante,
- por qué el `sub` de Cognito es el id en DynamoDB.

## Antes de escribir infraestructura

Los scripts de `infra/` son idempotentes y esa propiedad no es negociable:
se corren varias veces al día. Si agregas uno, que crear y actualizar sean el
mismo comando.

## Windows

El proyecto se desarrolla en Windows con Git Bash y PowerShell.

- Los heredocs de `node -e`, y `curl -d` con acentos, **estropean el UTF-8 y
  las comillas**. Para editar archivos usa las herramientas de edición, no
  `sed`/`cat` con contenido acentuado. Para mandar JSON con acentos, escribe
  un archivo y usa `--data-binary @archivo.json`.
- `zip` no existe en Git Bash. Usa `Compress-Archive` de PowerShell.
- El front se levanta **en el host** (`pnpm --filter web dev`), no en Docker.

## Verificar antes de afirmar

Cuando digas que algo funciona, que sea porque lo corriste. En este proyecto
ya pasó dos veces que un fallo se atribuyó al lugar equivocado:

- las animaciones "rotas" de framer-motion estaban corriendo, pero el panel
  del navegador nunca las componía;
- un slug supuestamente mal generado era el `curl` de Git Bash destrozando
  el UTF-8, no la regex.

Antes de cambiar código por una hipótesis, comprueba la hipótesis.

## Lo que no hay que hacer

- **No metas un framework en las Lambdas.** El router de treinta líneas es
  suficiente y el arranque en frío se paga en cada petición.
- **No pongas secretos en variables `NEXT_PUBLIC_*`.** Quedan incrustadas en
  el bundle. Si algo lo tiene que leer el servidor, va sin prefijo y se
  importa desde un módulo con `server-only`.
- **No sirvas mockups desde otro origen** (Cloudinary incluido): el teñido de
  prenda se apaga sin decir nada.
- **No vuelvas a crear una ruta `ANY`** en la API Gateway de proveedores.
- **No inviertas en migrar los productos de Postgres.** Son de prueba y se
  vuelven a sembrar.
