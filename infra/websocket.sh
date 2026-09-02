#!/usr/bin/env bash
#
# El canal en vivo del panel del taller: una API WebSocket de API Gateway.
#
#   bash infra/websocket.sh
#
# Para qué. Un pedido nuevo tiene que aparecer en el panel sin que nadie
# recargue. Preguntar cada pocos segundos son peticiones que casi siempre
# devuelven lo mismo; esto empuja el aviso sólo cuando pasa algo.
#
# API APARTE, Y NO HAY MÁS REMEDIO. Las APIs de API Gateway son de un
# protocolo o del otro: una HTTP no admite rutas WebSocket. Así que esta sí
# es una segunda API, al contrario que la de proveedores, que cuelga de la de
# admin. No es un descuido.
#
# EL TOKEN VA EN LA QUERY STRING. `new WebSocket(url)` no deja poner
# cabeceras, así que no hay `Authorization` posible. Por eso el autorizador
# es de tipo REQUEST y lee `route.request.querystring.token`, y por eso la
# Lambda valida el JWT contra el pool a mano: las APIs WebSocket no tienen
# autorizador JWT de fábrica.
#
# QUIÉN AVISA. `kustto-admin` publica al crear un pedido. Por eso al final
# este script le da permiso de ManageConnections y le mete el endpoint en el
# entorno.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh
source infra/.cognito

FUNCION="${KUSTTO_LAMBDA_EVENTOS:-kustto-eventos}"
ROL="${FUNCION}-rol"
API_NOMBRE="${KUSTTO_WS_API:-kustto-eventos-ws}"
ETAPA="${KUSTTO_WS_ETAPA:-prod}"
TABLA="${KUSTTO_TABLA:-kustto-prod}"
ADMIN_ROL="${KUSTTO_ADMIN_ROL:-kustto-admin-rol}"
ADMIN_FUNCION="${KUSTTO_LAMBDA_ADMIN:-kustto-admin}"
SALIDA="infra/.websocket"

CUENTA=$(aws_ sts get-caller-identity --query Account --output text)

# ── El TTL de la tabla ─────────────────────────────────────────────────────
#
# Es la red de seguridad de las conexiones: si una Lambda muere sin procesar
# el $disconnect, el apunte se borra solo en vez de quedarse para siempre
# haciendo que se le escriba a un fantasma.
TTL=$(aws_ dynamodb describe-time-to-live --table-name "$TABLA" \
  --query "TimeToLiveDescription.TimeToLiveStatus" --output text)

if [ "$TTL" = "DISABLED" ]; then
  echo "Activando TTL en $TABLA (atributo expiraEn)…"
  aws_ dynamodb update-time-to-live --table-name "$TABLA" \
    --time-to-live-specification "Enabled=true,AttributeName=expiraEn" >/dev/null
fi

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

# Fuera del `if` a propósito: si vive dentro, ampliarla no surte efecto donde
# el rol ya existe, que es justo donde hace falta.
#
# El más estrecho de los tres. Sólo apunta y desapunta conexiones: no lee
# pedidos, no lee productos, no toca S3 ni Cognito. Aunque alguien colara un
# token ajeno, por aquí no sale un solo dato.
aws_ iam put-role-policy --role-name "$ROL" --policy-name datos \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"dynamodb:PutItem\", \"dynamodb:DeleteItem\"],
        \"Resource\": \"arn:aws:dynamodb:${REGION}:${CUENTA}:table/${TABLA}\"
      }
    ]
  }"

ROL_ARN=$(aws_ iam get-role --role-name "$ROL" --query "Role.Arn" --output text)

# ── El paquete ─────────────────────────────────────────────────────────────
echo "Empaquetando…"
(cd services/eventos && pnpm build >/dev/null)
rm -f services/eventos/eventos.zip
if command -v zip >/dev/null 2>&1; then
  (cd services/eventos/dist && zip -q -r ../eventos.zip handler.mjs)
else
  powershell.exe -NoProfile -Command "Compress-Archive -Path services\eventos\dist\handler.mjs -DestinationPath services\eventos\eventos.zip -Force" >/dev/null
