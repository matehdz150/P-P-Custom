#!/usr/bin/env bash
#
# El pool de Cognito para el BACKOFFICE. Es un tercer pool, no uno de los dos
# que ya hay.
#
#   bash infra/cognito-admin.sh
#
# Idempotente: crea lo que falte y actualiza lo que exista.
#
# DECISIONES QUE QUEDAN GRABADAS AQUÍ
#
#   UN TERCER POOL, y es lo más importante del archivo. El autorizador JWT de
#   API Gateway valida EMISOR Y AUDIENCIA, no grupos. Con un solo pool para
#   todos, el token de cualquier comprador registrado pasaría el autorizador de
#   /admin/* y lo único que lo separaría del backoffice serían comprobaciones
#   dentro del handler — o sea, que alguien se acuerde. Con un pool por público
#   eso es imposible por construcción, que es la misma razón por la que los
#   compradores no comparten pool con los talleres.
#
#   SIN AUTOREGISTRO (AllowAdminCreateUserOnly=true). Al revés que el de
#   compradores y como el de talleres: aquí no se apunta nadie solo. Los
#   administradores se dan de alta con `crear-admin.sh`.
#
#   SIN DOMINIO NI INTERFAZ ALOJADA. No hay Google ni redirecciones que
#   registrar: se entra por una pantalla nuestra con correo y contraseña, así
#   que no hace falta reservar un prefijo de dominio en Cognito.
#
#   SESIÓN CORTA: 1 hora de acceso y 1 DÍA de refresco, contra los 30 días de
#   un comprador. Un panel que puede aprobar productos y ver a todos los
#   talleres no tiene por qué seguir abierto en un portátil una semana después.
#
#   CONTRASEÑA MÁS LARGA que la de los otros pools: 12 con símbolos. Son pocas
#   cuentas y las creamos nosotros, así que el coste de exigir más es cero.
#
#   CLIENTE SIN SECRETO. Lo usa el navegador, y un secreto en el navegador no
#   es un secreto.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

POOL_NOMBRE="${KUSTTO_POOL_ADMIN:-kustto-admins}"
CLIENTE_NOMBRE="${POOL_NOMBRE}-web"
SALIDA="infra/.cognito-admin"

# ─── El pool ────────────────────────────────────────────────────────────────

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
        "MinimumLength": 12,
        "RequireUppercase": true,
        "RequireLowercase": true,
        "RequireNumbers": true,
        "RequireSymbols": true,
        "TemporaryPasswordValidityDays": 7
      }
    }' \
    --schema '[
      {"Name":"name","AttributeDataType":"String","Mutable":true,"Required":true}
    ]' \
    --query "UserPool.Id" --output text)
fi

# ─── El cliente ─────────────────────────────────────────────────────────────
#
# Los ajustes comunes viven en un array y se pasan tanto al crear como al
# actualizar: escritos dos veces acaban divergiendo, y se descubre tarde.
#
# SIN `--allowed-o-auth-flows`: este cliente no usa la interfaz alojada, así
# que no hay flujo OAuth que declarar. Sólo correo y contraseña.

COMUNES=(
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH
  --access-token-validity 1
  --id-token-validity 1
  --refresh-token-validity 1
  --token-validity-units "AccessToken=hours,IdToken=hours,RefreshToken=days"
  # Sin esto, Cognito contesta distinto a un correo que existe y a uno que no.
  # En un backoffice eso es peor que en la tienda: dice quién administra esto.
  --prevent-user-existence-errors ENABLED
)

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
    "${COMUNES[@]}" \
    --query "UserPoolClient.ClientId" --output text)
else
  aws_ cognito-idp update-user-pool-client \
    --user-pool-id "$POOL_ID" \
    --client-id "$CLIENTE_ID" \
    --client-name "$CLIENTE_NOMBRE" \
    "${COMUNES[@]}" >/dev/null
fi

# ─── Lo que necesitan el front y el despliegue ──────────────────────────────
#
# Nada de esto es secreto: el id del pool y el del cliente viajan al navegador
# por diseño. Está fuera del repo sólo por ser generado.

cat > "$SALIDA" <<EOF
KUSTTO_ADMIN_POOL=$POOL_ID
KUSTTO_ADMIN_CLIENTE=$CLIENTE_ID
EOF

echo
echo "Pool de admins listo."
echo "  pool    : $POOL_ID"
echo "  cliente : $CLIENTE_ID"
echo "  guardado en $SALIDA"
echo
echo "No tiene autoregistro. Para dar de alta a alguien:"
echo "  bash infra/crear-admin.sh tu@correo.com"
