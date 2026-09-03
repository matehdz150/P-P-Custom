#!/usr/bin/env bash
#
# Mandar correo desde kustto con el SES de la cuenta root.
#
#   bash infra/correo-envio.sh
#
# POR QUÉ EXISTE ESTO
#
# `kustto.com.mx` está verificado en DOS cuentas y sólo una sirve para enviar
# de verdad:
#
#   218897024535  kustto-admin   la app entera. SES en SANDBOX: 200/día y sólo
#                                a direcciones verificadas a mano.
#   467685081574  la cuenta root ACCESO A PRODUCCIÓN: 50 000/día, 14/s, y la
#                                identidad kustto.com.mx ya verificada ahí.
#
# LO QUE NO FUNCIONA, Y SE PROBÓ
#
# SES deja que una cuenta envíe usando la identidad verificada de otra
# (`FromEmailAddressIdentityArn`, lo que llaman "sending authorization"). Suena
# a la solución, y no lo es: **la cuota y el sandbox son los de quien LLAMA**,
# no los del dueño de la identidad. Con eso montado, el envío se contaba en la
# cuenta de la app y seguía rechazando cualquier destinatario sin verificar.
#
# LO QUE SÍ
#
# Un rol en la cuenta root que las Lambdas asumen. Así quien llama a SES es la
# cuenta root, y con ella su acceso a producción.
#
# HACEN FALTA LOS DOS LADOS
#
#   1. En la cuenta root: el rol, con las Lambdas en su relación de confianza.
#   2. En la cuenta de la app: permiso en cada rol para asumirlo.
#
# Con uno solo no funciona, y el error dice "no autorizado" sin aclarar cuál
# de los dos falta.
#
# LOS DKIM DE LA ZONA
#   Los tres CNAME `_domainkey` que hay en Route53 son los de ESTA identidad,
#   la de la cuenta root. Durante un tiempo se anotaron como "tokens viejos de
#   una identidad borrada" y no lo son: son los que hacen que lo que mandemos
#   vaya firmado. NO SE BORRAN.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

# El perfil de la cuenta que TIENE la identidad y el acceso a producción.
PERFIL_RAIZ="${KUSTTO_PERFIL_RAIZ:-moderateapi}"
CUENTA_RAIZ="${KUSTTO_CUENTA_RAIZ:-467685081574}"
DOMINIO="${KUSTTO_DOMINIO_CORREO:-kustto.com.mx}"
SALIDA="infra/.correo-envio"

IDENTIDAD="arn:aws:ses:${REGION}:${CUENTA_RAIZ}:identity/${DOMINIO}"

CUENTA=$(aws_ sts get-caller-identity --query Account --output text)

raiz() {
  aws --profile "$PERFIL_RAIZ" --region "$REGION" "$@"
}

# ── Comprobar que la cuenta root es la que creemos ────────────────────────
REAL=$(raiz sts get-caller-identity --query Account --output text)
if [ "$REAL" != "$CUENTA_RAIZ" ]; then
  echo "El perfil $PERFIL_RAIZ es la cuenta $REAL, no $CUENTA_RAIZ." >&2
  exit 1
fi

ESTADO=$(raiz sesv2 get-email-identity --email-identity "$DOMINIO" \
  --query "VerificationStatus" --output text 2>/dev/null || echo "FALTA")

if [ "$ESTADO" != "SUCCESS" ]; then
  echo "La identidad $DOMINIO no está verificada en $CUENTA_RAIZ (está: $ESTADO)." >&2
  exit 1
fi

# ── 1 · Un rol en la cuenta root que las Lambdas puedan asumir ────────────
#
# NO basta con autorizar la identidad. Se probó: SES deja enviar con la
# identidad verificada de otra cuenta (`FromEmailAddressIdentityArn`), pero la
# CUOTA Y EL SANDBOX son los de quien llama. El envío se contaba en la cuenta
# de la app y seguía rechazando destinatarios sin verificar.
#
# Asumiendo un rol allá, quien llama a SES es la cuenta root, y con ella su
# acceso a producción.
ROL_CORREO="kustto-correo"
ROL_ARN="arn:aws:iam::${CUENTA_RAIZ}:role/${ROL_CORREO}"

# Se confía en los roles uno a uno, no en la cuenta entera: con
# "arn:aws:iam::CUENTA:root" cualquier cosa que corra en la cuenta de la app
# podría enviar como kustto.com.mx, hoy y en el futuro.
CONFIANZA=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::${CUENTA}:role/kustto-admin-rol",
          "arn:aws:iam::${CUENTA}:role/kustto-proveedores-rol"
        ]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON
)

if raiz iam get-role --role-name "$ROL_CORREO" >/dev/null 2>&1; then
  raiz iam update-assume-role-policy --role-name "$ROL_CORREO" \
    --policy-document "$CONFIANZA"
else
  echo "Creando el rol $ROL_CORREO en $CUENTA_RAIZ…"
  raiz iam create-role --role-name "$ROL_CORREO" \
    --assume-role-policy-document "$CONFIANZA" \
    --description "Deja a las Lambdas de kustto enviar con el SES de esta cuenta" >/dev/null
  echo "Esperando a que IAM propague el rol…"
  sleep 12
fi

raiz iam put-role-policy --role-name "$ROL_CORREO" --policy-name enviar \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      { "Effect": "Allow", "Action": ["ses:SendEmail", "ses:SendRawEmail"], "Resource": "*" }
    ]
  }'

# ── 2 · Las Lambdas de kustto pueden asumirlo ─────────────────────────────
#
# En una política aparte de `datos`: `lambda-admin.sh` reescribe `datos` entera
# en cada despliegue y esto se perdería.
for ROL in kustto-admin-rol kustto-proveedores-rol; do
  aws_ iam put-role-policy --role-name "$ROL" --policy-name correo \
    --policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [
        {
          \"Effect\": \"Allow\",
          \"Action\": \"sts:AssumeRole\",
          \"Resource\": \"${ROL_ARN}\"
        }
      ]
    }"
done

cat > "$SALIDA" <<EOF
KUSTTO_CORREO_ROL=$ROL_ARN
KUSTTO_CORREO_DE=hola@$DOMINIO
EOF

echo
echo "Envío desde la cuenta root listo."
echo "  rol       : $ROL_ARN"
echo "  lo asumen : kustto-admin-rol, kustto-proveedores-rol"
echo "  remitente : hola@$DOMINIO"
echo "  guardado en $SALIDA"
echo
echo "Las Lambdas asumen ese rol para llamar a SES. Llamando con las suyas"
echo "vuelve el sandbox de esta cuenta: 200/día y sólo a direcciones verificadas."
