#!/usr/bin/env bash
#
# Despliega la Lambda de admin detrás de API Gateway.
#
#   bash infra/lambda-admin.sh
#
# Es idempotente: la primera vez crea todo, las siguientes solo actualiza el
# código. Se puede correr en cada cambio.
#
# LA LLAVE DE ADMIN
#   Se genera sola la primera vez y se guarda en services/admin/.clave-admin,
#   que está en .gitignore. Nunca se imprime en pantalla ni viaja al repo.
#   El front la manda en el header x-clave-admin.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

FUNCION="${KUSTTO_LAMBDA_ADMIN:-kustto-admin}"
ROL="${FUNCION}-rol"
API="${FUNCION}-api"
TABLA="${KUSTTO_TABLA:-kustto-prod}"
PUBLICO="${KUSTTO_BUCKET_PUBLICO:-kustto-publico-prod}"
ORIGEN="${KUSTTO_ORIGEN:-http://localhost:3000}"
# Los orígenes que pueden llamar a la API. Son varios desde que el sitio vive
# en su dominio: el de desarrollo y los dos de produccion. Se manda como JSON
# y no con la forma corta del CLI porque ahi las comas separan CLAVES, y una
# lista de origenes se interpretaria como otros campos.
ORIGENES="${KUSTTO_ORIGENES:-http://localhost:3000,https://kustto.com.mx,https://www.kustto.com.mx}"
CORS_JSON=$(python3 - "$ORIGENES" <<'PYCORS'
import json, sys
print(json.dumps({
    "AllowOrigins": sys.argv[1].split(","),
    "AllowMethods": ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    "AllowHeaders": ["content-type", "x-clave-admin", "authorization"],
    "MaxAge": 300,
}))
PYCORS
)
ARCHIVO_CLAVE="services/admin/.clave-admin"

# Las paqueterías que se pueden OFRECER en el checkout.
#
# Cotizar no es poder despachar: si la credencial de la paquetería no está dada
# de alta en Skydropx, la guía se compra y muere con "Credential ... was not
# found in cache", con el pedido ya cobrado. Pasó con ampm y con tresguerras;
# sólo Paquetexpress generó etiqueta.
#
# Vacío = se ofrecen todas. Cuando estén dadas de alta las demás credenciales,
# esto se vacía y vuelven a salir todas:
#     KUSTTO_PAQUETERIAS= bash infra/lambda-admin.sh
SKYDROPX_PAQUETERIAS="${KUSTTO_PAQUETERIAS-paquetexpress}"


CUENTA=$(aws_ sts get-caller-identity --query Account --output text)

# El pool de proveedores, si ya se creó con infra/cognito.sh.
if [ -f infra/.cognito ]; then
  source infra/.cognito
fi
POOL_ID="${KUSTTO_POOL_ID:-}"

# Skydropx, si ya hay credenciales. Sin ellas la función arranca igual y todo
# sigue andando salvo cotizar, que devuelve "este taller no tiene envíos
# configurados" y deja al checkout con la opción de recoger.
if [ -f infra/.skydropx ]; then
  source infra/.skydropx
fi

# El secreto con el que se firma el webhook de rastreo. Vive aparte porque no
# lo da Skydropx: lo elegimos nosotros y se pega en su panel.
# El rol de la cuenta root que las Lambdas asumen para enviar correo: es la
# cuenta que tiene acceso a producción. Sin esto no se manda nada.
# Lo monta infra/correo-envio.sh.
if [ -f infra/.correo-envio ]; then
  source infra/.correo-envio
fi

if [ -f infra/.skydropx-webhook ]; then
  source infra/.skydropx-webhook
fi

if aws_ lambda get-function --function-name "$FUNCION" >/dev/null 2>&1; then
  EXISTE=1
else
  EXISTE=0
fi

