#!/usr/bin/env bash

set -euo pipefail

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
CONFIGURACION="$RAIZ/infra/.pruebas-api"

if [ ! -f "$CONFIGURACION" ]; then
  echo "No existe infra/.pruebas-api." >&2
  echo "Créala con: AWS_PROFILE=kustto-admin AWS_REGION=us-east-1 bash infra/pruebas-api.sh" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIGURACION"

if [ -z "${KUSTTO_PRUEBAS_API:-}" ]; then
  echo "infra/.pruebas-api no contiene KUSTTO_PRUEBAS_API." >&2
  exit 1
fi
if [ -z "${KUSTTO_PRUEBAS_COMPRADORES_POOL:-}" ] || \
   [ -z "${KUSTTO_PRUEBAS_COMPRADORES_CLIENTE:-}" ]; then
  echo "Falta la configuración de Cognito de pruebas. Ejecuta: pnpm test:env" >&2
  exit 1
fi

case "$KUSTTO_PRUEBAS_API" in
  *kd8ydpp2c6*|*kustto.com.mx*)
    echo "La configuración apunta a producción; inicio cancelado." >&2
    exit 1
    ;;
esac

echo "Iniciando web contra el entorno de pruebas: $KUSTTO_PRUEBAS_API"

cd "$RAIZ"
NEXT_PUBLIC_KUSTTO_API="$KUSTTO_PRUEBAS_API" \
NEXT_PUBLIC_KUSTTO_WS= \
NEXT_PUBLIC_COGNITO_REGION="${KUSTTO_PRUEBAS_COGNITO_REGION:-us-east-1}" \
NEXT_PUBLIC_COGNITO_COMPRADORES_CLIENTE="${KUSTTO_PRUEBAS_COMPRADORES_CLIENTE:-}" \
NEXT_PUBLIC_COGNITO_COMPRADORES_DOMINIO= \
exec pnpm --dir apps/web dev
