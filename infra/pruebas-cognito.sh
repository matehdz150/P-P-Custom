#!/usr/bin/env bash
# Pool de compradores exclusivo del entorno de pruebas.
# No tiene autoregistro, dominio alojado ni proveedores sociales.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

PREFIJO="${KUSTTO_TEST_PREFIX:-kustto-test}"
POOL_NOMBRE="${KUSTTO_TEST_BUYERS_POOL_NAME:-${PREFIJO}-compradores}"
CLIENTE_NOMBRE="${POOL_NOMBRE}-web"
SALIDA="infra/.pruebas-cognito"

POOL_ID=$(aws_ cognito-idp list-user-pools --max-results 60 \
  --query "UserPools[?Name=='${POOL_NOMBRE}'].Id | [0]" --output text)

if [ "$POOL_ID" = "None" ] || [ -z "$POOL_ID" ]; then
  echo "Creando pool aislado ${POOL_NOMBRE}…"
  POOL_ID=$(aws_ cognito-idp create-user-pool \
    --pool-name "$POOL_NOMBRE" \
    --username-attributes email \
    --auto-verified-attributes email \
    --admin-create-user-config "AllowAdminCreateUserOnly=true" \
    --policies '{
      "PasswordPolicy": {
        "MinimumLength": 12,
        "RequireUppercase": true,
        "RequireLowercase": true,
        "RequireNumbers": true,
        "RequireSymbols": false,
        "TemporaryPasswordValidityDays": 1
      }
    }' \
    --schema '[
      {"Name":"name","AttributeDataType":"String","Mutable":true,"Required":true}
    ]' \
    --user-pool-tags Environment=test,Application=kustto,ManagedBy=infra-pruebas-api \
    --query UserPool.Id --output text)
fi

CLIENTE_ID=$(aws_ cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" \
  --max-results 60 \
  --query "UserPoolClients[?ClientName=='${CLIENTE_NOMBRE}'].ClientId | [0]" \
  --output text)

COMUNES=(
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
  --access-token-validity 1
  --id-token-validity 1
  --refresh-token-validity 1
  --token-validity-units "AccessToken=hours,IdToken=hours,RefreshToken=days"
  --prevent-user-existence-errors ENABLED
)

if [ "$CLIENTE_ID" = "None" ] || [ -z "$CLIENTE_ID" ]; then
  CLIENTE_ID=$(aws_ cognito-idp create-user-pool-client \
    --user-pool-id "$POOL_ID" \
    --client-name "$CLIENTE_NOMBRE" \
    --no-generate-secret \
    "${COMUNES[@]}" \
    --query UserPoolClient.ClientId --output text)
else
  aws_ cognito-idp update-user-pool-client \
    --user-pool-id "$POOL_ID" \
    --client-id "$CLIENTE_ID" \
    --client-name "$CLIENTE_NOMBRE" \
    "${COMUNES[@]}" >/dev/null
fi

printf '%s\n' \
  "KUSTTO_TEST_COMPRADORES_POOL=${POOL_ID}" \
  "KUSTTO_TEST_COMPRADORES_CLIENTE=${CLIENTE_ID}" \
  > "$SALIDA"

echo "Pool de compradores de pruebas listo: $POOL_ID"