# El canal en vivo, si ya se creó. Ver infra/websocket.sh.
if [ -f infra/.websocket ]; then
  source infra/.websocket
  # El archivo lo escribe websocket.sh con el prefijo KUSTTO_; dentro de este
  # script la variable se llama WS_ENDPOINT.
  WS_ENDPOINT="${KUSTTO_WS_ENDPOINT:-}"
fi

# ── La llave y el pool ─────────────────────────────────────────────────────
#
# En una máquina recién clonada no existen services/admin/.clave-admin ni
# infra/.cognito, y rehacerlos a ciegas rompe cosas en silencio: una llave
# nueva deja al front hablándole a la Lambda con la vieja, y un pool vacío
# BORRA KUSTTO_POOL_ID de la función —update-function-configuration sustituye
# el entorno entero, no lo mezcla— y el alta de proveedores deja de funcionar.
#
# Por eso, si la función ya existe, lo que tiene puesto manda: el repo sólo
# aporta lo que falte.
if [ "$EXISTE" = "1" ]; then
  VIVAS=$(aws_ lambda get-function-configuration --function-name "$FUNCION" \
    --query "[Environment.Variables.KUSTTO_CLAVE_ADMIN, Environment.Variables.KUSTTO_POOL_ID, Environment.Variables.KUSTTO_WS_ENDPOINT]" \
    --output text)
  CLAVE_VIVA=$(echo "$VIVAS" | cut -f1)
  POOL_VIVO=$(echo "$VIVAS" | cut -f2)
  WS_VIVO=$(echo "$VIVAS" | cut -f3)

  # Skydropx igual que todo lo demás: si la función ya las trae y el repo no,
  # mandan las suyas. `update-function-configuration` sustituye el entorno
  # ENTERO, así que sin esto un despliegue desde una máquina sin
  # `infra/.skydropx` le borra las credenciales y cotizar deja de funcionar sin
  # un solo error a la vista.
  SKY_VIVAS=$(aws_ lambda get-function-configuration --function-name "$FUNCION" \
    --query "[Environment.Variables.SKYDROPX_HOST, Environment.Variables.SKYDROPX_CLIENT_ID, Environment.Variables.SKYDROPX_CLIENT_SECRET, Environment.Variables.SKYDROPX_WEBHOOK_SECRETO]" \
    --output text)

  # Igual que todo lo demás: si el repo no lo trae y la función sí, manda el
  # suyo. Perderlo dejaría el webhook rechazando a Skydropx en silencio.
  if [ -z "${SKYDROPX_WEBHOOK_SECRETO:-}" ]; then
    WH_VIVO=$(echo "$SKY_VIVAS" | cut -f4)
    if [ -n "$WH_VIVO" ] && [ "$WH_VIVO" != "None" ]; then
      SKYDROPX_WEBHOOK_SECRETO="$WH_VIVO"
    fi
  fi

  if [ -z "${SKYDROPX_CLIENT_ID:-}" ]; then
    SKY_ID=$(echo "$SKY_VIVAS" | cut -f2)
    if [ -n "$SKY_ID" ] && [ "$SKY_ID" != "None" ]; then
      SKYDROPX_HOST=$(echo "$SKY_VIVAS" | cut -f1)
      SKYDROPX_CLIENT_ID="$SKY_ID"
      SKYDROPX_CLIENT_SECRET=$(echo "$SKY_VIVAS" | cut -f3)
    fi
  fi

  if [ -n "$CLAVE_VIVA" ] && [ "$CLAVE_VIVA" != "None" ]; then
    if [ -f "$ARCHIVO_CLAVE" ] && [ "$(cat "$ARCHIVO_CLAVE")" != "$CLAVE_VIVA" ]; then
      echo "Aviso: $ARCHIVO_CLAVE no coincidía con la llave de la función. Gana la de la función."
    fi
    printf '%s' "$CLAVE_VIVA" > "$ARCHIVO_CLAVE"
  fi

  if [ -z "$POOL_ID" ] && [ -n "$POOL_VIVO" ] && [ "$POOL_VIVO" != "None" ]; then
    POOL_ID="$POOL_VIVO"
  fi

  # Mismo motivo que el pool: update-function-configuration sustituye el
  # entorno ENTERO. Sin conservarlo, cada despliegue del admin dejaría a la
  # función sin endpoint y los avisos en vivo se apagarían sin decir nada.
  if [ -z "${WS_ENDPOINT:-}" ] && [ -n "$WS_VIVO" ] && [ "$WS_VIVO" != "None" ]; then
    WS_ENDPOINT="$WS_VIVO"
  fi
