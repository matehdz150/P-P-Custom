#!/usr/bin/env bash
#
# El pool de Cognito para los COMPRADORES. Es otro, no el de los talleres.
#
#   bash infra/cognito-compradores.sh
#
# Idempotente. Corre en dos fases y la primera no necesita nada tuyo:
#
#   1. Sin infra/.google  -> crea el pool, el dominio y el cliente, e imprime
#      la URI de redirección que hay que pegar en la consola de Google.
#   2. Con infra/.google  -> además engancha Google como proveedor de
#      identidad y lo añade al cliente.
#
# DECISIONES QUE QUEDAN GRABADAS AQUÍ
#
#   UN POOL APARTE, y es lo más importante del archivo. El autorizador JWT de
#   /proveedores/* valida emisor y audiencia, NO grupos. Si los compradores
#   sacaran su token del pool de talleres, ese token pasaría el autorizador y
#   lo único que separaría a un comprador de un taller serían comprobaciones
#   dentro del handler. Separarlos aquí lo hace imposible por construcción.
#
#   CON AUTOREGISTRO (AllowAdminCreateUserOnly=false). Es justo lo contrario
#   del pool de talleres, y a propósito: al taller lo damos de alta nosotros,
#   el comprador se registra solo.
#
#   CON USER_PASSWORD_AUTH, y no era el plan original. La idea era mandar
#   también el correo a la interfaz alojada de Cognito para no tener nunca un
#   formulario de contraseña nuestro. Se descartó porque esa pantalla es
#   genérica y fea, y la primera impresión de una tienda no puede serlo.
#
#   Así que el correo entra por una pantalla nuestra (/cuenta/entrar), igual
#   que el login del taller. Google NO usa este flujo: va por redirección con
#   PKCE directo a Google, saltándose la pantalla de Cognito con
#   `identity_provider=Google`. La interfaz alojada nunca se le enseña a nadie.
#
#   CLIENTE SIN SECRETO. Lo usa el navegador, y un secreto en el navegador no
#   es un secreto. Con PKCE el código de autorización no sirve robado.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

POOL_NOMBRE="${KUSTTO_POOL_COMPRADORES:-kustto-compradores}"
CLIENTE_NOMBRE="${POOL_NOMBRE}-web"
PREFIJO_BASE="${KUSTTO_DOMINIO_AUTH:-kustto-cuentas}"
SALIDA="infra/.cognito-compradores"
SECRETOS="infra/.google"

# A dónde vuelve el navegador después de entrar. Cognito exige que estén
# listadas exactamente: una que no esté aquí se rechaza con redirect_mismatch,
# que no se parece en nada a un problema de configuración.
CALLBACKS=(
  "http://localhost:3000/cuenta/callback"
  "https://kustto.com.mx/cuenta/callback"
  "https://www.kustto.com.mx/cuenta/callback"
)

LOGOUTS=(
  "http://localhost:3000/"
  "https://kustto.com.mx/"
  "https://www.kustto.com.mx/"
)

# ─── El pool ────────────────────────────────────────────────────────────────

POOL_ID=$(aws_ cognito-idp list-user-pools --max-results 60 \
  --query "UserPools[?Name=='${POOL_NOMBRE}'].Id | [0]" --output text)

