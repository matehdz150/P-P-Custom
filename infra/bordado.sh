#!/usr/bin/env bash
# Vertical slice de bordado. Declara recursos idempotentes, pero NO se ejecuta
# desde ningún deploy general: se habilita explícitamente cuando haya test-sew.
set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh
source infra/.cognito-compradores

PREFIX="${KUSTTO_EMBROIDERY_PREFIX:-kustto-embroidery}"
API_NAME="${KUSTTO_API:-kustto-admin-api}"
MAIN_TABLE="${KUSTTO_TABLA:-kustto-prod}"
ORIGIN="${KUSTTO_ORIGEN:-http://localhost:3000}"
ENABLED="${KUSTTO_EMBROIDERY_ENABLED:-false}"
ACCOUNT=$(aws_ sts get-caller-identity --query Account --output text)
BUCKET="${KUSTTO_EMBROIDERY_BUCKET:-${PREFIX}-${ACCOUNT}-${REGION}}"
JOBS_TABLE="${KUSTTO_EMBROIDERY_JOBS_TABLE:-${PREFIX}-jobs}"
QUEUE="${PREFIX}-jobs"
DLQ="${PREFIX}-jobs-dlq"
API_FUNCTION="${PREFIX}-api"
WORKER_FUNCTION="${PREFIX}-worker"
REPOSITORY="${PREFIX}-worker"

if ! aws_ dynamodb describe-table --table-name "$JOBS_TABLE" >/dev/null 2>&1; then
  aws_ dynamodb create-table --table-name "$JOBS_TABLE" --billing-mode PAY_PER_REQUEST \
    --attribute-definitions AttributeName=pk,AttributeType=S --key-schema AttributeName=pk,KeyType=HASH >/dev/null
  aws_ dynamodb wait table-exists --table-name "$JOBS_TABLE"
fi
# Los dos siguientes FALLAN si ya están puestos —"TimeToLive is already enabled",
# "Continuous backups ... already enabled"— y con `set -e` eso mataba el script
# en la segunda pasada. Se comprueba antes: correr esto dos veces tiene que dar
# lo mismo que correrlo una.
TTL_ESTADO=$(aws_ dynamodb describe-time-to-live --table-name "$JOBS_TABLE" --query TimeToLiveDescription.TimeToLiveStatus --output text)
if [ "$TTL_ESTADO" != "ENABLED" ] && [ "$TTL_ESTADO" != "ENABLING" ]; then
  aws_ dynamodb update-time-to-live --table-name "$JOBS_TABLE" --time-to-live-specification Enabled=true,AttributeName=expiresAt >/dev/null
fi
PITR_ESTADO=$(aws_ dynamodb describe-continuous-backups --table-name "$JOBS_TABLE" --query ContinuousBackupsDescription.PointInTimeRecoveryDescription.PointInTimeRecoveryStatus --output text)
if [ "$PITR_ESTADO" != "ENABLED" ]; then
  aws_ dynamodb update-continuous-backups --table-name "$JOBS_TABLE" --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true >/dev/null
fi

if ! aws_ s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  if [ "$REGION" = "us-east-1" ]; then aws_ s3api create-bucket --bucket "$BUCKET" >/dev/null; else aws_ s3api create-bucket --bucket "$BUCKET" --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null; fi
fi
aws_ s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws_ s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
aws_ s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws_ s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{"Rules":[{"ID":"staging-cleanup","Status":"Enabled","Filter":{"Prefix":"staging/"},"Expiration":{"Days":1}},{"ID":"inputs-cleanup","Status":"Enabled","Filter":{"Prefix":"inputs/"},"Expiration":{"Days":90}},{"ID":"preview-artifacts-cleanup","Status":"Enabled","Filter":{"Prefix":"embroidery/"},"Expiration":{"Days":90}}]}'