fi

VARIABLES="Variables={KUSTTO_TABLA=$TABLA,KUSTTO_POOL_ID=$KUSTTO_POOL_ID,KUSTTO_POOL_CLIENTE=$KUSTTO_POOL_CLIENTE}"

if aws_ lambda get-function --function-name "$FUNCION" >/dev/null 2>&1; then
  echo "Actualizando código…"
  aws_ lambda update-function-code --function-name "$FUNCION" \
    --zip-file fileb://services/eventos/eventos.zip >/dev/null
  aws_ lambda wait function-updated --function-name "$FUNCION"
  aws_ lambda update-function-configuration --function-name "$FUNCION" \
    --environment "$VARIABLES" >/dev/null
  aws_ lambda wait function-updated --function-name "$FUNCION"
else
  echo "Creando función $FUNCION…"
  aws_ lambda create-function --function-name "$FUNCION" \
    --runtime nodejs20.x --role "$ROL_ARN" --handler handler.handler \
    --zip-file fileb://services/eventos/eventos.zip \
    --timeout 10 --memory-size 256 --environment "$VARIABLES" >/dev/null
  aws_ lambda wait function-active --function-name "$FUNCION"
fi

FUNCION_ARN="arn:aws:lambda:${REGION}:${CUENTA}:function:${FUNCION}"
# Las integraciones y los autorizadores de WebSocket NO aceptan el ARN pelado
# de la función: piden la ruta de invocación completa.
INVOCACION="arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${FUNCION_ARN}/invocations"

# ── La API ─────────────────────────────────────────────────────────────────
API_ID=$(aws_ apigatewayv2 get-apis \
  --query "Items[?Name=='${API_NOMBRE}'].ApiId | [0]" --output text)

if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  echo "Creando API WebSocket $API_NOMBRE…"
  # `$request.body.action` es la expresión de selección de ruta. Hoy el
  # cliente no manda nada, pero es obligatoria y deja la puerta abierta a
  # mensajes con nombre sin rehacer la API.
  API_ID=$(aws_ apigatewayv2 create-api --name "$API_NOMBRE" \
    --protocol-type WEBSOCKET \
    --route-selection-expression '$request.body.action' \
    --query ApiId --output text)
fi

# ── El autorizador ─────────────────────────────────────────────────────────
AUTORIZADOR=$(aws_ apigatewayv2 get-authorizers --api-id "$API_ID" \
  --query "Items[?Name=='cognito-ws'].AuthorizerId | [0]" --output text)

if [ "$AUTORIZADOR" = "None" ] || [ -z "$AUTORIZADOR" ]; then
  echo "Creando autorizador…"
  AUTORIZADOR=$(aws_ apigatewayv2 create-authorizer --api-id "$API_ID" \
    --name cognito-ws \
    --authorizer-type REQUEST \
    --authorizer-uri "$INVOCACION" \
    --identity-source 'route.request.querystring.token' \
    --query AuthorizerId --output text)
fi

# ── La integración ─────────────────────────────────────────────────────────
INTEGRACION=$(aws_ apigatewayv2 get-integrations --api-id "$API_ID" \
  --query "Items[?contains(IntegrationUri, '${FUNCION}')].IntegrationId | [0]" \
  --output text)

