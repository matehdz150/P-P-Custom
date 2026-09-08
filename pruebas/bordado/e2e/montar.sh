#!/usr/bin/env bash
# Monta el arnés del E2E y lo desmonta. Todo lo que crea lleva el sufijo -e2e.
#
# POR QUÉ UNA LAMBDA APARTE Y NO ENCENDER EL FLAG. La API está cerrada por
# `KUSTTO_EMBROIDERY_ENABLED` en sus dos rutas: para probarla por HTTP habría que
# encenderla, y eso abre la ruta —aunque haga falta un JWT y la interfaz no la
# muestre— a cualquier comprador autenticado. Esta función tiene el MISMO
# código, escribe en la MISMA tabla de trabajos, publica en la MISMA cola y la
# procesa el MISMO worker, pero no está enlazada a ninguna ruta de API Gateway.
# Superficie de cliente: ninguna.
#
# LA TABLA DE PRODUCTOS TAMBIÉN VA APARTE. La API valida el diseño contra el
# producto —lado, técnica y medidas—, y para eso haría falta un producto activo
# en el catálogo real, que es justamente lo que no se quiere: un producto activo
# aparece en la tienda. La tabla de prueba tiene un solo producto y desaparece
# al desmontar.
set -euo pipefail
cd "$(dirname "$0")/../../.."
source infra/aws.sh

ACCOUNT=$(aws_ sts get-caller-identity --query Account --output text)
PREFIX="kustto-embroidery"
FUNCION="${PREFIX}-api-e2e"
ROL="${FUNCION}-role"
TABLA_PRODUCTOS="${PREFIX}-e2e-products"
JOBS_TABLE="${PREFIX}-jobs"
BUCKET="${PREFIX}-${ACCOUNT}-${REGION}"
QUEUE_URL=$(aws_ sqs get-queue-url --queue-name "${PREFIX}-jobs" --query QueueUrl --output text)
QUEUE_ARN=$(aws_ sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)
PRODUCTO="e2e-bordado-0001"

# Enciende o apaga el flag del worker SIN tocar el resto de su entorno.
#
# Antes esto reescribia el bloque `Variables={...}` entero con los valores
# escritos a mano, y eso PISA lo que haya puesto el IaC: al subir el motor a 100
# segundos, montar el arnes lo devolvia a 75 y el logo monocromo seguia muriendo
# por timeout con una configuracion que en la consola se veia correcta. Un arnes
# de pruebas que cambia la configuracion de produccion por debajo es peor que no
# tener arnes. Ahora se lee lo que hay y solo se cambia la clave del flag.
flag_worker() {
  local valor="$1"
  local actual
  actual=$(aws_ lambda get-function-configuration --function-name "${PREFIX}-worker" --query 'Environment.Variables' --output json)
  local nuevas
  nuevas=$(printf '%s' "$actual" | python3 -c "import json,sys; v=json.load(sys.stdin); v['KUSTTO_EMBROIDERY_ENABLED']='$valor'; print(json.dumps({'Variables': v}))")
  aws_ lambda update-function-configuration --function-name "${PREFIX}-worker" --environment "$nuevas" >/dev/null
  aws_ lambda wait function-updated --function-name "${PREFIX}-worker"
}

