#!/usr/bin/env bash
#
# El sitio público: bucket privado + CloudFront + DNS.
#
#   bash infra/frontend.sh
#
# Es idempotente: la primera vez crea la distribución, las siguientes la
# actualiza con la misma configuración. Subir el sitio es OTRO script
# (infra/sitio.sh), porque construir y publicar se hacen muchas más veces que
# tocar la infraestructura.
#
# POR QUÉ EL BUCKET SIGUE CERRADO
#   Nadie lee de S3 directamente. CloudFront entra con un Origin Access
#   Control y la política del bucket sólo confía en ESTA distribución. Un
#   bucket "de sitio web" abierto sería una segunda puerta sin CDN, sin HTTPS
#   y sin las reglas de abajo.
#
# LOS TRES COMPORTAMIENTOS, Y POR QUÉ IMPORTAN
#   /mockups/* y /medios/* van al bucket de contenido, NO al del sitio. Tienen
#   que servirse desde el mismo dominio que la app porque el editor hace
#   getImageData() sobre los mockups: desde otro origen el canvas queda
#   contaminado y el teñido de prenda se apaga sin decir nada. En desarrollo
#   eso lo hacen los rewrites de Next; aquí lo hace CloudFront.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

SITIO="${KUSTTO_BUCKET_SITIO:-kustto-sitio-prod}"
PUBLICO="${KUSTTO_BUCKET_PUBLICO:-kustto-publico-prod}"
DOMINIO="${KUSTTO_DOMINIO:-kustto.com.mx}"
COMENTARIO="kustto-sitio"
NOMBRE_OAC="kustto-oac"
NOMBRE_FUNCION="kustto-urls-bonitas"
SALIDA="infra/.frontend"

CUENTA=$(aws_ sts get-caller-identity --query Account --output text)

# ── El certificado ─────────────────────────────────────────────────────────
# CloudFront sólo acepta certificados de us-east-1, que es donde vive todo.
CERT=$(aws_ acm list-certificates \
  --query "CertificateSummaryList[?DomainName=='${DOMINIO}'].CertificateArn | [0]" \
  --output text)

if [ "$CERT" = "None" ] || [ -z "$CERT" ]; then
  echo "No hay certificado para $DOMINIO. Pídelo con acm request-certificate." >&2
  exit 1
fi

ESTADO_CERT=$(aws_ acm describe-certificate --certificate-arn "$CERT" \
  --query "Certificate.Status" --output text)

if [ "$ESTADO_CERT" != "ISSUED" ]; then
  echo "El certificado está en $ESTADO_CERT, no en ISSUED. Sin él no hay HTTPS." >&2
  echo "Comprueba los CNAME de validación en Route53." >&2
  exit 1
fi

# ── El bucket del sitio ────────────────────────────────────────────────────
if ! aws_ s3api head-bucket --bucket "$SITIO" >/dev/null 2>&1; then
  echo "Creando el bucket $SITIO…"
  aws_ s3api create-bucket --bucket "$SITIO" >/dev/null

  aws_ s3api put-public-access-block --bucket "$SITIO" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  aws_ s3api put-bucket-encryption --bucket "$SITIO" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
fi

# ── La función que resuelve las URLs bonitas ───────────────────────────────
#
# El export de Next escribe `/catalogo/index.html`, pero la gente pide
# `/catalogo`. S3 no tiene "documento índice" cuando se entra por OAC —eso es
# de los buckets configurados como sitio web, que son públicos—, así que la
# reescritura la hace una función en el borde.
CODIGO_FUNCION=$(mktemp)
cat > "$CODIGO_FUNCION" <<'JS'
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Una URI que ya apunta a un archivo (tiene extensión) se deja en paz:
  // aquí pasan el JS, el CSS, las imágenes y los mockups.
  if (uri.includes('.')) return request;

  // "/catalogo" -> "/catalogo/index.html"; "/" -> "/index.html"
  request.uri = uri.endsWith('/') ? uri + 'index.html' : uri + '/index.html';

  return request;
}
JS

ARN_FUNCION=$(aws_ cloudfront list-functions \
  --query "FunctionList.Items[?Name=='${NOMBRE_FUNCION}'].FunctionMetadata.FunctionARN | [0]" \
  --output text 2>/dev/null || echo "None")

if [ "$ARN_FUNCION" = "None" ] || [ -z "$ARN_FUNCION" ]; then
  echo "Creando la función $NOMBRE_FUNCION…"
  aws_ cloudfront create-function \
    --name "$NOMBRE_FUNCION" \
    --function-config "Comment=Resuelve las URLs sin extension al index.html,Runtime=cloudfront-js-2.0" \
    --function-code "fileb://$(ruta_cli "$CODIGO_FUNCION")" >/dev/null
else
  ETAG_FUNCION=$(aws_ cloudfront describe-function --name "$NOMBRE_FUNCION" \
    --query "ETag" --output text)
  aws_ cloudfront update-function \
    --name "$NOMBRE_FUNCION" \
    --if-match "$ETAG_FUNCION" \
    --function-config "Comment=Resuelve las URLs sin extension al index.html,Runtime=cloudfront-js-2.0" \
    --function-code "fileb://$(ruta_cli "$CODIGO_FUNCION")" >/dev/null
fi

