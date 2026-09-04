#!/usr/bin/env bash
#
# El backoffice: su propio bucket, su propia distribución y su propio dominio.
#
#   bash infra/backoffice.sh
#
# Idempotente. Subir el panel es OTRO script (infra/sitio-backoffice.sh),
# porque construir y publicar se hacen muchas más veces que tocar la
# infraestructura. Es el gemelo de `infra/frontend.sh` y comparte con él el
# Origin Access Control y la función de URLs bonitas: son mecanismos, no
# permisos, y duplicarlos sólo daría dos sitios donde arreglar lo mismo.
#
# POR QUÉ UN SUBDOMINIO Y NO UNA RUTA DE kustto.com.mx
#
#   Porque una ruta comparte origen con la tienda, y con él todo lo que el
#   navegador ata al origen: `localStorage`, las cookies y el alcance de un
#   XSS. Un fallo en cualquier pantalla pública —el editor, el carrito, una
#   dependencia— alcanzaría los tokens del backoffice si vivieran en el mismo
#   origen. En `backoffice.kustto.com.mx` son dos almacenes distintos y el
#   navegador lo garantiza sin que nadie tenga que acordarse.
#
#   Y porque separa el despliegue: publicar la tienda no puede publicar el
#   panel de administración por accidente.
#
# LO QUE DE VERDAD CIERRA EL BACKOFFICE NO ESTÁ AQUÍ. Esta distribución sirve
# archivos estáticos a quien los pida; cualquiera puede bajarse el HTML. Lo que
# lo cierra es que la API sólo abre `/admin/*` con un token del pool
# `kustto-admins` (ver `infra/cognito-admin.sh` y `infra/lambda-admin.sh`): sin
# él, el panel carga y no trae un solo dato.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

SITIO="${KUSTTO_BUCKET_BACKOFFICE:-kustto-backoffice-prod}"
PUBLICO="${KUSTTO_BUCKET_PUBLICO:-kustto-publico-prod}"
RAIZ="${KUSTTO_DOMINIO:-kustto.com.mx}"
DOMINIO="${KUSTTO_DOMINIO_BACKOFFICE:-backoffice.${RAIZ}}"
COMENTARIO="kustto-backoffice"
NOMBRE_OAC="kustto-oac"
NOMBRE_FUNCION="kustto-urls-bonitas"
SALIDA="infra/.backoffice"

CUENTA=$(aws_ sts get-caller-identity --query Account --output text)

ZONA=$(aws_ route53 list-hosted-zones-by-name --dns-name "${RAIZ}." \
  --query "HostedZones[?Name=='${RAIZ}.'].Id | [0]" --output text | sed 's|/hostedzone/||')

if [ "$ZONA" = "None" ] || [ -z "$ZONA" ]; then
  echo "No encontré la zona de $RAIZ en Route53." >&2
  exit 1
fi

# ── El certificado ─────────────────────────────────────────────────────────
#
# CloudFront sólo acepta certificados de us-east-1. El del sitio cubre
# `kustto.com.mx` y `www.`, no este subdominio, y un certificado de ACM es
# INMUTABLE: no se le añaden nombres, se pide otro.
#
# Se pide aquí y no a mano porque la validación es un CNAME en una zona que ya
# controlamos: hacerlo desde la consola es el paso que se olvida y deja la
# distribución sin HTTPS.

CERT=$(aws_ acm list-certificates --certificate-statuses ISSUED PENDING_VALIDATION \
  --query "CertificateSummaryList[?DomainName=='${DOMINIO}'].CertificateArn | [0]" \
  --output text 2>/dev/null || echo "None")

if [ "$CERT" = "None" ] || [ -z "$CERT" ]; then
  echo "Pidiendo certificado para $DOMINIO…"
  CERT=$(aws_ acm request-certificate \
    --domain-name "$DOMINIO" \
    --validation-method DNS \
    --query CertificateArn --output text)

  # ACM tarda unos segundos en publicar el registro de validación; pedirlo
  # antes devuelve un objeto a medias y el `jq` de abajo saldría vacío.
  sleep 10
fi

ESTADO_CERT=$(aws_ acm describe-certificate --certificate-arn "$CERT" \
  --query "Certificate.Status" --output text)

if [ "$ESTADO_CERT" = "PENDING_VALIDATION" ]; then
  echo "Publicando el CNAME de validación…"

  VALIDACION=$(aws_ acm describe-certificate --certificate-arn "$CERT" \
    --query "Certificate.DomainValidationOptions[0].ResourceRecord.[Name,Value]" \
    --output text)
  V_NOMBRE=$(echo "$VALIDACION" | cut -f1)
  V_VALOR=$(echo "$VALIDACION" | cut -f2)

  LOTE=$(mktemp)
  python3 - "$V_NOMBRE" "$V_VALOR" > "$LOTE" <<'PYVAL'
