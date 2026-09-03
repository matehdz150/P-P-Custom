#!/usr/bin/env bash
#
# El buzón de kustto.com.mx: DNS, verificación y dónde aterriza el correo.
#
#   bash infra/correo.sh
#
# Idempotente. Los registros van con UPSERT y sólo los que este script conoce:
# el MX y los DKIM viejos de la zona NO se tocan.
#
# QUÉ HACE FALTA PARA RECIBIR, Y EN QUÉ ORDEN
#
#   1. El MX apuntando a inbound-smtp de la región. Ya estaba puesto.
#   2. El dominio VERIFICADO. Esto es lo que faltaba: sin el TXT
#      `_amazonses`, SES rechaza el correo aunque el MX apunte bien.
#   3. Un bucket donde dejarlo, con permiso para que SES escriba.
#   4. Un conjunto de reglas activo — eso lo pone infra/lambda-correo.sh.
#
# EL SANDBOX NO IMPIDE RECIBIR
#   Sólo limita el envío. El buzón funciona desde que el dominio se verifica,
#   sin esperar a que AWS apruebe la salida del sandbox.
#
# LOS DKIM: HAY DOS JUEGOS Y NINGUNO SOBRA
#   La zona lleva los de DOS identidades distintas de `kustto.com.mx`:
#
#     ui6peram… 6vf7srsa… kfq7qcoy…  -> cuenta ROOT (467685081574), la que
#                                       ENVÍA. Firma todo lo que sale.
#     rhwzjikm… 5k3xyapq… pshmhqws…  -> esta cuenta, la que RECIBE.
#
#   Aquí sólo se AÑADEN los de esta cuenta; el nombre del registro lleva el
#   token dentro, así que conviven. **Los otros tres no se borran**: un
#   comentario anterior decía que estaban muertos y era falso.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

DOMINIO="${KUSTTO_DOMINIO:-kustto.com.mx}"
# El subdominio del sobre. Ver "EL MAIL FROM PROPIO" más abajo.
SOBRE="correo.${DOMINIO}"
BUCKET="${KUSTTO_BUCKET_CORREO:-kustto-correo-prod}"
PREFIJO="entrada/"
# Cuántos días se guarda el correo crudo. Se reenvía en cuanto llega, así que
# esto es sólo el archivo: sin caducidad, el bucket crece para siempre.
DIAS_RETENCION="${KUSTTO_RETENCION_CORREO:-90}"

CUENTA=$(aws_ sts get-caller-identity --query Account --output text)

ZONA=$(aws_ route53 list-hosted-zones-by-name --dns-name "$DOMINIO" \
  --query "HostedZones[?Name=='${DOMINIO}.'].Id | [0]" --output text)

if [ "$ZONA" = "None" ] || [ -z "$ZONA" ]; then
  echo "No encontré la zona de $DOMINIO en Route53." >&2
  exit 1
fi
ZONA="${ZONA#/hostedzone/}"

# ── La identidad ───────────────────────────────────────────────────────────
if ! aws_ ses get-identity-verification-attributes --identities "$DOMINIO" \
  --query "VerificationAttributes.\"${DOMINIO}\"" --output text >/dev/null 2>&1; then
  echo "Creando la identidad de $DOMINIO…"
  aws_ ses verify-domain-identity --domain "$DOMINIO" >/dev/null
fi

TOKEN=$(aws_ ses get-identity-verification-attributes --identities "$DOMINIO" \
  --query "VerificationAttributes.\"${DOMINIO}\".VerificationToken" --output text)

DKIM=$(aws_ sesv2 get-email-identity --email-identity "$DOMINIO" \
  --query "DkimAttributes.Tokens" --output text)

# ── El MAIL FROM propio ────────────────────────────────────────────────────
#
# Por defecto SES pone `amazonses.com` como remitente del SOBRE (el
# Return-Path), que es distinto del `From` que lee la gente. SPF se comprueba
# contra el sobre, así que sin esto el SPF de kustto.com.mx NO ALINEA con el
# From y DMARC sólo puede pasar por DKIM. Con un subdominio propio, alinean
# los dos y el correo deja de parecer suplantación.
#
# `BehaviorOnMxFailure=UseDefaultValue`: si el MX del subdominio fallara, SES
# vuelve a su remitente de siempre en vez de dejar de enviar. Preferimos un
# correo con peor reputación que ningún correo.
ACTUAL_SOBRE=$(aws_ sesv2 get-email-identity --email-identity "$DOMINIO" \
  --query "MailFromAttributes.MailFromDomain" --output text 2>/dev/null || echo "None")

if [ "$ACTUAL_SOBRE" != "$SOBRE" ]; then
  echo "Configurando el MAIL FROM en $SOBRE…"
  aws_ sesv2 put-email-identity-mail-from-attributes \
    --email-identity "$DOMINIO" \
    --mail-from-domain "$SOBRE" \
    --behavior-on-mx-failure USE_DEFAULT_VALUE >/dev/null
fi

# ── Los registros ──────────────────────────────────────────────────────────
# El TXT de verificación va entre comillas DENTRO del valor: Route53 guarda
# las cadenas de un TXT citadas, y sin las comillas rechaza el cambio.
CAMBIOS=$(cat <<JSON
{
  "Comment": "Buzon de kustto: verificacion y DKIM",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_amazonses.${DOMINIO}",
        "Type": "TXT",
        "TTL": 1800,
        "ResourceRecords": [{ "Value": "\"${TOKEN}\"" }]
      }
    }
