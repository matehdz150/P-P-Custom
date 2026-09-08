#!/usr/bin/env bash
#
# Entorno aislado para pruebas funcionales y de carga de la API de Kustto.
#
# Crea recursos con prefijo `kustto-test`, nunca reutiliza la tabla ni el
# bucket de producción y deja fuera integraciones con efectos externos:
# correo, Skydropx, WebSocket y bordado. Los autorizadores JWT sí reutilizan
# los pools existentes: API Gateway valida tokens ya emitidos, pero todos los
# datos que lean o escriban las Lambdas viven en la tabla de pruebas.
#
#   AWS_PROFILE=kustto-admin bash infra/pruebas-api.sh
#
# Límites ajustables:
#   KUSTTO_TEST_CONCURRENCY=20 KUSTTO_TEST_RPS=50 KUSTTO_TEST_BURST=50 \
#     bash infra/pruebas-api.sh

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

for herramienta in jq zip; do
  if ! command -v "$herramienta" >/dev/null 2>&1; then
    echo "Falta $herramienta; se necesita para desplegar el entorno de pruebas." >&2
    exit 1
  fi
done

for archivo in infra/.cognito infra/.cognito-admin; do
  if [ ! -f "$archivo" ]; then
    echo "Falta $archivo; no se pueden crear los autorizadores de prueba." >&2
    exit 1
  fi
done

# shellcheck disable=SC1091
source infra/.cognito
# shellcheck disable=SC1091
source infra/.cognito-admin

AWS_PROFILE="${AWS_PROFILE:-kustto-admin}" AWS_REGION="${AWS_REGION:-us-east-1}" \
  bash infra/pruebas-cognito.sh
# shellcheck disable=SC1091
source infra/.pruebas-cognito

CUENTA=$(aws_ sts get-caller-identity --query Account --output text)
PREFIJO="${KUSTTO_TEST_PREFIX:-kustto-test}"
TABLA="${KUSTTO_TEST_TABLE:-${PREFIJO}}"
BUCKET="${KUSTTO_TEST_BUCKET:-${PREFIJO}-publico-${CUENTA}-${REGION}}"
API_NOMBRE="${KUSTTO_TEST_API_NAME:-${PREFIJO}-api}"
FUNCION_ADMIN="${PREFIJO}-admin"
FUNCION_COMPRADORES="${PREFIJO}-compradores"
FUNCION_PROVEEDORES="${PREFIJO}-proveedores"
CONCURRENCIA="${KUSTTO_TEST_CONCURRENCY:-20}"
RPS="${KUSTTO_TEST_RPS:-50}"
BURST="${KUSTTO_TEST_BURST:-50}"
ORIGENES="${KUSTTO_TEST_ORIGINS:-http://localhost:3000,http://localhost:3001,http://localhost:3002}"

if ! [[ "$CONCURRENCIA" =~ ^[1-9][0-9]*$ ]] || [ "$CONCURRENCIA" -gt 100 ]; then
  echo "KUSTTO_TEST_CONCURRENCY debe estar entre 1 y 100." >&2
  exit 1
fi
if ! [[ "$RPS" =~ ^[1-9][0-9]*$ ]] || [ "$RPS" -gt 500 ]; then
  echo "KUSTTO_TEST_RPS debe estar entre 1 y 500." >&2
  exit 1
fi
if ! [[ "$BURST" =~ ^[1-9][0-9]*$ ]] || [ "$BURST" -gt 500 ]; then
  echo "KUSTTO_TEST_BURST debe estar entre 1 y 500." >&2
  exit 1
fi

ETIQUETAS="Environment=test,Application=kustto,ManagedBy=infra-pruebas-api"

