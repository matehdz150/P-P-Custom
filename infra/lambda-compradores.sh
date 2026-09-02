#!/usr/bin/env bash
#
# La Lambda de la cuenta del comprador, detrás de su propio autorizador JWT.
#
#   bash infra/lambda-compradores.sh
#
# Cuelga de la MISMA API Gateway que las otras dos. El reparto queda así:
#
#   /proveedores/*   ->  kustto-proveedores, token del pool de TALLERES
#   /cuenta/*        ->  esta función,       token del pool de COMPRADORES
#   todo lo demás    ->  kustto-admin,       llave compartida
#
# SON DOS AUTORIZADORES, NO UNO. El de API Gateway valida emisor y audiencia,
# no grupos: si los dos pools compartieran autorizador, un token de taller
# abriría /cuenta/* y al revés. Con uno por pool eso es imposible por
# construcción, y no depende de que ningún handler se acuerde de comprobarlo.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh
source infra/.cognito-compradores

FUNCION="${KUSTTO_LAMBDA_COMPRADORES:-kustto-compradores}"
ROL="${FUNCION}-rol"
API_NOMBRE="${KUSTTO_API:-kustto-admin-api}"
TABLA="${KUSTTO_TABLA:-kustto-prod}"
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

# La política se escribe SIEMPRE, no sólo al crear el rol: dentro del `if`,
# ampliarla no surtiría efecto justo donde el rol ya existe, y se descubre con
# un AccessDenied en producción.
#
# Es el rol más estrecho de los tres: lee pedidos por índice, y escribe
# ÚNICAMENTE el ítem de su propia cuenta. Sin borrar, sin S3, sin Cognito, sin
# transacciones. Un comprador no crea nada que otro tenga que ver.
aws_ iam put-role-policy --role-name "$ROL" --policy-name datos \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"dynamodb:GetItem\", \"dynamodb:PutItem\", \"dynamodb:Query\"],
        \"Resource\": [
          \"arn:aws:dynamodb:${REGION}:${CUENTA}:table/${TABLA}\",
          \"arn:aws:dynamodb:${REGION}:${CUENTA}:table/${TABLA}/index/*\"
        ]
      }
    ]
  }"

ROL_ARN=$(aws_ iam get-role --role-name "$ROL" --query "Role.Arn" --output text)

# ── El paquete ─────────────────────────────────────────────────────────────
echo "Empaquetando…"
(cd services/compradores && pnpm build >/dev/null)
rm -f services/compradores/compradores.zip
if command -v zip >/dev/null 2>&1; then
  (cd services/compradores/dist && zip -q -r ../compradores.zip handler.mjs)
else
  # Git Bash en Windows no trae zip.
  powershell.exe -NoProfile -Command "Compress-Archive -Path services\compradores\dist\handler.mjs -DestinationPath services\compradores\compradores.zip -Force" >/dev/null
fi

VARIABLES="Variables={KUSTTO_TABLA=$TABLA,KUSTTO_ORIGEN=$ORIGEN}"

if aws_ lambda get-function --function-name "$FUNCION" >/dev/null 2>&1; then
  echo "Actualizando código…"
  aws_ lambda update-function-code --function-name "$FUNCION" \
    --zip-file fileb://services/compradores/compradores.zip >/dev/null
  aws_ lambda wait function-updated --function-name "$FUNCION"
  aws_ lambda update-function-configuration --function-name "$FUNCION" \
    --environment "$VARIABLES" >/dev/null
  aws_ lambda wait function-updated --function-name "$FUNCION"
else
  echo "Creando función $FUNCION…"
  aws_ lambda create-function --function-name "$FUNCION" \
    --runtime nodejs20.x --role "$ROL_ARN" --handler handler.handler \
    --zip-file fileb://services/compradores/compradores.zip \
    --timeout 15 --memory-size 512 --environment "$VARIABLES" >/dev/null
  aws_ lambda wait function-active --function-name "$FUNCION"
fi

# ── Enganchar a la API que ya existe ───────────────────────────────────────
API_ID=$(aws_ apigatewayv2 get-apis \
  --query "Items[?Name=='${API_NOMBRE}'].ApiId | [0]" --output text)

if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  echo "No encontré la API $API_NOMBRE. Corre antes infra/lambda-admin.sh." >&2
  exit 1
fi

AUTORIZADOR=$(aws_ apigatewayv2 get-authorizers --api-id "$API_ID" \
  --query "Items[?Name=='cognito-compradores'].AuthorizerId | [0]" --output text)

if [ "$AUTORIZADOR" = "None" ] || [ -z "$AUTORIZADOR" ]; then
  echo "Creando autorizador JWT de compradores…"
  AUTORIZADOR=$(aws_ apigatewayv2 create-authorizer --api-id "$API_ID" \
    --name cognito-compradores \
    --authorizer-type JWT \
    --identity-source '$request.header.Authorization' \
    --jwt-configuration "Audience=${KUSTTO_COMPRADORES_CLIENTE},Issuer=https://cognito-idp.${REGION}.amazonaws.com/${KUSTTO_COMPRADORES_POOL}" \
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
# `ANY` incluye OPTIONS, así que el preflight del navegador caería en la ruta
# con autorizador — y un preflight no lleva Authorization, por diseño.
# Resultado: 401 sin cabeceras CORS y un "Failed to fetch" que no dice nada.
# Dejando OPTIONS sin ruta, API Gateway lo contesta solo. Ya pasó una vez con
# /proveedores/*; que no vuelva a pasar aquí.
VIEJA=$(aws_ apigatewayv2 get-routes --api-id "$API_ID" \
  --query "Items[?RouteKey=='ANY /cuenta/{proxy+}'].RouteId | [0]" --output text)
if [ "$VIEJA" != "None" ] && [ -n "$VIEJA" ]; then
  echo "Quitando la ruta ANY (se tragaba el preflight)…"
  aws_ apigatewayv2 delete-route --api-id "$API_ID" --route-id "$VIEJA"
fi

for METODO in GET POST PATCH DELETE; do
  RUTA="$METODO /cuenta/{proxy+}"
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
echo "  ruta    : ${URL}/cuenta/*  (exige token del pool de compradores)"
