#!/usr/bin/env bash
#
# Construye el backoffice y lo publica en backoffice.kustto.com.mx.
#
#   bash infra/sitio-backoffice.sh
#
# Es el gemelo de `infra/sitio.sh` con la selección al revés: aquél publica la
# tienda y aparta el admin; éste publica el admin y no sube una sola página de
# la tienda.
#
# QUÉ SE SUBE, Y POR QUÉ NO TODO
#
#   El build es UNO SOLO —es la misma aplicación de Next— y genera las páginas
#   de las dos cosas. De ahí sólo viaja `out/admin/**` y los fragmentos
#   compartidos de `out/_next/**`. Subir el resto pondría la tienda entera en
#   un segundo dominio: contenido duplicado para Google y dos sitios donde
#   arreglar lo mismo.
#
#   `/proveedores/[slug]` y `/package/[id]` se apartan igual que en el otro
#   script: leen de la API de Nest, que no se despliega, y `output: export` no
#   admite una ruta dinámica que no genere ninguna URL. Ni siquiera compilan.
#
#   Se apartan moviéndolas y se devuelven SIEMPRE, incluso si el build falla
#   (por eso el `trap`).
#
# LA RAÍZ REDIRIGE A /admin. Las páginas del panel se generan bajo esa ruta y
# sus enlaces internos son absolutos (`/admin/productos`), así que moverlas a
# la raíz del bucket las dejaría enlazando a sitios que no existen. Un
# `index.html` de dos líneas cuesta menos que reescribir el árbol de rutas.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

if [ ! -f infra/.backoffice ]; then
  echo "Falta infra/.backoffice. Corre antes: bash infra/backoffice.sh" >&2
  exit 1
fi
source infra/.backoffice

WEB="apps/web"
APARTE="$(mktemp -d)"

FUERA=(
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

trap restaurar EXIT INT TERM

for RUTA in "${FUERA[@]}"; do
  if [ -e "${WEB}/${RUTA}" ]; then
    mv "${WEB}/${RUTA}" "${APARTE}/$(echo "$RUTA" | tr '/' '_')"
  fi
done

# La caché se borra ANTES de construir.
#
# No es por limpieza: ahí dentro Next deja los tipos que genera POR RUTA,
# incluidas las que este script aparta, y el build de export falla con un
# "Cannot find name" señalando un archivo que ya no existe.
#
# Se intenta dos veces porque el servidor de desarrollo, si está levantado,
# reescribe `.next/dev` mientras se borra y `rm -rf` sale con "Directory not
# empty". Si a la segunda sigue ahí, se dice qué pasa en vez de dejar un
# "Directory not empty" que no explica nada.
limpiar_next() {
  rm -rf "${WEB}/.next" "${WEB}/out" 2>/dev/null && return 0

  sleep 2
  rm -rf "${WEB}/.next" "${WEB}/out" 2>/dev/null && return 0

  echo "No pude borrar ${WEB}/.next: algo lo está escribiendo." >&2
  echo "Casi seguro es el servidor de desarrollo. Párala y vuelve a correr esto." >&2
  exit 1
}

echo "Construyendo el backoffice…"
limpiar_next

(cd "$WEB" && KUSTTO_EXPORT=1 pnpm build 2>&1 | tail -20)

restaurar
trap - EXIT INT TERM

if [ ! -d "${WEB}/out/admin" ]; then
  echo "El build no dejó ${WEB}/out/admin. Algo falló." >&2
  exit 1
fi

# La raíz del dominio, que sólo existe para llevar al panel.
RAIZ=$(mktemp -d)
cat > "${RAIZ}/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<title>Kustto · Backoffice</title>
<meta http-equiv="refresh" content="0; url=/admin">
<link rel="canonical" href="/admin">
<p>Yendo al panel… <a href="/admin">entrar</a>.</p>
HTML

echo "Subiendo a s3://${KUSTTO_BUCKET_BACKOFFICE}…"

# Dos pasadas, porque no todo caduca igual. Misma razón que en `sitio.sh`:
# `_next/static` lleva el hash en el nombre y es inmutable de verdad; el HTML
# es lo que apunta a esos archivos y no se puede quedar pegado.
#
# El `--delete` va SÓLO en la pasada del panel y con `--exclude` de lo demás:
# sin eso, sincronizar `out/admin` contra la raíz del bucket borraría
# `_next/` entero en cada publicación y el panel se quedaría sin JavaScript
# hasta la siguiente pasada.
aws_ s3 sync "${WEB}/out/admin" "s3://${KUSTTO_BUCKET_BACKOFFICE}/admin" \
  --delete \
  --cache-control "public, max-age=0, must-revalidate" >/dev/null

aws_ s3 sync "${WEB}/out/_next" "s3://${KUSTTO_BUCKET_BACKOFFICE}/_next" \
  --exclude "static/*" \
  --cache-control "public, max-age=0, must-revalidate" >/dev/null

aws_ s3 sync "${WEB}/out/_next/static" "s3://${KUSTTO_BUCKET_BACKOFFICE}/_next/static" \
  --cache-control "public, max-age=31536000, immutable" >/dev/null

aws_ s3 cp "${RAIZ}/index.html" "s3://${KUSTTO_BUCKET_BACKOFFICE}/index.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=0, must-revalidate" >/dev/null

# Los archivos sueltos de la raíz que el panel SÍ necesita.
#
# `icon.svg` y `apple-icon.png` los inyecta Next en el `<head>` de TODAS las
# páginas, incluidas las del admin, con una ruta absoluta a la raíz. Sin
# subirlos, cada pantalla del backoffice pedía `/icon.svg` y recibía un 403 —
# que además la distribución convierte en 404 y contamina la consola.
#
# `404.html` es a donde CloudFront manda los 403 y 404. Sin él, una URL mal
# escrita enseña el XML de error de S3.
#
# Se enumeran uno por uno y no se sincroniza la raíz entera a propósito: ahí
# están también las imágenes de la tienda —`event.png`, `business.png`, el
# logo— y subirlas sería publicar material de la tienda en otro dominio.
for ARCHIVO in icon.svg apple-icon.png 404.html; do
  if [ -f "${WEB}/out/${ARCHIVO}" ]; then
    aws_ s3 cp "${WEB}/out/${ARCHIVO}" "s3://${KUSTTO_BUCKET_BACKOFFICE}/${ARCHIVO}" \
      --cache-control "public, max-age=0, must-revalidate" >/dev/null
  fi
done

rm -rf "$RAIZ"

# La invalidación es sólo del HTML: los estáticos tienen nombre único, así que
# invalidarlos sería pagar por borrar algo que nadie va a volver a pedir.
INVALIDACION=$(aws_ cloudfront create-invalidation \
  --distribution-id "$KUSTTO_DISTRIBUCION_BACKOFFICE" \
  --paths "/" "/admin/*" "/icon.svg" "/apple-icon.png" "/404.html" \
  --query "Invalidation.Id" --output text)

echo
echo "Publicado."
echo "  páginas      : $(find "${WEB}/out/admin" -name '*.html' | wc -l | tr -d ' ')"
echo "  invalidación : $INVALIDACION (tarda un par de minutos)"
echo "  backoffice   : https://${KUSTTO_DOMINIO_BACKOFFICE}"
