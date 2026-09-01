#!/usr/bin/env bash
#
# El pool de Cognito para los proveedores.
#
#   bash infra/cognito.sh
#
# Idempotente: si ya existe no lo toca, solo imprime los identificadores.
#
# DECISIONES QUE QUEDAN GRABADAS AQUÍ
#
#   Sin autoregistro. Los talleres no se dan de alta solos: los crea el
#   admin. Por eso AllowAdminCreateUserOnly=true — sin eso, cualquiera con
#   la URL se registra como proveedor.
#
#   Cliente sin secreto. Lo usa el navegador, y un secreto en el navegador
#   no es un secreto. La seguridad la da el pool, no un string escondido.
#
#   Sin ALLOW_USER_SRP_AUTH todavía: el login va con usuario y contraseña
#   directo (USER_PASSWORD_AUTH), que es lo que sabe hacer el front hoy.
#   SRP es más robusto y es el siguiente paso natural.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

POOL_NOMBRE="${KUSTTO_POOL:-kustto-proveedores}"
CLIENTE_NOMBRE="${POOL_NOMBRE}-web"
SALIDA="infra/.cognito"

POOL_ID=$(aws_ cognito-idp list-user-pools --max-results 60 \
  --query "UserPools[?Name=='${POOL_NOMBRE}'].Id | [0]" --output text)

if [ "$POOL_ID" = "None" ] || [ -z "$POOL_ID" ]; then
  echo "Creando pool $POOL_NOMBRE…"
  POOL_ID=$(aws_ cognito-idp create-user-pool \
    --pool-name "$POOL_NOMBRE" \
    --username-attributes email \
    --auto-verified-attributes email \
    --admin-create-user-config "AllowAdminCreateUserOnly=true" \
    --policies '{
      "PasswordPolicy": {
        "MinimumLength": 10,
        "RequireUppercase": false,
        "RequireLowercase": true,
        "RequireNumbers": true,
        "RequireSymbols": false,
        "TemporaryPasswordValidityDays": 7
      }
    }' \
    --schema '[
      {"Name":"name","AttributeDataType":"String","Mutable":true,"Required":true}
    ]' \
    --query "UserPool.Id" --output text)
fi

CLIENTE_ID=$(aws_ cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" \
  --max-results 60 \
  --query "UserPoolClients[?ClientName=='${CLIENTE_NOMBRE}'].ClientId | [0]" \
  --output text)

if [ "$CLIENTE_ID" = "None" ] || [ -z "$CLIENTE_ID" ]; then
  echo "Creando cliente $CLIENTE_NOMBRE…"
  CLIENTE_ID=$(aws_ cognito-idp create-user-pool-client \
    --user-pool-id "$POOL_ID" \
    --client-name "$CLIENTE_NOMBRE" \
    --no-generate-secret \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --access-token-validity 1 \
    --id-token-validity 1 \
    --refresh-token-validity 30 \
    --token-validity-units "AccessToken=hours,IdToken=hours,RefreshToken=days" \
    --query "UserPoolClient.ClientId" --output text)
fi

# Estos dos NO son secretos: el id del pool y el del cliente viajan al
# navegador por diseño. Se guardan para que los demás scripts los lean.
cat > "$SALIDA" <<EOF
KUSTTO_POOL_ID=$POOL_ID
KUSTTO_POOL_CLIENTE=$CLIENTE_ID
EOF

echo
echo "Pool listo."
echo "  pool    : $POOL_ID"
echo "  cliente : $CLIENTE_ID"
echo "  guardado en $SALIDA"
