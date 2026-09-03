#!/usr/bin/env bash
#
# La Lambda del panel de proveedores, detrás del autorizador JWT de Cognito.
#
#   bash infra/lambda-proveedores.sh
#
# Cuelga de la MISMA API Gateway que el admin. No hace falta otra: una sola
# API enruta por camino hacia funciones distintas. Dos serían dos dominios,
# dos configuraciones de CORS y después dos comportamientos de CloudFront.
#
# El reparto queda así:
#   /proveedores/*   ->  esta función, con token de Cognito obligatorio
#   todo lo demás    ->  la de admin, con la llave compartida
#
# El autorizador vive en API Gateway, no en el código: valida firma,
# caducidad y audiencia ANTES de invocar la Lambda. Una petición sin token
# válido nunca llega a ejecutarse — ni se paga.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh
source infra/.cognito

FUNCION="${KUSTTO_LAMBDA_PROVEEDORES:-kustto-proveedores}"
ROL="${FUNCION}-rol"
API_NOMBRE="${KUSTTO_API:-kustto-admin-api}"
TABLA="${KUSTTO_TABLA:-kustto-prod}"
PUBLICO="${KUSTTO_BUCKET_PUBLICO:-kustto-publico-prod}"
ORIGEN="${KUSTTO_ORIGEN:-http://localhost:3000}"

CUENTA=$(aws_ sts get-caller-identity --query Account --output text)

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

# La política se escribe SIEMPRE, no sólo al crear el rol: si vive dentro del
# `if`, ampliarla no surte efecto donde el rol ya existe —justo donde hace
# falta— y se descubre con un AccessDenied en producción. `put-role-policy`
# reemplaza la política entera, así que correrlo de más no hace daño.
#
# Más estrecho que el de admin: puede crear y actualizar productos, pero no
# borrar nada ni tocar Cognito.
#
# Ojo con el S3: el permiso alcanza TODO `medios/productos/*`, porque una
# política de IAM es de la función y no sabe qué taller hizo la petición. Lo
# que separa a un taller de otro es que la Lambda arma la ruta con el `sub`
# del token (services/proveedores/src/rutas/subidas.ts). Si esa ruta llegara
# a salir del cuerpo de la petición, esta política ya no defendería nada.
aws_ iam put-role-policy --role-name "$ROL" --policy-name datos \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [
          \"dynamodb:GetItem\", \"dynamodb:PutItem\", \"dynamodb:UpdateItem\",
          \"dynamodb:Query\", \"dynamodb:TransactWriteItems\"
        ],
        \"Resource\": [
          \"arn:aws:dynamodb:${REGION}:${CUENTA}:table/${TABLA}\",
          \"arn:aws:dynamodb:${REGION}:${CUENTA}:table/${TABLA}/index/*\"
        ]
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"s3:PutObject\"],
        \"Resource\": \"arn:aws:s3:::${PUBLICO}/medios/productos/*\"
      }
    ]
  }"

ROL_ARN=$(aws_ iam get-role --role-name "$ROL" --query "Role.Arn" --output text)

# ── El paquete ─────────────────────────────────────────────────────────────
echo "Empaquetando…"
(cd services/proveedores && pnpm build >/dev/null)
rm -f services/proveedores/proveedores.zip
if command -v zip >/dev/null 2>&1; then
  (cd services/proveedores/dist && zip -q -r ../proveedores.zip handler.mjs)
else
  powershell.exe -NoProfile -Command "Compress-Archive -Path services\proveedores\dist\handler.mjs -DestinationPath services\proveedores\proveedores.zip -Force" >/dev/null
fi

# 29 segundos, no 15.
#
# Comprar una guía son cuatro llamadas encadenadas a Skydropx: recotizar,
# esperar a que las paqueterías contesten (lo más lento, unos 5 s), crear el
# envío y esperar la etiqueta. Con 15 s la función moría a media compra, y eso
# es peor que un error: el envío puede haberse pagado y el pedido no enterarse.
# 29 es el techo — API Gateway corta a los 30.
TIEMPO=29

PARES="KUSTTO_TABLA=$TABLA,KUSTTO_BUCKET_PUBLICO=$PUBLICO,KUSTTO_ORIGEN=$ORIGEN"

# Skydropx: aquí se usa para RECOTIZAR con el peso real y comprar la guía. Sin
# credenciales todo lo demás sigue andando; sólo no se pueden generar guías.
if [ -f infra/.skydropx ]; then
  source infra/.skydropx
fi

# Si el repo no las trae pero la función sí, mandan las suyas.
# `update-function-configuration` sustituye el entorno ENTERO: sin esto, un
# despliegue desde una máquina sin `infra/.skydropx` borra las credenciales y
# comprar la guía deja de funcionar sin un solo error a la vista.
if [ -z "${SKYDROPX_CLIENT_ID:-}" ] && \
   aws_ lambda get-function --function-name "$FUNCION" >/dev/null 2>&1; then
  SKY_VIVAS=$(aws_ lambda get-function-configuration --function-name "$FUNCION" \
    --query "[Environment.Variables.SKYDROPX_HOST, Environment.Variables.SKYDROPX_CLIENT_ID, Environment.Variables.SKYDROPX_CLIENT_SECRET]" \
    --output text)
  SKY_ID=$(echo "$SKY_VIVAS" | cut -f2)

  if [ -n "$SKY_ID" ] && [ "$SKY_ID" != "None" ]; then
    SKYDROPX_HOST=$(echo "$SKY_VIVAS" | cut -f1)
    SKYDROPX_CLIENT_ID="$SKY_ID"
    SKYDROPX_CLIENT_SECRET=$(echo "$SKY_VIVAS" | cut -f3)
  fi