case "${1:-montar}" in
montar)
  if ! aws_ dynamodb describe-table --table-name "$TABLA_PRODUCTOS" >/dev/null 2>&1; then
    aws_ dynamodb create-table --table-name "$TABLA_PRODUCTOS" --billing-mode PAY_PER_REQUEST \
      --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
      --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE >/dev/null
    aws_ dynamodb wait table-exists --table-name "$TABLA_PRODUCTOS"
  fi
  # 70 x 50 mm: dentro de los limites del perfil (90 x 60).
  aws_ dynamodb put-item --table-name "$TABLA_PRODUCTOS" --item "{
    \"pk\":{\"S\":\"PRODUCT#${PRODUCTO}\"},
    \"sk\":{\"S\":\"META\"},
    \"id\":{\"S\":\"${PRODUCTO}\"},
    \"estado\":{\"S\":\"activo\"},
    \"printSides\":{\"L\":[{\"M\":{
      \"sideKey\":{\"S\":\"front\"},
      \"tecnica\":{\"S\":\"bordado\"},
      \"widthCm\":{\"N\":\"7\"},
      \"heightCm\":{\"N\":\"5\"},
      \"enabled\":{\"BOOL\":true}
    }}]}
  }" >/dev/null

  if ! aws_ iam get-role --role-name "$ROL" >/dev/null 2>&1; then
    aws_ iam create-role --role-name "$ROL" --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
    aws_ iam attach-role-policy --role-name "$ROL" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    sleep 10
  fi
  aws_ iam put-role-policy --role-name "$ROL" --policy-name bordado-api-e2e --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"dynamodb:GetItem\",\"dynamodb:PutItem\",\"dynamodb:UpdateItem\"],\"Resource\":\"arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${JOBS_TABLE}\"},{\"Effect\":\"Allow\",\"Action\":\"dynamodb:GetItem\",\"Resource\":\"arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${TABLA_PRODUCTOS}\"},{\"Effect\":\"Allow\",\"Action\":[\"s3:PutObject\",\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::${BUCKET}/inputs/*\",\"arn:aws:s3:::${BUCKET}/embroidery/*/preview.png\"]},{\"Effect\":\"Allow\",\"Action\":\"sqs:SendMessage\",\"Resource\":\"${QUEUE_ARN}\"}]}"
  ROL_ARN=$(aws_ iam get-role --role-name "$ROL" --query Role.Arn --output text)

  (cd services/bordados && pnpm build >/dev/null)
  rm -f services/bordados/bordados-e2e.zip
  (cd services/bordados/dist && zip -q ../bordados-e2e.zip handler.mjs)
  ENV_VARS="Variables={KUSTTO_EMBROIDERY_ENABLED=true,KUSTTO_EMBROIDERY_JOBS_TABLE=$JOBS_TABLE,KUSTTO_EMBROIDERY_BUCKET=$BUCKET,KUSTTO_EMBROIDERY_QUEUE_URL=$QUEUE_URL,KUSTTO_TABLA=$TABLA_PRODUCTOS,KUSTTO_ORIGEN=http://localhost:3000}"
  if aws_ lambda get-function --function-name "$FUNCION" >/dev/null 2>&1; then
    aws_ lambda update-function-code --function-name "$FUNCION" --zip-file fileb://services/bordados/bordados-e2e.zip >/dev/null
    aws_ lambda wait function-updated --function-name "$FUNCION"
    aws_ lambda update-function-configuration --function-name "$FUNCION" --environment "$ENV_VARS" >/dev/null
  else
    aws_ lambda create-function --function-name "$FUNCION" --runtime nodejs20.x --handler handler.handler \
      --role "$ROL_ARN" --zip-file fileb://services/bordados/bordados-e2e.zip --timeout 30 --memory-size 512 \
      --environment "$ENV_VARS" >/dev/null
  fi
  aws_ lambda wait function-updated --function-name "$FUNCION"

  # El worker tambien esta cerrado por el flag (`worker.py` lanza
  # FEATURE_DISABLED), asi que sin encenderlo no hay E2E posible. Se enciende
  # SOLO en el worker y solo mientras dura la prueba: al worker no se llega
  # desde ningun cliente —lo unico que lo dispara es la cola, y a la cola solo
  # escribe la API, que sigue apagada—. `desmontar` lo devuelve a false, y ese
  # es el estado que hay que comprobar al terminar.
  flag_worker true
  echo "$PRODUCTO"
  ;;

desmontar)
  flag_worker false
  aws_ lambda delete-function --function-name "$FUNCION" >/dev/null 2>&1 || true
  aws_ iam delete-role-policy --role-name "$ROL" --policy-name bordado-api-e2e >/dev/null 2>&1 || true
  aws_ iam detach-role-policy --role-name "$ROL" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null 2>&1 || true
  aws_ iam delete-role --role-name "$ROL" >/dev/null 2>&1 || true
  aws_ dynamodb delete-table --table-name "$TABLA_PRODUCTOS" >/dev/null 2>&1 || true
  rm -f services/bordados/bordados-e2e.zip
  echo "desmontado"
  ;;
esac
