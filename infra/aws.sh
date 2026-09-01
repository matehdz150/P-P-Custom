#!/usr/bin/env bash
# Localiza el CLI de AWS. En Windows el instalador no siempre lo deja en el
# PATH del shell, así que caemos a la ruta donde lo pone.
set -euo pipefail

PERFIL="${AWS_PROFILE:-kustto-admin}"
REGION="${AWS_REGION:-us-east-1}"

if command -v aws >/dev/null 2>&1; then
  AWS_BIN="aws"
elif [ -x "$HOME/AppData/Local/Programs/Amazon/AWSCLIV2/aws.exe" ]; then
  AWS_BIN="$HOME/AppData/Local/Programs/Amazon/AWSCLIV2/aws.exe"
else
  echo "No encontré el CLI de AWS." >&2
  exit 1
fi

aws_() {
  "$AWS_BIN" "$@" --profile "$PERFIL" --region "$REGION"
}