fi

# Sólo se inventa una llave cuando no hay ninguna en ningún lado.
if [ ! -f "$ARCHIVO_CLAVE" ]; then
  head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 40 > "$ARCHIVO_CLAVE"
  echo "Llave de admin generada en $ARCHIVO_CLAVE (no se sube al repo)."
fi
CLAVE=$(cat "$ARCHIVO_CLAVE")

# ── El rol ─────────────────────────────────────────────────────────────────
if ! aws_ iam get-role --role-name "$ROL" >/dev/null 2>&1; then
  echo "Creando rol $ROL…"
  aws_ iam create-role --role-name "$ROL" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' >/dev/null

  aws_ iam attach-role-policy --role-name "$ROL" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

  echo "Esperando a que IAM propague el rol…"
  sleep 12
fi

# La política se escribe SIEMPRE, no sólo al crear el rol: dentro del `if`,
# ampliarla no surtía efecto donde el rol ya existe —justo donde hace falta—
# y el fallo aparecía como un AccessDenied en producción. `put-role-policy`
# reemplaza la política entera, así que repetirlo no hace daño.
#
# Permisos mínimos: esta tabla y este bucket, nada más.
aws_ iam put-role-policy --role-name "$ROL" --policy-name datos \
  --policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [
        {
          \"Effect\": \"Allow\",
          \"Action\": [
            \"dynamodb:GetItem\", \"dynamodb:BatchGetItem\", \"dynamodb:PutItem\",
            \"dynamodb:UpdateItem\", \"dynamodb:DeleteItem\", \"dynamodb:Query\",
            \"dynamodb:TransactWriteItems\"
          ],
          \"Resource\": [
            \"arn:aws:dynamodb:${REGION}:${CUENTA}:table/${TABLA}\",
            \"arn:aws:dynamodb:${REGION}:${CUENTA}:table/${TABLA}/index/*\"
          ]
        },
        {
          \"Effect\": \"Allow\",
          \"Action\": [\"s3:PutObject\", \"s3:GetObject\"],
          \"Resource\": \"arn:aws:s3:::${PUBLICO}/*\"
        },
        {
          \"Effect\": \"Allow\",
          \"Action\": [
            \"cognito-idp:AdminCreateUser\",
            \"cognito-idp:AdminSetUserPassword\"
          ],
          \"Resource\": \"*\"
        }
      ]
    }"

ROL_ARN=$(aws_ iam get-role --role-name "$ROL" --query "Role.Arn" --output text)

# ── El paquete ─────────────────────────────────────────────────────────────
echo "Empaquetando…"
(cd services/admin && pnpm build >/dev/null)
rm -f services/admin/admin.zip
# Git Bash en Windows no trae zip; PowerShell sí sabe comprimir.
if command -v zip >/dev/null 2>&1; then
  (cd services/admin/dist && zip -q -r ../admin.zip handler.mjs)
else
  powershell.exe -NoProfile -Command "Compress-Archive -Path services\admin\dist\handler.mjs -DestinationPath services\admin\admin.zip -Force" >/dev/null
fi

# Una variable vacía al final rompe el parser del CLI ("Expected: ',',
# received: 'EOF'"), así que las que no tienen valor no se mandan.
PARES="KUSTTO_TABLA=$TABLA,KUSTTO_BUCKET_PUBLICO=$PUBLICO,KUSTTO_CLAVE_ADMIN=$CLAVE,KUSTTO_ORIGEN=$ORIGEN"
if [ -n "$POOL_ID" ]; then
  PARES="$PARES,KUSTTO_POOL_ID=$POOL_ID"