# Publicar es un paso aparte: sin esto la distribución sigue con la versión
# anterior aunque el código ya esté guardado.
ETAG_FUNCION=$(aws_ cloudfront describe-function --name "$NOMBRE_FUNCION" \
  --query "ETag" --output text)
aws_ cloudfront publish-function --name "$NOMBRE_FUNCION" \
  --if-match "$ETAG_FUNCION" >/dev/null

ARN_FUNCION=$(aws_ cloudfront describe-function --name "$NOMBRE_FUNCION" \
  --query "FunctionSummary.FunctionMetadata.FunctionARN" --output text)

rm -f "$CODIGO_FUNCION"

# ── El Origin Access Control ───────────────────────────────────────────────
# Uno solo para los dos buckets: es una forma de firmar, no un permiso.
OAC_ID=$(aws_ cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${NOMBRE_OAC}'].Id | [0]" \
  --output text 2>/dev/null || echo "None")

if [ "$OAC_ID" = "None" ] || [ -z "$OAC_ID" ]; then
  echo "Creando el control de acceso $NOMBRE_OAC…"
  OAC_ID=$(aws_ cloudfront create-origin-access-control \
    --origin-access-control-config \
    "Name=${NOMBRE_OAC},Description=Kustto,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
    --query "OriginAccessControl.Id" --output text)
fi

# ── La distribución ────────────────────────────────────────────────────────
DIST_ID=$(aws_ cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='${COMENTARIO}'].Id | [0]" \
  --output text 2>/dev/null || echo "None")

CONFIG=$(mktemp)
python3 infra/frontend-config.py \
  --sitio "$SITIO" --publico "$PUBLICO" --dominio "$DOMINIO" \
  --cert "$CERT" --oac "$OAC_ID" --funcion "$ARN_FUNCION" \
  --comentario "$COMENTARIO" > "$CONFIG"

if [ "$DIST_ID" = "None" ] || [ -z "$DIST_ID" ]; then
  echo "Creando la distribución…"
  DIST_ID=$(aws_ cloudfront create-distribution \
    --distribution-config "file://$(ruta_cli "$CONFIG")" \
    --query "Distribution.Id" --output text)
else
  echo "Actualizando la distribución $DIST_ID…"
  ETAG=$(aws_ cloudfront get-distribution-config --id "$DIST_ID" \
    --query "ETag" --output text)
  aws_ cloudfront update-distribution --id "$DIST_ID" \
    --distribution-config "file://$(ruta_cli "$CONFIG")" --if-match "$ETAG" >/dev/null
fi

rm -f "$CONFIG"

DIST_ARN="arn:aws:cloudfront::${CUENTA}:distribution/${DIST_ID}"
DOMINIO_CF=$(aws_ cloudfront get-distribution --id "$DIST_ID" \
  --query "Distribution.DomainName" --output text)

# ── Que los buckets dejen entrar SÓLO a esta distribución ──────────────────
#
# Se escribe la política entera en el bucket del sitio (es nuestro y no tiene
# otra), pero en el de contenido se AÑADE la sentencia a lo que ya hubiera:
# ahí puede haber permisos de otras cosas y sustituirlos los borraría.
for BUCKET in "$SITIO" "$PUBLICO"; do
  ACTUAL=$(aws_ s3api get-bucket-policy --bucket "$BUCKET" \
    --query Policy --output text 2>/dev/null || echo "")

  NUEVA=$(python3 infra/frontend-politica.py \
    --bucket "$BUCKET" --distribucion "$DIST_ARN" --actual "$ACTUAL")

  aws_ s3api put-bucket-policy --bucket "$BUCKET" --policy "$NUEVA"
done

# ── El DNS ─────────────────────────────────────────────────────────────────
ZONA=$(aws_ route53 list-hosted-zones-by-name --dns-name "${DOMINIO}." \
  --query "HostedZones[?Name=='${DOMINIO}.'].Id | [0]" --output text | sed 's|/hostedzone/||')

if [ "$ZONA" = "None" ] || [ -z "$ZONA" ]; then
  echo "No encontré la zona de $DOMINIO en Route53." >&2
  exit 1
fi

# Z2FDTNDATAQYW2 es la zona de CloudFront: es constante y la misma para todas
# las distribuciones. No es un valor que haya que buscar.
CAMBIOS=$(mktemp)
python3 infra/frontend-dns.py --dominio "$DOMINIO" --destino "$DOMINIO_CF" > "$CAMBIOS"

aws_ route53 change-resource-record-sets --hosted-zone-id "$ZONA" \
  --change-batch "file://$(ruta_cli "$CAMBIOS")" >/dev/null

rm -f "$CAMBIOS"

cat > "$SALIDA" <<EOF
KUSTTO_DISTRIBUCION=$DIST_ID
KUSTTO_BUCKET_SITIO=$SITIO
KUSTTO_DOMINIO_CF=$DOMINIO_CF
EOF

echo
echo "Listo."
echo "  distribución : $DIST_ID ($DOMINIO_CF)"
echo "  sitio        : https://${DOMINIO} y https://www.${DOMINIO}"
echo "  bucket       : $SITIO (cerrado; entra sólo CloudFront)"
echo "  guardado en  : $SALIDA"
echo
echo "La primera vez tarda ~15 minutos en desplegarse por todo el mundo."
echo "Para subir el sitio: bash infra/sitio.sh"
