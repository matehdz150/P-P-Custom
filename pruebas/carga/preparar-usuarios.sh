#!/usr/bin/env bash
# Crea usuarios sintéticos en Cognito y renueva sus ID tokens para k6.

set -euo pipefail

RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
cd "$RAIZ"
source infra/aws.sh

CONFIGURACION="infra/.pruebas-api"
CREDENCIALES="pruebas/carga/.credenciales"
USUARIOS="pruebas/carga/.usuarios.json"
CANTIDAD="${KUSTTO_TEST_USERS:-20}"

if [ ! -f "$CONFIGURACION" ]; then
  echo "Falta $CONFIGURACION. Ejecuta primero: pnpm test:env" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1 || ! command -v openssl >/dev/null 2>&1; then
  echo "Se necesitan jq y openssl para preparar los usuarios." >&2
  exit 1
fi
if ! [[ "$CANTIDAD" =~ ^[1-9][0-9]*$ ]] || [ "$CANTIDAD" -gt 200 ]; then
  echo "KUSTTO_TEST_USERS debe estar entre 1 y 200." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIGURACION"

if [ -z "${KUSTTO_PRUEBAS_COMPRADORES_POOL:-}" ] || \
   [ -z "${KUSTTO_PRUEBAS_COMPRADORES_CLIENTE:-}" ]; then
  echo "La configuración no contiene el pool aislado. Ejecuta: pnpm test:env" >&2
  exit 1
fi

if [ -f "$CREDENCIALES" ]; then
  # shellcheck disable=SC1090
  source "$CREDENCIALES"
else
  KUSTTO_TEST_USER_PASSWORD="CargaKustto-$(openssl rand -hex 16)1"
  umask 077
  printf 'KUSTTO_TEST_USER_PASSWORD=%q\n' "$KUSTTO_TEST_USER_PASSWORD" > "$CREDENCIALES"
fi

if [ -z "${KUSTTO_TEST_USER_PASSWORD:-}" ]; then
  echo "$CREDENCIALES no contiene una contraseña." >&2
  exit 1
fi

TEMPORAL=$(mktemp -d)
limpiar() { rm -rf "$TEMPORAL"; }
trap limpiar EXIT INT TERM

echo "Preparando $CANTIDAD usuarios sintéticos…"
preparar_uno() {
  local i="$1"
  local numero correo nombre atributos parametros token
  numero=$(printf '%03d' "$i")
  correo="carga-${numero}@kustto.test"
  nombre="Carga Kustto ${numero}"

  if ! aws_ cognito-idp admin-get-user \
    --user-pool-id "$KUSTTO_PRUEBAS_COMPRADORES_POOL" \
    --username "$correo" >/dev/null 2>&1; then
    atributos=$(jq -nc --arg email "$correo" --arg nombre "$nombre" '[
      {Name:"email",Value:$email},
      {Name:"email_verified",Value:"true"},
      {Name:"name",Value:$nombre}
    ]')
    aws_ cognito-idp admin-create-user \
      --user-pool-id "$KUSTTO_PRUEBAS_COMPRADORES_POOL" \
      --username "$correo" \
      --message-action SUPPRESS \
      --user-attributes "$atributos" >/dev/null
  else
    aws_ cognito-idp admin-update-user-attributes \
      --user-pool-id "$KUSTTO_PRUEBAS_COMPRADORES_POOL" \
      --username "$correo" \
      --user-attributes Name=email_verified,Value=true >/dev/null
  fi

  aws_ cognito-idp admin-set-user-password \
    --user-pool-id "$KUSTTO_PRUEBAS_COMPRADORES_POOL" \
    --username "$correo" \
    --password "$KUSTTO_TEST_USER_PASSWORD" \
    --permanent >/dev/null

  parametros=$(jq -nc \
    --arg usuario "$correo" \
    --arg password "$KUSTTO_TEST_USER_PASSWORD" \
    '{USERNAME:$usuario,PASSWORD:$password}')
  token=$(aws_ cognito-idp initiate-auth \
    --auth-flow USER_PASSWORD_AUTH \
    --client-id "$KUSTTO_PRUEBAS_COMPRADORES_CLIENTE" \
    --auth-parameters "$parametros" \
    --query AuthenticationResult.IdToken --output text)

  jq -nc --arg email "$correo" --arg token "$token" \
    '{email:$email,idToken:$token}' > "$TEMPORAL/${numero}.json"
}

# Un poco de paralelismo evita que preparar cien identidades tarde varios
# minutos, sin convertir esta fase en una prueba accidental de Cognito.
PARALELOS="${KUSTTO_TEST_USER_WORKERS:-4}"
if ! [[ "$PARALELOS" =~ ^[1-9][0-9]*$ ]] || [ "$PARALELOS" -gt 8 ]; then
  echo "KUSTTO_TEST_USER_WORKERS debe estar entre 1 y 8." >&2
  exit 1
fi

pids=()
en_lote=0
for ((i = 1; i <= CANTIDAD; i++)); do
  preparar_uno "$i" &
  pids+=("$!")
  en_lote=$((en_lote + 1))

  if [ "$en_lote" -ge "$PARALELOS" ]; then
    for pid in "${pids[@]}"; do wait "$pid"; done
    pids=()
    en_lote=0
  fi
done
if [ "$en_lote" -gt 0 ]; then
  for pid in "${pids[@]}"; do wait "$pid"; done
fi

umask 077
jq -s '.' "$TEMPORAL"/*.json > "${USUARIOS}.nuevo"
mv "${USUARIOS}.nuevo" "$USUARIOS"
rm -rf "$TEMPORAL"
trap - EXIT INT TERM

echo "Tokens de $CANTIDAD usuarios guardados en $USUARIOS (vigencia: 1 hora)."
