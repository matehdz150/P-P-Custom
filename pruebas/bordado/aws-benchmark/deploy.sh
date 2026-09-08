#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BENCHMARK_DIR="$ROOT/aws-benchmark"
STATE="$BENCHMARK_DIR/resource-state.json"
PROFILE="${AWS_PROFILE:-kustto-admin}"
REGION="${AWS_REGION:-us-east-1}"

if [ -e "$STATE" ]; then
  if [ "$(jq -r '.status' "$STATE")" != "CLEANED" ]; then
    echo "Ya existe un benchmark sin limpiar en $STATE; no se crearán más recursos." >&2
    exit 1
  fi
  PREVIOUS_RUN_DIR=$(jq -r '.runDir' "$STATE")
  mkdir -p "$PREVIOUS_RUN_DIR"
  cp "$STATE" "$PREVIOUS_RUN_DIR/resource-state-final.json"
fi

ACCOUNT=$(aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" --query Account --output text)
RUN_ID="${BENCHMARK_RUN_ID:-$(date -u +%Y%m%d%H%M%S)-$$}"
PREFIX="kustto-embroidery-benchmark-${RUN_ID}"
REPOSITORY="$PREFIX"
ROLE="$PREFIX"
FUNCTION="$PREFIX"
LOG_GROUP="/aws/lambda/$FUNCTION"
LOCAL_IMAGE="$PREFIX:local"
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
IMAGE_URI="$REGISTRY/$REPOSITORY:benchmark"
RUN_DIR="$BENCHMARK_DIR/runs/$RUN_ID"
mkdir -p "$RUN_DIR"

jq -n \
  --arg runId "$RUN_ID" --arg account "$ACCOUNT" --arg profile "$PROFILE" --arg region "$REGION" \
  --arg repository "$REPOSITORY" --arg role "$ROLE" --arg function "$FUNCTION" \
  --arg logGroup "$LOG_GROUP" --arg localImage "$LOCAL_IMAGE" --arg imageUri "$IMAGE_URI" \
  --arg runDir "$RUN_DIR" \
  '{status:"CREATING",runId:$runId,account:$account,profile:$profile,region:$region,repository:$repository,role:$role,function:$function,logGroup:$logGroup,localImage:$localImage,imageUri:$imageUri,runDir:$runDir,createdResources:{ecr:false,role:false,logGroup:false,lambda:false}}' \
  > "$STATE"

update_state() {
  local filter=$1
  local temporary
  temporary=$(mktemp)
  jq "$filter" "$STATE" > "$temporary"
  mv "$temporary" "$STATE"
}

echo "Construyendo $LOCAL_IMAGE sin caché..."
BUILD_STARTED=$(date +%s)
docker buildx build \
  --platform linux/arm64 \
  --provenance=false \
  --no-cache \
  --load \
  -f "$BENCHMARK_DIR/Dockerfile" \
  -t "$LOCAL_IMAGE" \
  "$ROOT"
BUILD_SECONDS=$(($(date +%s) - BUILD_STARTED))
LOCAL_IMAGE_CONTENT_BYTES=$(docker image inspect "$LOCAL_IMAGE" --format '{{.Size}}')
# Docker Desktop reporta arriba el contenido comprimido del image store. Para
# no llamarlo equivocadamente "extraído", medimos también el filesystem que
# ve realmente el proceso dentro del contenedor.
EXTRACTED_FILESYSTEM_BYTES=$(docker run --rm --entrypoint /usr/bin/du "$LOCAL_IMAGE" -sbx / | awk '{print $1}')
docker history "$LOCAL_IMAGE" --no-trunc --format '{{json .}}' > "$RUN_DIR/image-layers.jsonl"
update_state ". + {buildSeconds:$BUILD_SECONDS,localImageContentBytes:$LOCAL_IMAGE_CONTENT_BYTES,extractedFilesystemBytes:$EXTRACTED_FILESYSTEM_BYTES}"

aws ecr create-repository \
  --repository-name "$REPOSITORY" \
  --image-scanning-configuration scanOnPush=true \
  --tags Key=Purpose,Value=kustto-embroidery-benchmark Key=RunId,Value="$RUN_ID" \
  --profile "$PROFILE" --region "$REGION" >/dev/null
update_state '.createdResources.ecr = true'

aws ecr get-login-password --profile "$PROFILE" --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
docker tag "$LOCAL_IMAGE" "$IMAGE_URI"
docker push "$IMAGE_URI"
IMAGE_DIGEST=$(aws ecr describe-images --repository-name "$REPOSITORY" --image-ids imageTag=benchmark \
  --profile "$PROFILE" --region "$REGION" --query 'imageDetails[0].imageDigest' --output text)
COMPRESSED_BYTES=$(aws ecr describe-images --repository-name "$REPOSITORY" --image-ids imageTag=benchmark \
  --profile "$PROFILE" --region "$REGION" --query 'imageDetails[0].imageSizeInBytes' --output text)
update_state ". + {imageDigest:\"$IMAGE_DIGEST\",compressedImageBytes:$COMPRESSED_BYTES}"

TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
ROLE_ARN=$(aws iam create-role \
  --role-name "$ROLE" \
  --assume-role-policy-document "$TRUST" \
  --description "Rol temporal del benchmark aislado de bordado Kustto" \
  --tags Key=Purpose,Value=kustto-embroidery-benchmark Key=RunId,Value="$RUN_ID" \
  --profile "$PROFILE" --query 'Role.Arn' --output text)
update_state '.createdResources.role = true'
aws iam attach-role-policy \
  --role-name "$ROLE" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --profile "$PROFILE"

aws logs create-log-group --log-group-name "$LOG_GROUP" --profile "$PROFILE" --region "$REGION"
aws logs put-retention-policy --log-group-name "$LOG_GROUP" --retention-in-days 1 --profile "$PROFILE" --region "$REGION"
aws logs tag-log-group --log-group-name "$LOG_GROUP" \
  --tags Purpose=kustto-embroidery-benchmark,RunId="$RUN_ID" \
  --profile "$PROFILE" --region "$REGION"
update_state '.createdResources.logGroup = true'

echo "Esperando propagación del rol temporal..."
sleep 12
aws lambda create-function \
  --function-name "$FUNCTION" \
  --package-type Image \
  --code ImageUri="$REGISTRY/$REPOSITORY@$IMAGE_DIGEST" \
  --role "$ROLE_ARN" \
  --architectures arm64 \
  --memory-size 1024 \
  --timeout 180 \
  --ephemeral-storage Size=512 \
  --environment Variables={BENCHMARK_GENERATION=initial} \
  --tags Purpose=kustto-embroidery-benchmark,RunId="$RUN_ID" \
  --profile "$PROFILE" --region "$REGION" >/dev/null
update_state '.createdResources.lambda = true'
aws lambda wait function-active-v2 --function-name "$FUNCTION" --profile "$PROFILE" --region "$REGION"
update_state '.status = "ACTIVE"'

echo "Benchmark temporal listo: $FUNCTION"
echo "Estado: $STATE"