fi

if [ -n "${SKYDROPX_CLIENT_ID:-}" ]; then
  PARES="$PARES,SKYDROPX_HOST=$SKYDROPX_HOST,SKYDROPX_CLIENT_ID=$SKYDROPX_CLIENT_ID,SKYDROPX_CLIENT_SECRET=$SKYDROPX_CLIENT_SECRET"
else
  echo "Aviso: sin credenciales de Skydropx. No se podrán generar guías."
fi

VARIABLES="Variables={$PARES}"

if aws_ lambda get-function --function-name "$FUNCION" >/dev/null 2>&1; then
  echo "Actualizando código…"
  aws_ lambda update-function-code --function-name "$FUNCION" \
    --zip-file fileb://services/proveedores/proveedores.zip >/dev/null
  aws_ lambda wait function-updated --function-name "$FUNCION"
  aws_ lambda update-function-configuration --function-name "$FUNCION" \
    --timeout "$TIEMPO" --environment "$VARIABLES" >/dev/null
  aws_ lambda wait function-updated --function-name "$FUNCION"
else
  echo "Creando función $FUNCION…"
  aws_ lambda create-function --function-name "$FUNCION" \
    --runtime nodejs20.x --role "$ROL_ARN" --handler handler.handler \
    --zip-file fileb://services/proveedores/proveedores.zip \
    --timeout "$TIEMPO" --memory-size 512 --environment "$VARIABLES" >/dev/null
  aws_ lambda wait function-active --function-name "$FUNCION"
fi

# ── Enganchar a la API que ya existe ───────────────────────────────────────
API_ID=$(aws_ apigatewayv2 get-apis \
  --query "Items[?Name=='${API_NOMBRE}'].ApiId | [0]" --output text)

if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  echo "No encontré la API $API_NOMBRE. Corre antes infra/lambda-admin.sh." >&2
  exit 1
fi

# El autorizador JWT: valida contra el pool de Cognito.
AUTORIZADOR=$(aws_ apigatewayv2 get-authorizers --api-id "$API_ID" \
  --query "Items[?Name=='cognito-proveedores'].AuthorizerId | [0]" --output text)

if [ "$AUTORIZADOR" = "None" ] || [ -z "$AUTORIZADOR" ]; then
  echo "Creando autorizador JWT…"
  AUTORIZADOR=$(aws_ apigatewayv2 create-authorizer --api-id "$API_ID" \
    --name cognito-proveedores \
    --authorizer-type JWT \
    --identity-source '$request.header.Authorization' \
    --jwt-configuration "Audience=${KUSTTO_POOL_CLIENTE},Issuer=https://cognito-idp.${REGION}.amazonaws.com/${KUSTTO_POOL_ID}" \
    --query AuthorizerId --output text)
fi

INTEGRACION=$(aws_ apigatewayv2 get-integrations --api-id "$API_ID" \
  --query "Items[?contains(IntegrationUri, '${FUNCION}')].IntegrationId | [0]" \
  --output text)

if [ "$INTEGRACION" = "None" ] || [ -z "$INTEGRACION" ]; then
  echo "Creando integración…"
  INTEGRACION=$(aws_ apigatewayv2 create-integration --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "arn:aws:lambda:${REGION}:${CUENTA}:function:${FUNCION}" \
    --payload-format-version 2.0 \
    --query IntegrationId --output text)

  aws_ lambda add-permission --function-name "$FUNCION" \
    --statement-id apigateway \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${CUENTA}:${API_ID}/*" >/dev/null
fi

# Un método por ruta, y NUNCA `ANY`.
#
# `ANY` incluye OPTIONS, así que el preflight del navegador caería en la
# ruta con autorizador — y un preflight no lleva Authorization, por diseño.
# Resultado: 401 sin cabeceras CORS y el navegador reporta un "Failed to
# fetch" que no dice nada. Dejando OPTIONS sin ruta, API Gateway lo contesta
# solo con la configuración de CORS de la API.
VIEJA=$(aws_ apigatewayv2 get-routes --api-id "$API_ID" \
  --query "Items[?RouteKey=='ANY /proveedores/{proxy+}'].RouteId | [0]" --output text)
if [ "$VIEJA" != "None" ] && [ -n "$VIEJA" ]; then
  echo "Quitando la ruta ANY (se tragaba el preflight)…"
  aws_ apigatewayv2 delete-route --api-id "$API_ID" --route-id "$VIEJA"
fi

for METODO in GET POST PATCH DELETE; do
  RUTA="$METODO /proveedores/{proxy+}"
  EXISTE=$(aws_ apigatewayv2 get-routes --api-id "$API_ID" \
    --query "Items[?RouteKey=='${RUTA}'].RouteId | [0]" --output text)

  if [ "$EXISTE" = "None" ] || [ -z "$EXISTE" ]; then
    echo "Creando ruta $RUTA…"
    aws_ apigatewayv2 create-route --api-id "$API_ID" \
      --route-key "$RUTA" \
      --target "integrations/${INTEGRACION}" \
      --authorization-type JWT \
      --authorizer-id "$AUTORIZADOR" >/dev/null
  fi
done

URL=$(aws_ apigatewayv2 get-api --api-id "$API_ID" --query ApiEndpoint --output text)

echo
echo "Listo."
echo "  función : $FUNCION"
echo "  ruta    : ${URL}/proveedores/*  (exige token de Cognito)"