if [ "$POOL_ID" = "None" ] || [ -z "$POOL_ID" ]; then
  echo "Creando pool $POOL_NOMBRE…"
  POOL_ID=$(aws_ cognito-idp create-user-pool \
    --pool-name "$POOL_NOMBRE" \
    --username-attributes email \
    --auto-verified-attributes email \
    --admin-create-user-config "AllowAdminCreateUserOnly=false" \
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

# ─── El dominio de la interfaz alojada ──────────────────────────────────────
#
# Hace falta para Google: la URI de redirección que Google exige cuelga de
# este dominio. El prefijo es único por región en TODA la cuenta de AWS, no
# sólo en la nuestra, así que puede estar tomado por un desconocido.

DOMINIO=$(aws_ cognito-idp describe-user-pool --user-pool-id "$POOL_ID" \
  --query "UserPool.Domain" --output text)

if [ "$DOMINIO" = "None" ] || [ -z "$DOMINIO" ]; then
  for intento in "" -2 -3 -4 -5; do
    CANDIDATO="${PREFIJO_BASE}${intento}"

    DUENO=$(aws_ cognito-idp describe-user-pool-domain --domain "$CANDIDATO" \
      --query "DomainDescription.UserPoolId" --output text 2>/dev/null || echo "None")

    if [ "$DUENO" = "None" ] || [ -z "$DUENO" ]; then
      echo "Creando dominio $CANDIDATO…"
      aws_ cognito-idp create-user-pool-domain \
        --domain "$CANDIDATO" --user-pool-id "$POOL_ID" >/dev/null
      DOMINIO="$CANDIDATO"
      break
    fi

    echo "  $CANDIDATO ya está tomado, probando el siguiente…"
  done
fi

if [ "$DOMINIO" = "None" ] || [ -z "$DOMINIO" ]; then
  echo "No pude reservar un dominio. Pasa otro con KUSTTO_DOMINIO_AUTH=…" >&2
  exit 1
fi

BASE_AUTH="https://${DOMINIO}.auth.${REGION}.amazoncognito.com"
REDIRECT="${BASE_AUTH}/oauth2/idpresponse"

# ─── Google, si ya tenemos las credenciales ─────────────────────────────────
#
# El secreto sale de un archivo que NUNCA se imprime ni entra al repo. Google
# sólo lo enseña al crear el cliente: si se pierde, se rota en su consola.

PROVEEDORES=(COGNITO)

if [ -f "$SECRETOS" ]; then
  # shellcheck disable=SC1090
  source "$SECRETOS"

  if [ -z "${GOOGLE_CLIENTE:-}" ] || [ -z "${GOOGLE_SECRETO:-}" ]; then
    echo "$SECRETOS existe pero le falta GOOGLE_CLIENTE o GOOGLE_SECRETO." >&2
    exit 1
  fi

  DETALLES="client_id=${GOOGLE_CLIENTE},client_secret=${GOOGLE_SECRETO},authorize_scopes=openid email profile"

  # email_verified se mapea a propósito. Sin él el usuario federado entra como
  # no verificado, y el correo verificado es lo que ata un pedido a su dueño:
  # confiar en uno sin comprobar deja que alguien se registre con el correo de
  # otro y le lea sus pedidos.
  MAPEO="email=email,email_verified=email_verified,name=name,username=sub"

  EXISTE=$(aws_ cognito-idp list-identity-providers --user-pool-id "$POOL_ID" \
    --max-results 60 \
    --query "Providers[?ProviderName=='Google'].ProviderName | [0]" --output text)

  if [ "$EXISTE" = "None" ] || [ -z "$EXISTE" ]; then
    echo "Enganchando Google…"
    aws_ cognito-idp create-identity-provider \
      --user-pool-id "$POOL_ID" \
      --provider-name Google \
      --provider-type Google \
      --provider-details "$DETALLES" \
      --attribute-mapping "$MAPEO" >/dev/null
  else
    echo "Actualizando Google…"
    aws_ cognito-idp update-identity-provider \
      --user-pool-id "$POOL_ID" \
      --provider-name Google \
      --provider-details "$DETALLES" \
      --attribute-mapping "$MAPEO" >/dev/null
  fi

  PROVEEDORES=(COGNITO Google)
fi

# ─── El cliente ─────────────────────────────────────────────────────────────
#
# `update-user-pool-client` SUSTITUYE la configuración entera, igual que
# `update-function-configuration` con el entorno de una Lambda. Por eso los
# ajustes comunes viven en un array y se pasan tanto al crear como al
# actualizar: escritos dos veces acaban divergiendo, y se descubre tarde.

COMUNES=(
  --callback-urls "${CALLBACKS[@]}"
  --logout-urls "${LOGOUTS[@]}"
  --allowed-o-auth-flows code
  --allowed-o-auth-scopes openid email profile
  --allowed-o-auth-flows-user-pool-client
  --supported-identity-providers "${PROVEEDORES[@]}"
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH
  --access-token-validity 1
  --id-token-validity 1
  --refresh-token-validity 30
  --token-validity-units "AccessToken=hours,IdToken=hours,RefreshToken=days"
  # Sin esto, Cognito contesta distinto a un correo que existe y a uno que no,
  # y eso es una lista de clientes para quien quiera pedirla.
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

# ─── Lo que necesita el front ───────────────────────────────────────────────
#
# Nada de esto es secreto: el id del pool, el del cliente y el dominio viajan
# al navegador por diseño. Está fuera del repo sólo por ser generado.

cat > "$SALIDA" <<EOF
KUSTTO_COMPRADORES_POOL=$POOL_ID
KUSTTO_COMPRADORES_CLIENTE=$CLIENTE_ID
KUSTTO_COMPRADORES_DOMINIO=$BASE_AUTH
EOF

echo
echo "Pool de compradores listo."
echo "  pool    : $POOL_ID"
echo "  cliente : $CLIENTE_ID"
echo "  dominio : $BASE_AUTH"
echo "  guardado en $SALIDA"

if [ ! -f "$SECRETOS" ]; then
  cat <<EOF

────────────────────────────────────────────────────────────────────────
Falta Google. En console.cloud.google.com:

  1. Proyecto nuevo.
  2. APIs & Services -> OAuth consent screen -> External.
     Nace en "Testing": ahí SOLO entran los correos que listes a mano.
     Con openid/email/profile no hay revisión de Google, así que puedes
     pulsar "Publish app" en cuanto quieras abrirlo a cualquiera.
  3. Credentials -> Create credentials -> OAuth client ID -> Web application.
  4. En "Authorized redirect URIs" pega EXACTAMENTE esto:

       $REDIRECT

  5. Guarda el id y el secreto aquí (el archivo ya está en .gitignore):

       printf 'GOOGLE_CLIENTE=...\\nGOOGLE_SECRETO=...\\n' > $SECRETOS

  6. Vuelve a correr este script. Engancha Google y no toca nada más.
────────────────────────────────────────────────────────────────────────
EOF
fi
