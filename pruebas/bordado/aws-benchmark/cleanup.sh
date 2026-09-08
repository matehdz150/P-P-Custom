#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
STATE="$ROOT/aws-benchmark/resource-state.json"

if [ ! -f "$STATE" ]; then
  echo "No existe estado de recursos del benchmark." >&2
  exit 1
fi

if [ "$(jq -r '.status' "$STATE")" = "CLEANED" ]; then
  echo "El benchmark registrado ya fue limpiado; no hay nada que eliminar."
  exit 0
fi

PROFILE=$(jq -r '.profile' "$STATE")
REGION=$(jq -r '.region' "$STATE")
EXPECTED_ACCOUNT=$(jq -r '.account' "$STATE")
ACCOUNT=$(aws sts get-caller-identity --profile "$PROFILE" --region "$REGION" --query Account --output text)
if [ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  echo "La cuenta activa no coincide con la cuenta que creó el benchmark." >&2
  exit 1
fi

for key in repository role function; do
  value=$(jq -r ".$key" "$STATE")
  case "$value" in
    kustto-embroidery-benchmark-*) ;;
    *) echo "Nombre inseguro para cleanup: $key=$value" >&2; exit 1 ;;
  esac
done

FUNCTION=$(jq -r '.function' "$STATE")
REPOSITORY=$(jq -r '.repository' "$STATE")
ROLE=$(jq -r '.role' "$STATE")
LOG_GROUP=$(jq -r '.logGroup' "$STATE")

if [ "$(jq -r '.createdResources.lambda' "$STATE")" = true ]; then
  aws lambda delete-function --function-name "$FUNCTION" --profile "$PROFILE" --region "$REGION"
fi
if [ "$(jq -r '.createdResources.logGroup' "$STATE")" = true ]; then
  aws logs delete-log-group --log-group-name "$LOG_GROUP" --profile "$PROFILE" --region "$REGION"
fi
if [ "$(jq -r '.createdResources.ecr' "$STATE")" = true ]; then
  aws ecr delete-repository --repository-name "$REPOSITORY" --force --profile "$PROFILE" --region "$REGION" >/dev/null
fi
if [ "$(jq -r '.createdResources.role' "$STATE")" = true ]; then
  aws iam detach-role-policy \
    --role-name "$ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
    --profile "$PROFILE" || true
  aws iam delete-role --role-name "$ROLE" --profile "$PROFILE"
fi

TEMPORARY=$(mktemp)
jq --arg cleanedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.status="CLEANED" | .cleanedAt=$cleanedAt' "$STATE" > "$TEMPORARY"
mv "$TEMPORARY" "$STATE"
echo "Recursos temporales eliminados; evidencia local conservada en $STATE"