DLQ_URL=$(aws_ sqs get-queue-url --queue-name "$DLQ" --query QueueUrl --output text 2>/dev/null || aws_ sqs create-queue --queue-name "$DLQ" --attributes MessageRetentionPeriod=1209600,SqsManagedSseEnabled=true --query QueueUrl --output text)
DLQ_ARN=$(aws_ sqs get-queue-attributes --queue-url "$DLQ_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)
QUEUE_URL=$(aws_ sqs get-queue-url --queue-name "$QUEUE" --query QueueUrl --output text 2>/dev/null || aws_ sqs create-queue --queue-name "$QUEUE" --attributes VisibilityTimeout=720,MessageRetentionPeriod=345600,SqsManagedSseEnabled=true --query QueueUrl --output text)
# `--attributes` en forma abreviada (clave=valor,clave=valor) NO admite un valor
# con JSON dentro, y `RedrivePolicy` es exactamente eso: un JSON metido en una
# cadena. El CLI corta por la primera comilla y falla con "Expected: '=',
# received: '\"'", sin mencionar que el problema es la forma abreviada. Con el
# objeto JSON completo sí lo acepta.
ATRIBUTOS_COLA="{\"VisibilityTimeout\":\"720\",\"MessageRetentionPeriod\":\"345600\",\"SqsManagedSseEnabled\":\"true\",\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"$DLQ_ARN\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\"}"
aws_ sqs set-queue-attributes --queue-url "$QUEUE_URL" --attributes "$ATRIBUTOS_COLA"
QUEUE_ARN=$(aws_ sqs get-queue-attributes --queue-url "$QUEUE_URL" --attribute-names QueueArn --query Attributes.QueueArn --output text)

if ! aws_ ecr describe-repositories --repository-names "$REPOSITORY" >/dev/null 2>&1; then
  aws_ ecr create-repository --repository-name "$REPOSITORY" --image-scanning-configuration scanOnPush=true --image-tag-mutability IMMUTABLE --encryption-configuration encryptionType=AES256 >/dev/null
fi
IMAGE="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY}:inkstitch-3.3.0-v8"
aws_ ecr get-login-password | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
if ! aws_ ecr describe-images --repository-name "$REPOSITORY" --image-ids imageTag=inkstitch-3.3.0-v8 >/dev/null 2>&1; then
  docker buildx build --platform linux/arm64 --provenance=false --load -t "$IMAGE" services/bordados-worker
  docker push "$IMAGE"
fi

role() {
  local name="$1"
  if ! aws_ iam get-role --role-name "$name" >/dev/null 2>&1; then
    aws_ iam create-role --role-name "$name" --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
    aws_ iam attach-role-policy --role-name "$name" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    sleep 10
  fi
}
role "${API_FUNCTION}-role"; role "${WORKER_FUNCTION}-role"
aws_ iam put-role-policy --role-name "${API_FUNCTION}-role" --policy-name bordado-api --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"dynamodb:GetItem\",\"dynamodb:PutItem\",\"dynamodb:UpdateItem\"],\"Resource\":\"arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${JOBS_TABLE}\"},{\"Effect\":\"Allow\",\"Action\":\"dynamodb:GetItem\",\"Resource\":\"arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${MAIN_TABLE}\"},{\"Effect\":\"Allow\",\"Action\":[\"s3:PutObject\",\"s3:GetObject\"],\"Resource\":[\"arn:aws:s3:::${BUCKET}/inputs/*\",\"arn:aws:s3:::${BUCKET}/embroidery/*/preview.png\"]},{\"Effect\":\"Allow\",\"Action\":\"sqs:SendMessage\",\"Resource\":\"${QUEUE_ARN}\"}]}"
aws_ iam put-role-policy --role-name "${WORKER_FUNCTION}-role" --policy-name bordado-worker --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"dynamodb:GetItem\",\"dynamodb:UpdateItem\"],\"Resource\":\"arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/${JOBS_TABLE}\"},{\"Effect\":\"Allow\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::${BUCKET}/inputs/*\"},{\"Effect\":\"Allow\",\"Action\":[\"s3:PutObject\",\"s3:GetObject\",\"s3:DeleteObject\"],\"Resource\":[\"arn:aws:s3:::${BUCKET}/staging/*\",\"arn:aws:s3:::${BUCKET}/embroidery/*\"]},{\"Effect\":\"Allow\",\"Action\":[\"sqs:ReceiveMessage\",\"sqs:DeleteMessage\",\"sqs:GetQueueAttributes\"],\"Resource\":\"${QUEUE_ARN}\"}]}"
API_ROLE=$(aws_ iam get-role --role-name "${API_FUNCTION}-role" --query Role.Arn --output text)
WORKER_ROLE=$(aws_ iam get-role --role-name "${WORKER_FUNCTION}-role" --query Role.Arn --output text)

(cd services/bordados && pnpm build >/dev/null)
rm -f services/bordados/bordados.zip
(cd services/bordados/dist && zip -q ../bordados.zip handler.mjs)
API_ENV="Variables={KUSTTO_EMBROIDERY_ENABLED=$ENABLED,KUSTTO_EMBROIDERY_JOBS_TABLE=$JOBS_TABLE,KUSTTO_EMBROIDERY_BUCKET=$BUCKET,KUSTTO_EMBROIDERY_QUEUE_URL=$QUEUE_URL,KUSTTO_TABLA=$MAIN_TABLE,KUSTTO_ORIGEN=$ORIGIN}"
if aws_ lambda get-function --function-name "$API_FUNCTION" >/dev/null 2>&1; then
  aws_ lambda update-function-code --function-name "$API_FUNCTION" --zip-file fileb://services/bordados/bordados.zip >/dev/null; aws_ lambda wait function-updated --function-name "$API_FUNCTION"
  aws_ lambda update-function-configuration --function-name "$API_FUNCTION" --environment "$API_ENV" >/dev/null
else
  aws_ lambda create-function --function-name "$API_FUNCTION" --runtime nodejs20.x --handler handler.handler --role "$API_ROLE" --zip-file fileb://services/bordados/bordados.zip --timeout 10 --memory-size 512 --environment "$API_ENV" >/dev/null
fi

WORKER_ENV="Variables={KUSTTO_EMBROIDERY_ENABLED=$ENABLED,KUSTTO_EMBROIDERY_JOBS_TABLE=$JOBS_TABLE,KUSTTO_EMBROIDERY_BUCKET=$BUCKET,KUSTTO_ENGINE_TIMEOUT=240}"
if aws_ lambda get-function --function-name "$WORKER_FUNCTION" >/dev/null 2>&1; then
  aws_ lambda update-function-code --function-name "$WORKER_FUNCTION" --image-uri "$IMAGE" >/dev/null; aws_ lambda wait function-updated --function-name "$WORKER_FUNCTION"
  aws_ lambda update-function-configuration --function-name "$WORKER_FUNCTION" --memory-size 2048 --timeout 280 --ephemeral-storage Size=512 --environment "$WORKER_ENV" >/dev/null
else
  aws_ lambda create-function --function-name "$WORKER_FUNCTION" --package-type Image --code ImageUri="$IMAGE" --role "$WORKER_ROLE" --architectures arm64 --memory-size 2048 --timeout 280 --ephemeral-storage Size=512 --environment "$WORKER_ENV" >/dev/null
fi
aws_ lambda put-function-concurrency --function-name "$WORKER_FUNCTION" --reserved-concurrent-executions 5
MAPPING=$(aws_ lambda list-event-source-mappings --function-name "$WORKER_FUNCTION" --event-source-arn "$QUEUE_ARN" --query 'EventSourceMappings[0].UUID' --output text)
if [ "$MAPPING" = "None" ] || [ -z "$MAPPING" ]; then aws_ lambda create-event-source-mapping --function-name "$WORKER_FUNCTION" --event-source-arn "$QUEUE_ARN" --batch-size 1 --scaling-config MaximumConcurrency=5 >/dev/null; else aws_ lambda update-event-source-mapping --uuid "$MAPPING" --batch-size 1 --scaling-config MaximumConcurrency=5 --enabled >/dev/null; fi

API_ID=$(aws_ apigatewayv2 get-apis --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text)
AUTH=$(aws_ apigatewayv2 get-authorizers --api-id "$API_ID" --query "Items[?Name=='cognito-compradores'].AuthorizerId | [0]" --output text)
INTEGRATION=$(aws_ apigatewayv2 get-integrations --api-id "$API_ID" --query "Items[?contains(IntegrationUri, '${API_FUNCTION}')].IntegrationId | [0]" --output text)
if [ "$INTEGRATION" = "None" ] || [ -z "$INTEGRATION" ]; then INTEGRATION=$(aws_ apigatewayv2 create-integration --api-id "$API_ID" --integration-type AWS_PROXY --integration-uri "arn:aws:lambda:${REGION}:${ACCOUNT}:function:${API_FUNCTION}" --payload-format-version 2.0 --query IntegrationId --output text); fi
for key in 'POST /bordados/jobs' 'GET /bordados/jobs/{jobId}'; do
  if ! aws_ apigatewayv2 get-routes --api-id "$API_ID" --query "Items[?RouteKey=='${key}'].RouteId | [0]" --output text | grep -qv None; then aws_ apigatewayv2 create-route --api-id "$API_ID" --route-key "$key" --target "integrations/$INTEGRATION" --authorization-type JWT --authorizer-id "$AUTH" >/dev/null; fi
done
aws_ lambda add-permission --function-name "$API_FUNCTION" --statement-id apigateway-bordado --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT}:${API_ID}/*/*/bordados/jobs*" >/dev/null 2>&1 || true

# El mensaje decia siempre "debe permanecer false", tambien al encenderlo: en
# la beta eso es exactamente al reves y un aviso que miente se deja de leer.
if [ "$ENABLED" = "true" ]; then
  echo "Bordado declarado y HABILITADO (beta). physicallyValidated sigue en false:"
  echo "ningun diseno pasa a fabricacion sin revision hasta completar el test sew."
else
  echo "Bordado declarado. Feature flag: false."
fi