echo "Creando datos aislados…"
if ! aws_ dynamodb describe-table --table-name "$TABLA" >/dev/null 2>&1; then
  aws_ dynamodb create-table \
    --table-name "$TABLA" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
      AttributeName=gsi1pk,AttributeType=S \
      AttributeName=gsi1sk,AttributeType=S \
      AttributeName=gsi2pk,AttributeType=S \
      AttributeName=gsi2sk,AttributeType=S \
      AttributeName=gsi3pk,AttributeType=S \
      AttributeName=gsi3sk,AttributeType=S \
    --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
    --global-secondary-indexes '[
      {"IndexName":"gsi1","KeySchema":[{"AttributeName":"gsi1pk","KeyType":"HASH"},{"AttributeName":"gsi1sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},
      {"IndexName":"gsi2","KeySchema":[{"AttributeName":"gsi2pk","KeyType":"HASH"},{"AttributeName":"gsi2sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},
      {"IndexName":"gsi3","KeySchema":[{"AttributeName":"gsi3pk","KeyType":"HASH"},{"AttributeName":"gsi3sk","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}}
    ]' \
    --tags Key=Environment,Value=test Key=Application,Value=kustto \
    >/dev/null
  aws_ dynamodb wait table-exists --table-name "$TABLA"
fi

TTL=$(aws_ dynamodb describe-time-to-live --table-name "$TABLA" \
  --query TimeToLiveDescription.TimeToLiveStatus --output text)
if [ "$TTL" = "DISABLED" ]; then
  aws_ dynamodb update-time-to-live --table-name "$TABLA" \
    --time-to-live-specification Enabled=true,AttributeName=expiraEn >/dev/null
fi

if ! aws_ s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  if [ "$REGION" = "us-east-1" ]; then
    aws_ s3api create-bucket --bucket "$BUCKET" >/dev/null
  else
    aws_ s3api create-bucket --bucket "$BUCKET" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
  aws_ s3api put-bucket-tagging --bucket "$BUCKET" \
    --tagging "TagSet=[{Key=Environment,Value=test},{Key=Application,Value=kustto}]"
fi

aws_ s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws_ s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws_ s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration '{
    "Rules":[{
      "ID":"pruebas-caducan",
      "Status":"Enabled",
      "Filter":{"Prefix":""},
      "Expiration":{"Days":7},
      "AbortIncompleteMultipartUpload":{"DaysAfterInitiation":1}
    }]
  }'

CORS_S3=$(jq -nc --arg origenes "$ORIGENES" '{
  CORSRules:[{
    AllowedHeaders:["*"],
    AllowedMethods:["GET","HEAD","PUT"],
    AllowedOrigins:($origenes | split(",")),
    ExposeHeaders:["etag"],
    MaxAgeSeconds:300
  }]
}')
aws_ s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "$CORS_S3"

echo "Copiando únicamente catálogo público y proveedores sanitizados…"
TEMPORAL=$(mktemp -d)
limpiar_temporal() { rm -rf "$TEMPORAL"; }
trap limpiar_temporal EXIT INT TERM

aws_ dynamodb scan --table-name kustto-prod \
  --filter-expression 'pk = :categorias OR pk = :plantillas OR (begins_with(pk, :producto) AND gsi2pk = :activo)' \
  --expression-attribute-values '{":categorias":{"S":"CATEGORY"},":plantillas":{"S":"TEMPLATE"},":producto":{"S":"PRODUCT#"},":activo":{"S":"PRODUCT_ESTADO#activo"}}' \
  --query Items --output json > "$TEMPORAL/publicos.json"

aws_ dynamodb scan --table-name kustto-prod \
  --filter-expression 'begins_with(pk, :proveedor) AND sk = :meta' \
  --expression-attribute-values '{":proveedor":{"S":"PROVIDER#"},":meta":{"S":"META"}}' \
  --projection-expression 'pk' --query Items --output json \
  > "$TEMPORAL/proveedores.json"

while IFS= read -r item; do
  aws_ dynamodb put-item --table-name "$TABLA" --item "$item" >/dev/null
done < <(jq -c '.[]' "$TEMPORAL/publicos.json")

while IFS= read -r proveedor; do
  aws_ dynamodb get-item --table-name kustto-prod \
    --key "{\"pk\":{\"S\":\"PROVIDER#${proveedor}\"},\"sk\":{\"S\":\"META\"}}" \
    --query Item --output json > "$TEMPORAL/proveedor.json"
  sanitizado=$(jq -c '{pk,sk,id,name,displayName,slug,avatarUrl,gsi1pk,gsi1sk,estado,createdAt,updatedAt} | with_entries(select(.value != null))' "$TEMPORAL/proveedor.json")
  if [ "$sanitizado" != "{}" ]; then
    aws_ dynamodb put-item --table-name "$TABLA" --item "$sanitizado" >/dev/null
  fi
done < <(jq -r '.[].pk.S | sub("^PROVIDER#"; "")' "$TEMPORAL/proveedores.json" | sort -u)

echo "Preparando roles aislados…"
ROL_NUEVO=0
for funcion in "$FUNCION_ADMIN" "$FUNCION_COMPRADORES" "$FUNCION_PROVEEDORES"; do
  rol="${funcion}-rol"
  if ! aws_ iam get-role --role-name "$rol" >/dev/null 2>&1; then
    aws_ iam create-role --role-name "$rol" \
      --assume-role-policy-document '{
        "Version":"2012-10-17",
        "Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]
      }' \
      --tags Key=Environment,Value=test Key=Application,Value=kustto \
      >/dev/null
    aws_ iam attach-role-policy --role-name "$rol" \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    ROL_NUEVO=1
  fi
  aws_ iam put-role-policy --role-name "$rol" --policy-name datos-pruebas \
    --policy-document "{
      \"Version\":\"2012-10-17\",
      \"Statement\":[
        {
          \"Effect\":\"Allow\",
          \"Action\":[\"dynamodb:GetItem\",\"dynamodb:BatchGetItem\",\"dynamodb:PutItem\",\"dynamodb:UpdateItem\",\"dynamodb:DeleteItem\",\"dynamodb:Query\",\"dynamodb:TransactWriteItems\"],
          \"Resource\":[\"arn:aws:dynamodb:${REGION}:${CUENTA}:table/${TABLA}\",\"arn:aws:dynamodb:${REGION}:${CUENTA}:table/${TABLA}/index/*\"]
        },
        {
          \"Effect\":\"Allow\",
          \"Action\":[\"s3:GetObject\",\"s3:PutObject\",\"s3:DeleteObject\"],
          \"Resource\":\"arn:aws:s3:::${BUCKET}/*\"
        }
      ]
    }"
done
if [ "$ROL_NUEVO" = "1" ]; then
  echo "Esperando a que IAM propague los roles…"
  sleep 12
fi

empaquetar() {
  local servicio="$1"
  local paquete="services/${servicio}/${servicio}.zip"
  (cd "services/${servicio}" && pnpm build >/dev/null)
  rm -f "$paquete"
  (cd "services/${servicio}/dist" && zip -q -r "../${servicio}.zip" handler.mjs)
  printf '%s' "$paquete"
}

crear_funcion() {
  local servicio="$1"
  local funcion="$2"
  local timeout="$3"
  local paquete
  paquete=$(empaquetar "$servicio")
  local rol_arn
  rol_arn=$(aws_ iam get-role --role-name "${funcion}-rol" --query Role.Arn --output text)
  local variables="Variables={KUSTTO_TABLA=$TABLA,KUSTTO_BUCKET_PUBLICO=$BUCKET,KUSTTO_ORIGEN=http://localhost:3000}"

  if aws_ lambda get-function --function-name "$funcion" >/dev/null 2>&1; then
    aws_ lambda update-function-code --function-name "$funcion" \
      --zip-file "fileb://${paquete}" >/dev/null
    aws_ lambda wait function-updated --function-name "$funcion"
    aws_ lambda update-function-configuration --function-name "$funcion" \
      --timeout "$timeout" --memory-size 512 --environment "$variables" >/dev/null
    aws_ lambda wait function-updated --function-name "$funcion"
  else
    aws_ lambda create-function --function-name "$funcion" \
      --runtime nodejs20.x --role "$rol_arn" --handler handler.handler \
      --zip-file "fileb://${paquete}" --timeout "$timeout" --memory-size 512 \
      --environment "$variables" \
      --tags "$ETIQUETAS" >/dev/null
    aws_ lambda wait function-active --function-name "$funcion"
  fi

  aws_ lambda put-function-concurrency --function-name "$funcion" \
    --reserved-concurrent-executions "$CONCURRENCIA" >/dev/null
  aws_ logs create-log-group --log-group-name "/aws/lambda/${funcion}" >/dev/null 2>&1 || true
  aws_ logs put-retention-policy --log-group-name "/aws/lambda/${funcion}" \
    --retention-in-days 14
}

echo "Desplegando Lambdas de pruebas…"
crear_funcion admin "$FUNCION_ADMIN" 15
crear_funcion compradores "$FUNCION_COMPRADORES" 15
crear_funcion proveedores "$FUNCION_PROVEEDORES" 29

CORS_API=$(jq -nc --arg origenes "$ORIGENES" '{
  AllowOrigins:($origenes | split(",")),
  AllowMethods:["GET","POST","PATCH","DELETE","OPTIONS"],
  AllowHeaders:["content-type","authorization"],
  MaxAge:300
}')

API_ID=$(aws_ apigatewayv2 get-apis \
  --query "Items[?Name=='${API_NOMBRE}'].ApiId | [0]" --output text)
if [ "$API_ID" = "None" ] || [ -z "$API_ID" ]; then
  API_ID=$(aws_ apigatewayv2 create-api --name "$API_NOMBRE" \
    --protocol-type HTTP --cors-configuration "$CORS_API" \
    --tags Environment=test,Application=kustto,ManagedBy=infra-pruebas-api \
    --query ApiId --output text)
  aws_ apigatewayv2 create-stage --api-id "$API_ID" --stage-name '$default' \
    --auto-deploy >/dev/null
else
  aws_ apigatewayv2 update-api --api-id "$API_ID" \
    --cors-configuration "$CORS_API" >/dev/null
fi

integracion_de() {
  local funcion="$1"
  local integracion
  integracion=$(aws_ apigatewayv2 get-integrations --api-id "$API_ID" \
    --query "Items[?contains(IntegrationUri, ':function:${funcion}')].IntegrationId | [0]" \
    --output text)
  if [ "$integracion" = "None" ] || [ -z "$integracion" ]; then
    integracion=$(aws_ apigatewayv2 create-integration --api-id "$API_ID" \
      --integration-type AWS_PROXY \
      --integration-uri "arn:aws:lambda:${REGION}:${CUENTA}:function:${funcion}" \
      --payload-format-version 2.0 --query IntegrationId --output text)
  fi
  printf '%s' "$integracion"
}

autorizar_api() {
  local funcion="$1"
  aws_ lambda add-permission --function-name "$funcion" \
    --statement-id apigateway-pruebas --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${CUENTA}:${API_ID}/*" \
    >/dev/null 2>&1 || true
}

autorizer_de() {
  local nombre="$1"
  local cliente="$2"
  local pool="$3"
  local authorizer
  authorizer=$(aws_ apigatewayv2 get-authorizers --api-id "$API_ID" \
    --query "Items[?Name=='${nombre}'].AuthorizerId | [0]" --output text)
  if [ "$authorizer" = "None" ] || [ -z "$authorizer" ]; then
    authorizer=$(aws_ apigatewayv2 create-authorizer --api-id "$API_ID" \
      --name "$nombre" --authorizer-type JWT \
      --identity-source '$request.header.Authorization' \
      --jwt-configuration "Audience=${cliente},Issuer=https://cognito-idp.${REGION}.amazonaws.com/${pool}" \
      --query AuthorizerId --output text)
  else
    aws_ apigatewayv2 update-authorizer --api-id "$API_ID" \
      --authorizer-id "$authorizer" \
      --name "$nombre" --authorizer-type JWT \
      --identity-source '$request.header.Authorization' \
      --jwt-configuration "Audience=${cliente},Issuer=https://cognito-idp.${REGION}.amazonaws.com/${pool}" \
      >/dev/null
  fi
  printf '%s' "$authorizer"
}

asegurar_ruta() {
  local ruta="$1"
  local integracion="$2"
  local authorizer="${3:-}"
  local ruta_id
  ruta_id=$(aws_ apigatewayv2 get-routes --api-id "$API_ID" \
    --query "Items[?RouteKey=='${ruta}'].RouteId | [0]" --output text)

  if [ "$ruta_id" = "None" ] || [ -z "$ruta_id" ]; then
    if [ -n "$authorizer" ]; then
      aws_ apigatewayv2 create-route --api-id "$API_ID" --route-key "$ruta" \
        --target "integrations/${integracion}" --authorization-type JWT \
        --authorizer-id "$authorizer" >/dev/null
    else
      aws_ apigatewayv2 create-route --api-id "$API_ID" --route-key "$ruta" \
        --target "integrations/${integracion}" >/dev/null
    fi
  elif [ -n "$authorizer" ]; then
    aws_ apigatewayv2 update-route --api-id "$API_ID" --route-id "$ruta_id" \
      --target "integrations/${integracion}" --authorization-type JWT \
      --authorizer-id "$authorizer" >/dev/null
  else
    aws_ apigatewayv2 update-route --api-id "$API_ID" --route-id "$ruta_id" \
      --target "integrations/${integracion}" --authorization-type NONE >/dev/null
  fi
}

INTEGRACION_ADMIN=$(integracion_de "$FUNCION_ADMIN")
INTEGRACION_COMPRADORES=$(integracion_de "$FUNCION_COMPRADORES")
INTEGRACION_PROVEEDORES=$(integracion_de "$FUNCION_PROVEEDORES")
AUTORIZADOR_ADMIN=$(autorizer_de cognito-admin "$KUSTTO_ADMIN_CLIENTE" "$KUSTTO_ADMIN_POOL")
AUTORIZADOR_COMPRADORES=$(autorizer_de cognito-compradores "$KUSTTO_TEST_COMPRADORES_CLIENTE" "$KUSTTO_TEST_COMPRADORES_POOL")
AUTORIZADOR_PROVEEDORES=$(autorizer_de cognito-proveedores "$KUSTTO_POOL_CLIENTE" "$KUSTTO_POOL_ID")

autorizar_api "$FUNCION_ADMIN"
autorizar_api "$FUNCION_COMPRADORES"
autorizar_api "$FUNCION_PROVEEDORES"

asegurar_ruta '$default' "$INTEGRACION_ADMIN"
for metodo in GET POST PATCH DELETE; do
  asegurar_ruta "$metodo /admin/{proxy+}" "$INTEGRACION_ADMIN" "$AUTORIZADOR_ADMIN"
  asegurar_ruta "$metodo /cuenta/{proxy+}" "$INTEGRACION_COMPRADORES" "$AUTORIZADOR_COMPRADORES"
  asegurar_ruta "$metodo /proveedores/{proxy+}" "$INTEGRACION_PROVEEDORES" "$AUTORIZADOR_PROVEEDORES"
done

AJUSTES=$(jq -nc --argjson rps "$RPS" --argjson burst "$BURST" '{
  DetailedMetricsEnabled:true,
  ThrottlingRateLimit:$rps,
  ThrottlingBurstLimit:$burst
}')
aws_ apigatewayv2 update-stage --api-id "$API_ID" --stage-name '$default' \
  --default-route-settings "$AJUSTES" >/dev/null

URL=$(aws_ apigatewayv2 get-api --api-id "$API_ID" --query ApiEndpoint --output text)
printf '%s\n' \
  "KUSTTO_PRUEBAS_API=${URL}" \
  "KUSTTO_PRUEBAS_API_ID=${API_ID}" \
  "KUSTTO_PRUEBAS_TABLA=${TABLA}" \
  "KUSTTO_PRUEBAS_BUCKET=${BUCKET}" \
  "KUSTTO_PRUEBAS_CONCURRENCIA=${CONCURRENCIA}" \
  "KUSTTO_PRUEBAS_RPS=${RPS}" \
  "KUSTTO_PRUEBAS_COGNITO_REGION=${REGION}" \
  "KUSTTO_PRUEBAS_COMPRADORES_POOL=${KUSTTO_TEST_COMPRADORES_POOL}" \
  "KUSTTO_PRUEBAS_COMPRADORES_CLIENTE=${KUSTTO_TEST_COMPRADORES_CLIENTE}" \
  > infra/.pruebas-api

trap - EXIT INT TERM
limpiar_temporal

echo
echo "Entorno de pruebas listo."
echo "  API          : $URL"
echo "  tabla        : $TABLA (PAY_PER_REQUEST)"
echo "  bucket       : $BUCKET (privado; objetos caducan en 7 días)"
echo "  concurrencia : $CONCURRENCIA por Lambda"
echo "  límite API   : $RPS req/s, burst $BURST"
echo "  configuración: infra/.pruebas-api"
echo
echo "No incluye correo, Skydropx, WebSocket ni bordado."