else
  echo "Aviso: sin KUSTTO_POOL_ID. Corre infra/cognito.sh o el alta de proveedores no funcionará."
fi
if [ -n "${WS_ENDPOINT:-}" ]; then
  PARES="$PARES,KUSTTO_WS_ENDPOINT=$WS_ENDPOINT"
fi
if [ -n "${KUSTTO_CORREO_ROL:-}" ]; then
  PARES="$PARES,KUSTTO_CORREO_ROL=$KUSTTO_CORREO_ROL,KUSTTO_CORREO_DE=$KUSTTO_CORREO_DE"
else
  echo "Aviso: sin KUSTTO_CORREO_ROL. No se mandará ningún correo."
fi
if [ -n "${SKYDROPX_WEBHOOK_SECRETO:-}" ]; then
  PARES="$PARES,SKYDROPX_WEBHOOK_SECRETO=$SKYDROPX_WEBHOOK_SECRETO"
else
  echo "Aviso: sin SKYDROPX_WEBHOOK_SECRETO. El webhook de rastreo rechazará todo."
fi
if [ -n "${SKYDROPX_CLIENT_ID:-}" ]; then
  PARES="$PARES,SKYDROPX_HOST=$SKYDROPX_HOST,SKYDROPX_CLIENT_ID=$SKYDROPX_CLIENT_ID,SKYDROPX_CLIENT_SECRET=$SKYDROPX_CLIENT_SECRET,SKYDROPX_PAQUETERIAS=$SKYDROPX_PAQUETERIAS"
else
  echo "Aviso: sin credenciales de Skydropx. No se podrán cotizar envíos."
fi
VARIABLES="Variables={$PARES}"

# ── La función ─────────────────────────────────────────────────────────────
if [ "$EXISTE" = "1" ]; then
  echo "Actualizando código…"
  aws_ lambda update-function-code --function-name "$FUNCION" \
    --zip-file fileb://services/admin/admin.zip >/dev/null
  aws_ lambda wait function-updated --function-name "$FUNCION"
  aws_ lambda update-function-configuration --function-name "$FUNCION" \
    --environment "$VARIABLES" >/dev/null
  aws_ lambda wait function-updated --function-name "$FUNCION"
else
  echo "Creando función $FUNCION…"
  aws_ lambda create-function --function-name "$FUNCION" \
    --runtime nodejs20.x \
    --role "$ROL_ARN" \
    --handler handler.handler \
    --zip-file fileb://services/admin/admin.zip \
    --timeout 15 \
    --memory-size 512 \
    --environment "$VARIABLES" >/dev/null
  aws_ lambda wait function-active --function-name "$FUNCION"
fi

# ── API Gateway ────────────────────────────────────────────────────────────
API_ID=$(aws_ apigatewayv2 get-apis \
  --query "Items[?Name=='${API}'].ApiId | [0]" --output text)

if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  echo "Creando API $API…"
  API_ID=$(aws_ apigatewayv2 create-api \
    --name "$API" \
    --protocol-type HTTP \
    --target "arn:aws:lambda:${REGION}:${CUENTA}:function:${FUNCION}" \
    --cors-configuration "$CORS_JSON" \
    --query ApiId --output text)

  aws_ lambda add-permission --function-name "$FUNCION" \
    --statement-id apigateway \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${CUENTA}:${API_ID}/*" >/dev/null
else
  aws_ apigatewayv2 update-api --api-id "$API_ID" \
    --cors-configuration "$CORS_JSON" >/dev/null
fi

URL=$(aws_ apigatewayv2 get-api --api-id "$API_ID" --query ApiEndpoint --output text)

echo
echo "Listo."
echo "  función : $FUNCION ($(du -h services/admin/admin.zip | cut -f1))"
echo "  API     : $URL"
echo "  llave   : en $ARCHIVO_CLAVE"