if [ "$INTEGRACION" = "None" ] || [ -z "$INTEGRACION" ]; then
  echo "Creando integración…"
  INTEGRACION=$(aws_ apigatewayv2 create-integration --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$INVOCACION" \
    --query IntegrationId --output text)
fi

# El permiso para que API Gateway invoque la función, tanto como integración
# como de autorizador. `add-permission` falla si ya está, y eso no es un
# error: el script se corre a diario.
aws_ lambda add-permission --function-name "$FUNCION" \
  --statement-id apigateway-ws \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${CUENTA}:${API_ID}/*" >/dev/null 2>&1 || true

# ── Las rutas ──────────────────────────────────────────────────────────────
crear_ruta() {
  local CLAVE="$1"
  local CON_AUTORIZADOR="${2:-no}"

  local EXISTE
  EXISTE=$(aws_ apigatewayv2 get-routes --api-id "$API_ID" \
    --query "Items[?RouteKey=='${CLAVE}'].RouteId | [0]" --output text)

  if [ "$EXISTE" != "None" ] && [ -n "$EXISTE" ]; then return; fi

  echo "Creando ruta $CLAVE…"
  if [ "$CON_AUTORIZADOR" = "si" ]; then
    aws_ apigatewayv2 create-route --api-id "$API_ID" \
      --route-key "$CLAVE" \
      --target "integrations/${INTEGRACION}" \
      --authorization-type CUSTOM \
      --authorizer-id "$AUTORIZADOR" >/dev/null
  else
    aws_ apigatewayv2 create-route --api-id "$API_ID" \
      --route-key "$CLAVE" \
      --target "integrations/${INTEGRACION}" >/dev/null
  fi
}

# El autorizador SÓLO puede ir en $connect: es la única ruta donde API
# Gateway lo admite. Una vez aceptada la conexión, el permiso ya está dado.
crear_ruta '$connect' si
crear_ruta '$disconnect'
crear_ruta '$default'

# ── La etapa y el despliegue ───────────────────────────────────────────────
#
# Las APIs WebSocket no tienen `--auto-deploy`: hay que desplegar a mano en
# cada cambio. Por eso el create-deployment corre siempre.
if ! aws_ apigatewayv2 get-stage --api-id "$API_ID" --stage-name "$ETAPA" >/dev/null 2>&1; then
  echo "Creando etapa $ETAPA…"
  aws_ apigatewayv2 create-stage --api-id "$API_ID" --stage-name "$ETAPA" >/dev/null
fi

aws_ apigatewayv2 create-deployment --api-id "$API_ID" --stage-name "$ETAPA" >/dev/null

WS_URL="wss://${API_ID}.execute-api.${REGION}.amazonaws.com/${ETAPA}"
# El endpoint de gestión es el MISMO host pero en https: es a donde
# `kustto-admin` manda los avisos.
WS_ENDPOINT="https://${API_ID}.execute-api.${REGION}.amazonaws.com/${ETAPA}"

# ── Que el admin pueda escribirles ─────────────────────────────────────────
#
# En una política aparte, no en `datos`: `lambda-admin.sh` reescribe `datos`
# entera cada vez que corre, y esto se perdería.
aws_ iam put-role-policy --role-name "$ADMIN_ROL" --policy-name eventos \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"execute-api:ManageConnections\"],
        \"Resource\": \"arn:aws:execute-api:${REGION}:${CUENTA}:${API_ID}/*\"
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"dynamodb:DeleteItem\"],
        \"Resource\": \"arn:aws:dynamodb:${REGION}:${CUENTA}:table/${TABLA}\"
      }
    ]
  }"

cat > "$SALIDA" <<EOF
KUSTTO_WS_API_ID=$API_ID
KUSTTO_WS_URL=$WS_URL
KUSTTO_WS_ENDPOINT=$WS_ENDPOINT
EOF

# ── Meterle el endpoint al admin ───────────────────────────────────────────
#
# `lambda-admin.sh` lo conserva leyéndolo de la función, igual que hace con
# la llave y el pool. Aquí se pone por si esta es la primera vez.
if aws_ lambda get-function --function-name "$ADMIN_FUNCION" >/dev/null 2>&1; then
  ACTUAL=$(aws_ lambda get-function-configuration --function-name "$ADMIN_FUNCION" \
    --query "Environment.Variables.KUSTTO_WS_ENDPOINT" --output text)

  if [ "$ACTUAL" != "$WS_ENDPOINT" ]; then
    echo "Poniéndole el endpoint a $ADMIN_FUNCION…"
    echo "  (corre infra/lambda-admin.sh para que quede en su despliegue normal)"
  fi
fi

echo
echo "Canal en vivo listo."
echo "  api      : $API_ID"
echo "  navegador: $WS_URL"
echo "  avisos   : $WS_ENDPOINT"
echo "  guardado en $SALIDA"
echo
echo "Falta: bash infra/lambda-admin.sh — para que el admin salga con el endpoint puesto."