import json, sys
print(json.dumps({
    "Comment": "Validacion del certificado del backoffice",
    "Changes": [{
        "Action": "UPSERT",
        "ResourceRecordSet": {
            "Name": sys.argv[1],
            "Type": "CNAME",
            "TTL": 300,
            "ResourceRecords": [{"Value": sys.argv[2]}],
        },
    }],
}))
PYVAL

  aws_ route53 change-resource-record-sets --hosted-zone-id "$ZONA" \
    --change-batch "file://$(ruta_cli "$LOTE")" >/dev/null
  rm -f "$LOTE"

  echo "Esperando a que ACM lo valide (suele tardar 2-5 minutos)…"
  aws_ acm wait certificate-validated --certificate-arn "$CERT"
fi

ESTADO_CERT=$(aws_ acm describe-certificate --certificate-arn "$CERT" \
  --query "Certificate.Status" --output text)

if [ "$ESTADO_CERT" != "ISSUED" ]; then
  echo "El certificado está en $ESTADO_CERT, no en ISSUED. Sin él no hay HTTPS." >&2
  exit 1
fi

# ── El bucket ──────────────────────────────────────────────────────────────
#
# Cerrado, como el del sitio: nadie lee de S3 directamente, entra CloudFront
# con el OAC y la política sólo confía en ESTA distribución.
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

# ── Lo que se comparte con el sitio público ────────────────────────────────
#
# El OAC y la función de URLs bonitas los crea `infra/frontend.sh`. Aquí sólo
# se buscan: si no están, es que el sitio nunca se desplegó y hay que correr
# aquél primero.

OAC_ID=$(aws_ cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${NOMBRE_OAC}'].Id | [0]" \
  --output text 2>/dev/null || echo "None")

ARN_FUNCION=$(aws_ cloudfront describe-function --name "$NOMBRE_FUNCION" \
  --query "FunctionSummary.FunctionMetadata.FunctionARN" --output text 2>/dev/null || echo "None")

if [ "$OAC_ID" = "None" ] || [ "$ARN_FUNCION" = "None" ]; then
  echo "Falta el OAC o la función de URLs. Corre antes: bash infra/frontend.sh" >&2
  exit 1
fi

# ── La distribución ────────────────────────────────────────────────────────
DIST_ID=$(aws_ cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='${COMENTARIO}'].Id | [0]" \
  --output text 2>/dev/null || echo "None")

CONFIG=$(mktemp)
python3 infra/frontend-config.py \
  --sitio "$SITIO" --publico "$PUBLICO" --dominio "$DOMINIO" \
  --cert "$CERT" --oac "$OAC_ID" --funcion "$ARN_FUNCION" \
  --comentario "$COMENTARIO" --sin-www > "$CONFIG"

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

# ── Que los buckets dejen entrar a esta distribución ───────────────────────
#
# Se AÑADE la sentencia a lo que ya hubiera, en los dos: el bucket de contenido
# ya confía en la distribución del sitio, y sustituir su política la borraría.
for BUCKET in "$SITIO" "$PUBLICO"; do
  ACTUAL=$(aws_ s3api get-bucket-policy --bucket "$BUCKET" \
    --query Policy --output text 2>/dev/null || echo "")

  NUEVA=$(python3 infra/frontend-politica.py \
    --bucket "$BUCKET" --distribucion "$DIST_ARN" --actual "$ACTUAL")

  aws_ s3api put-bucket-policy --bucket "$BUCKET" --policy "$NUEVA"
done

# ── El DNS ─────────────────────────────────────────────────────────────────
CAMBIOS=$(mktemp)
python3 infra/frontend-dns.py --dominio "$DOMINIO" --destino "$DOMINIO_CF" --sin-www > "$CAMBIOS"

aws_ route53 change-resource-record-sets --hosted-zone-id "$ZONA" \
  --change-batch "file://$(ruta_cli "$CAMBIOS")" >/dev/null

rm -f "$CAMBIOS"

cat > "$SALIDA" <<EOF
KUSTTO_DISTRIBUCION_BACKOFFICE=$DIST_ID
KUSTTO_BUCKET_BACKOFFICE=$SITIO
KUSTTO_DOMINIO_BACKOFFICE=$DOMINIO
EOF

echo
echo "Listo."
echo "  distribución : $DIST_ID ($DOMINIO_CF)"
echo "  backoffice   : https://${DOMINIO}"
echo "  bucket       : $SITIO (cerrado; entra sólo CloudFront)"
echo "  guardado en  : $SALIDA"
echo
echo "La primera vez tarda ~15 minutos en desplegarse por todo el mundo."
echo "Para subir el panel: bash infra/sitio-backoffice.sh"
