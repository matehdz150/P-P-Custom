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

# ── Windows y macOS, con los mismos scripts ────────────────────────────────
#
# Las dos cosas de abajo son INERTES en macOS: la variable no la lee nadie y
# `cygpath` no existe, así que el helper devuelve la ruta tal cual. Están aquí
# y no en cada script para que nadie tenga que acordarse.

# Git Bash convierte los argumentos que empiezan por `/` en rutas de Windows
# antes de pasárselos al programa. Con el CLI de AWS eso rompe cualquier cosa
# que PAREZCA una ruta y no lo sea: `--paths "/*"` de una invalidación de
# CloudFront salía como `C:/Program Files/Git/*` y la respuesta era
# "invalid invalidation paths", sin mencionar nada de rutas. Lo mismo con los
# nombres de grupo de logs (`/aws/lambda/...`).
export MSYS_NO_PATHCONV=1

# El camino contrario: una ruta de archivo REAL que hay que darle al CLI.
#
# En Windows el CLI es un binario nativo y no entiende `/tmp/tmp.XXXX`: falla
# con `Unable to load paramfile` señalando una ruta que para el shell sí
# existe. `cygpath -m` la traduce a `C:/Users/.../Temp/tmp.XXXX`, que es la
# forma que el CLI espera.
#
#   aws_ cloudfront create-function --function-code "fileb://$(ruta_cli "$F")"
ruta_cli() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$1"
  else
    printf '%s' "$1"
  fi
}
