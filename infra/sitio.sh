#!/usr/bin/env bash
#
# Construye el sitio y lo publica.
#
#   bash infra/sitio.sh
#
# Se corre cada vez que cambia el front O el catálogo: las URLs de producto se
# calculan al construir, así que **un producto aprobado no aparece en el sitio
# hasta que esto vuelve a correr**. Es el precio de tener URLs indexables en
# vez de `?id=`.
#
# QUÉ SE QUEDA FUERA, Y POR QUÉ
#
#   El ADMIN no se publica. No es una limitación técnica que haya que superar:
#   el proxy `/api/admin/*` lleva la llave compartida puesta, y publicarlo
#   sería dejar esa llave al alcance de quien encuentre la URL. Se usa en
#   local con `pnpm --filter web dev` hasta que tenga login propio.
#
#   `/proveedores/[slug]` y `/package/[id]` tampoco. Leen de la API de Nest,
#   que no se despliega: publicarlas sería publicar dos páginas que no cargan.
#   Además `output: export` no admite una ruta dinámica que no genere ninguna
#   URL, así que ni siquiera compilan.
#
#   Se apartan moviéndolas y se devuelven SIEMPRE, incluso si el build falla
#   (por eso el `trap`). Es un apaño consciente: la salida buena, cuando el
#   admin crezca, es que sea su propia aplicación en el monorepo.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

if [ ! -f infra/.frontend ]; then
  echo "Falta infra/.frontend. Corre antes: bash infra/frontend.sh" >&2
  exit 1
fi
source infra/.frontend

WEB="apps/web"
APARTE="$(mktemp -d)"

# Las rutas que no se publican, con su ruta relativa dentro de apps/web.
FUERA=(
  "app/admin"
  "app/api"
  "app/proveedores/[slug]"
  "app/package/[id]"
)

restaurar() {
  for RUTA in "${FUERA[@]}"; do
    GUARDADA="${APARTE}/$(echo "$RUTA" | tr '/' '_')"
    if [ -e "$GUARDADA" ]; then
      mkdir -p "$(dirname "${WEB}/${RUTA}")"
      mv "$GUARDADA" "${WEB}/${RUTA}"
    fi
  done
  rm -rf "$APARTE"
}

# Pase lo que pase —build roto, Ctrl-C, error de red— las rutas vuelven a su
# sitio. Sin esto, un build fallido dejaría el repo sin el admin y el
# siguiente `git status` daría un susto de los buenos.
trap restaurar EXIT INT TERM

for RUTA in "${FUERA[@]}"; do
  if [ -e "${WEB}/${RUTA}" ]; then
    mv "${WEB}/${RUTA}" "${APARTE}/$(echo "$RUTA" | tr '/' '_')"
  fi
done

echo "Construyendo el sitio (sin el admin)…"
# Se borra la caché del servidor de desarrollo antes de construir.
#
# NO es por limpieza: ahí dentro Next deja los tipos que genera POR RUTA,
# incluidas las del admin que este script aparta, y el build de export falla
# con un "Cannot find name" señalando un archivo que ya no existe.
#
# Se intentó darle al export su propia carpeta con `distDir`, y salió peor:
# con `distDir`, `output: export` escribe el HTML DENTRO de esa carpeta en vez
# de en `out/`, así que este script siguió subiendo un `out/` viejo y dos
# publicaciones no publicaron nada. Si vuelves a tocar esto, comprueba la
# fecha de `apps/web/out/index.html` después de construir.
rm -rf "${WEB}/.next" "${WEB}/out"

(cd "$WEB" && KUSTTO_EXPORT=1 pnpm build 2>&1 | tail -20)

restaurar
trap - EXIT INT TERM

if [ ! -d "${WEB}/out" ]; then
  echo "El build no dejó ${WEB}/out. Algo falló." >&2
  exit 1
fi

echo "Subiendo a s3://${KUSTTO_BUCKET_SITIO}…"

# Dos pasadas, porque no todo caduca igual:
#
#   1. `_next/static` lleva el hash del contenido en el nombre. Es inmutable
#      de verdad: si cambia, cambia el nombre. Se cachea un año.
#   2. El HTML NO se puede cachear así. Es lo que apunta a los archivos con
#      hash, y si se queda pegado, el navegador pide los de la versión
#      anterior y el sitio se rompe a medias tras cada despliegue.
aws_ s3 sync "${WEB}/out" "s3://${KUSTTO_BUCKET_SITIO}" \
  --delete \
  --exclude "_next/static/*" \
  --cache-control "public, max-age=0, must-revalidate" >/dev/null

aws_ s3 sync "${WEB}/out/_next/static" "s3://${KUSTTO_BUCKET_SITIO}/_next/static" \
  --cache-control "public, max-age=31536000, immutable" >/dev/null

# La invalidación es sólo del HTML: los estáticos tienen nombre único, así que
# invalidarlos sería pagar por borrar algo que nadie va a volver a pedir.
INVALIDACION=$(aws_ cloudfront create-invalidation \
  --distribution-id "$KUSTTO_DISTRIBUCION" \
  --paths "/" "/*" \
  --query "Invalidation.Id" --output text)

echo
echo "Publicado."
echo "  archivos     : $(find "${WEB}/out" -type f | wc -l | tr -d ' ')"
echo "  invalidación : $INVALIDACION (tarda un par de minutos)"
echo "  sitio        : https://kustto.com.mx"
