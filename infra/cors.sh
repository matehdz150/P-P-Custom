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
# El de desarrollo, los dos del sitio publicado y el BACKOFFICE. Si falta
# alguno, el navegador bloquea la subida —el arte al pedir, las fotos del alta
# de productos, los mockups del admin— y el fallo se ve como "no se pudo
# subir" sin más pista, o como un error de CORS que señala a S3 y no a esta
# lista.
#
# El backoffice se olvidó al publicarlo y costó: subir un mockup moría en el
# preflight del PUT prefirmado, que es una petición que el navegador hace sin
# que nadie la escriba y no aparece en el código de la app.
# TRES PUERTOS DE DESARROLLO, no uno. Next salta al siguiente cuando el 3000
# está ocupado —y lo está en cuanto queda un `pnpm dev` colgado o se levantan
# dos a la vez—, así que el navegador pasa a pedir desde el 3001 y la API le
# contesta un preflight sin cabeceras. El error que sale es "Failed to fetch",
# que no menciona ni el puerto ni CORS. Ya pasó con el backoffice.
ORIGENES="${KUSTTO_ORIGENES:-http://localhost:3000,http://localhost:3001,http://localhost:3002,https://kustto.com.mx,https://www.kustto.com.mx,https://backoffice.kustto.com.mx}"

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
