#!/usr/bin/env bash
# Ejecuta escalones y conserva el resumen de cada uno. Se detiene en el primer
# escalón que incumpla los SLO definidos en el runner k6.

set -euo pipefail

RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
cd "$RAIZ"

FLUJO="${1:-}"
CONFIGURACION="infra/.pruebas-api"
DURACION="${KUSTTO_STRESS_DURATION:-30s}"
CALENTAMIENTO="${KUSTTO_STRESS_WARMUP:-15s}"
PAUSA="${KUSTTO_STRESS_THINK_TIME:-1}"

case "$FLUJO" in
  usuarios)
    PASOS="${KUSTTO_STRESS_STEPS:-10 25 50 100}"
    ;;
  pedidos)
    PASOS="${KUSTTO_STRESS_STEPS:-1 2 5 10}"
    ;;
  *)
    echo "Uso: $0 usuarios|pedidos" >&2
    exit 1
    ;;
esac

if ! command -v k6 >/dev/null 2>&1; then
  echo "No está instalado k6." >&2
  echo "En macOS: brew install k6" >&2
  exit 1
fi
if [ ! -f "$CONFIGURACION" ]; then
  echo "Falta $CONFIGURACION. Ejecuta primero: pnpm test:env" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIGURACION"

maximo=0
for paso in $PASOS; do
  if ! [[ "$paso" =~ ^[1-9][0-9]*$ ]] || [ "$paso" -gt 500 ]; then
    echo "Escalón inválido: $paso" >&2
    exit 1
  fi
  if [ "$paso" -gt "$maximo" ]; then maximo="$paso"; fi
done

if [ "$FLUJO" = "usuarios" ]; then
  KUSTTO_TEST_USERS="${KUSTTO_TEST_USERS:-$maximo}" \
    bash pruebas/carga/preparar-usuarios.sh
else
  bash pruebas/carga/preparar-usuarios.sh
fi

MARCA=$(date -u +%Y%m%dT%H%M%SZ)
DIRECTORIO="pruebas/carga/resultados/${MARCA}-${FLUJO}"
mkdir -p "$DIRECTORIO"

echo "Probando $FLUJO en escalones: $PASOS"
ultimo=0

for paso in $PASOS; do
  echo
  if [ "$FLUJO" = "usuarios" ]; then
    echo "== $paso usuarios concurrentes =="
    variables=(
      CONCURRENT_USERS="$paso"
      USERS_RPS=0
      ORDERS_RPS=0
      THINK_TIME_SECONDS="$PAUSA"
    )
  else
    echo "== $paso pedidos por segundo =="
    variables=(
      CONCURRENT_USERS=0
      USERS_RPS=0
      ORDERS_RPS="$paso"
    )
  fi

  set +e
  env \
    KUSTTO_LOAD_TEST=SI \
    KUSTTO_TEST_API="$KUSTTO_PRUEBAS_API" \
    PROFILE=load \
    WARMUP="$CALENTAMIENTO" \
    DURATION="$DURACION" \
    "${variables[@]}" \
    k6 run \
      --summary-export "$DIRECTORIO/${paso}.json" \
      pruebas/carga/kustto-usuarios-pedidos.js
  estado=$?
  set -e

  if [ "$estado" -ne 0 ]; then
    echo
    echo "El primer escalón que incumplió los SLO fue $paso."
    echo "El último escalón aprobado fue $ultimo."
    echo "Resultados: $DIRECTORIO"
    exit "$estado"
  fi

  ultimo="$paso"
done

echo
echo "Todos los escalones aprobaron; el límite es mayor que $ultimo."
echo "Resultados: $DIRECTORIO"
