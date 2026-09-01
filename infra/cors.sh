#!/usr/bin/env bash
#
# CORS del bucket público.
#
# Hace falta porque el navegador sube los mockups DIRECTO a S3 con una URL
# prefirmada — el archivo nunca pasa por la API. Sin esto el PUT lo bloquea
# el navegador antes de salir.
#
#   bash infra/cors.sh
#
# Ojo con la distinción: esto permite ESCRIBIR desde otro origen. La LECTURA
# de los mockups sigue siendo del mismo origen que el sitio (en desarrollo
# vía el rewrite de Next, en producción vía CloudFront), porque el teñido de
# prenda hace getImageData() sobre ellos y con otro origen se apaga solo.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

PUBLICO="${KUSTTO_BUCKET_PUBLICO:-kustto-publico-prod}"
ORIGENES="${KUSTTO_ORIGENES:-http://localhost:3000}"

# AllowedOrigins acepta varios separados por coma en la variable.
lista=$(printf '"%s",' ${ORIGENES//,/ } | sed 's/,$//')

aws_ s3api put-bucket-cors --bucket "$PUBLICO" --cors-configuration "{
  \"CORSRules\": [
    {
      \"AllowedOrigins\": [$lista],
      \"AllowedMethods\": [\"PUT\", \"GET\", \"HEAD\"],
      \"AllowedHeaders\": [\"*\"],
      \"ExposeHeaders\": [\"ETag\"],
      \"MaxAgeSeconds\": 3000
    }
  ]
}"

echo "CORS aplicado a $PUBLICO para: $ORIGENES"
aws_ s3api get-bucket-cors --bucket "$PUBLICO" \
  --query "CORSRules[0].{origenes:AllowedOrigins,metodos:AllowedMethods}" --output json