JSON
)

for t in $DKIM; do
  CAMBIOS="$CAMBIOS,$(cat <<JSON
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${t}._domainkey.${DOMINIO}",
        "Type": "CNAME",
        "TTL": 1800,
        "ResourceRecords": [{ "Value": "${t}.dkim.amazonses.com" }]
      }
    }
JSON
)"
done

# ── Lo que decide si el correo cae en spam ─────────────────────────────────
#
#   SPF        dice quién puede enviar como nosotros. Sin él, cualquier
#              receptor tiene que fiarse a ciegas. `~all` (softfail) y no
#              `-all`: con un dominio nuevo, rechazar en duro lo que no
#              cuadre se paga en correo perdido antes de que nadie lo note.
#
#   SPF del    El sobre sale por `correo.kustto.com.mx`, así que ESE es el
#   sobre      dominio contra el que se comprueba SPF. Necesita el suyo.
#
#   MX del     SES exige un MX en el subdominio del sobre para aceptar los
#   sobre      rebotes. Sin él, el MAIL FROM se queda en `Pending` y nunca
#              entra en vigor.
#
#   DMARC      Le dice al receptor qué hacer cuando algo no alinea. Gmail lo
#              pide desde 2024. Empieza en `p=none` —observar, no bloquear—
#              porque endurecerlo en un dominio recién nacido tira correo
#              legítimo sin que nadie se entere. Se sube a `quarantine`
#              cuando lleve semanas mandando sin incidencias.
CAMBIOS="$CAMBIOS,$(cat <<JSON
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMINIO}",
        "Type": "TXT",
        "TTL": 1800,
        "ResourceRecords": [{ "Value": "\"v=spf1 include:amazonses.com ~all\"" }]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${SOBRE}",
        "Type": "TXT",
        "TTL": 1800,
        "ResourceRecords": [{ "Value": "\"v=spf1 include:amazonses.com ~all\"" }]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${SOBRE}",
        "Type": "MX",
        "TTL": 1800,
        "ResourceRecords": [{ "Value": "10 feedback-smtp.${REGION}.amazonses.com" }]
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_dmarc.${DOMINIO}",
        "Type": "TXT",
        "TTL": 1800,
        "ResourceRecords": [{ "Value": "\"v=DMARC1; p=none; adkim=r; aspf=r\"" }]
      }
    }
JSON
)"

CAMBIOS="$CAMBIOS ] }"

# En línea y no con `file://`: el CLI de Windows no entiende las rutas de Git
# Bash, y cuatro registros caben de sobra en un argumento.
echo "Poniendo el TXT de verificación y los tres DKIM…"
aws_ route53 change-resource-record-sets --hosted-zone-id "$ZONA" \
  --change-batch "$CAMBIOS" >/dev/null

# ── El bucket del correo ───────────────────────────────────────────────────
# Aparte de los otros dos a propósito: el correo entrante es de nadie más y
# mezclarlo con lo público o con lo privado del producto sólo trae sustos.
if ! aws_ s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  echo "Creando el bucket $BUCKET…"
  aws_ s3api create-bucket --bucket "$BUCKET" >/dev/null

  aws_ s3api put-public-access-block --bucket "$BUCKET" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  aws_ s3api put-bucket-encryption --bucket "$BUCKET" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

  aws_ s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
    --lifecycle-configuration "{
      \"Rules\": [{
        \"ID\": \"caducar-correo\",
        \"Status\": \"Enabled\",
        \"Filter\": { \"Prefix\": \"${PREFIJO}\" },
        \"Expiration\": { \"Days\": ${DIAS_RETENCION} }
      }]
    }"
fi

# La condición de SourceAccount NO es decorativa: sin ella, el permiso deja
# que CUALQUIER cuenta de AWS use SES para escribir en este bucket.
echo "Dando permiso a SES para escribir…"
aws_ s3api put-bucket-policy --bucket "$BUCKET" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Sid\": \"SesEscribeElCorreo\",
    \"Effect\": \"Allow\",
    \"Principal\": { \"Service\": \"ses.amazonaws.com\" },
    \"Action\": \"s3:PutObject\",
    \"Resource\": \"arn:aws:s3:::${BUCKET}/${PREFIJO}*\",
    \"Condition\": {
      \"StringEquals\": { \"aws:SourceAccount\": \"${CUENTA}\" }
    }
  }]
}"

cat > infra/.correo <<EOF
KUSTTO_DOMINIO=$DOMINIO
KUSTTO_BUCKET_CORREO=$BUCKET
KUSTTO_PREFIJO_CORREO=$PREFIJO
EOF

ESTADO=$(aws_ ses get-identity-verification-attributes --identities "$DOMINIO" \
  --query "VerificationAttributes.\"${DOMINIO}\".VerificationStatus" --output text)

echo
echo "Listo."
echo "  dominio      : $DOMINIO ($ESTADO)"
echo "  bucket       : $BUCKET, prefijo $PREFIJO, caduca a los $DIAS_RETENCION días"
echo "  guardado en  : infra/.correo"
echo
echo "La verificación tarda unos minutos en pasar a Success. Mientras tanto,"
echo "sigue con infra/lambda-correo.sh: la regla se puede crear ya."
