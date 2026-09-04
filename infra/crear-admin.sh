#!/usr/bin/env bash
#
# Da de alta a un administrador en el pool del backoffice.
#
#   bash infra/crear-admin.sh alguien@kustto.com.mx
#
# Idempotente: si la cuenta ya existe no la toca, sólo lo dice. Para cambiarle
# la contraseña a alguien que ya está, ver el final del archivo.
#
# LA CONTRASEÑA ES TEMPORAL Y LA GENERA COGNITO, no este script: una que
# eligiéramos nosotros acabaría en el historial del terminal. Cognito la manda
# por correo y obliga a cambiarla al primer acceso.
#
# POR QUÉ NO HAY AUTOREGISTRO. El pool nace con `AllowAdminCreateUserOnly`, así
# que este script es la única puerta. Es a propósito: un backoffice donde
# cualquiera pueda apuntarse no es un backoffice.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh
source infra/.cognito-admin

CORREO="${1:-}"
NOMBRE="${2:-}"

if [ -z "$CORREO" ]; then
  echo "Falta el correo." >&2
  echo "  bash infra/crear-admin.sh alguien@kustto.com.mx [\"Nombre Apellido\"]" >&2
  exit 1
fi

# El nombre es obligatorio en el esquema del pool; si no lo pasas, se usa la
# parte del correo antes de la arroba para no obligar a escribirlo dos veces.
if [ -z "$NOMBRE" ]; then
  NOMBRE="${CORREO%%@*}"
fi

YA=$(aws_ cognito-idp admin-get-user \
  --user-pool-id "$KUSTTO_ADMIN_POOL" \
  --username "$CORREO" \
  --query "UserStatus" --output text 2>/dev/null || echo "")

if [ -n "$YA" ]; then
  echo "$CORREO ya existe en el pool (estado: $YA). No se toca."
  echo
  echo "Para ponerle una contraseña nueva y permanente:"
  echo "  aws cognito-idp admin-set-user-password \\"
  echo "    --user-pool-id $KUSTTO_ADMIN_POOL \\"
  echo "    --username $CORREO --password '…' --permanent \\"
  echo "    --profile ${PERFIL} --region ${REGION}"
  exit 0
fi

echo "Creando $CORREO…"
aws_ cognito-idp admin-create-user \
  --user-pool-id "$KUSTTO_ADMIN_POOL" \
  --username "$CORREO" \
  --user-attributes \
    "Name=email,Value=$CORREO" \
    "Name=email_verified,Value=true" \
    "Name=name,Value=$NOMBRE" \
  --desired-delivery-mediums EMAIL >/dev/null

echo
echo "Listo. Cognito le mandó una contraseña temporal a $CORREO."
echo "Al entrar por primera vez en el backoffice tendrá que cambiarla."
