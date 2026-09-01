#!/usr/bin/env bash
#
# Los dos buckets de Kustto. La línea que los separa es quién puede verlos,
# no qué guardan.
#
#   bash infra/buckets.sh
#
#   kustto-publico-prod   mockups y fotos de producto.
#                         Se sirven por CloudFront, nunca directo del bucket.
#                         Los mockups TIENEN que salir por el mismo origen
#                         que el sitio: el teñido de prenda hace
#                         getImageData() sobre ellos y con otro origen el
#                         canvas queda contaminado y el teñido se apaga solo,
#                         sin error visible. Ver lib/fabric/prenda.ts.
#
#   kustto-privado-prod   logos que sube el cliente y archivos de impresión.
#                         Nunca públicos. El proveedor los baja con URL
#                         prefirmada: el arte del cliente no debe poder
#                         enumerarse.
#
# Los dos nacen con el acceso público bloqueado. "Público" quiere decir
# accesible a través de CloudFront, no que el bucket esté abierto.
#
# Versionado prendido en los dos: si alguien sobrescribe un mockup con el
# archivo equivocado, la versión anterior sigue ahí.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

PUBLICO="${KUSTTO_BUCKET_PUBLICO:-kustto-publico-prod}"
PRIVADO="${KUSTTO_BUCKET_PRIVADO:-kustto-privado-prod}"

crear_bucket() {
  local nombre="$1"

  if aws_ s3api head-bucket --bucket "$nombre" >/dev/null 2>&1; then
    echo "  $nombre ya existe"
    return 0
  fi

  # us-east-1 es la única región donde create-bucket NO lleva
  # LocationConstraint. Pasárselo es un error.
  if [ "$REGION" = "us-east-1" ]; then
    aws_ s3api create-bucket --bucket "$nombre" >/dev/null
  else
    aws_ s3api create-bucket --bucket "$nombre" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi

  aws_ s3api put-public-access-block --bucket "$nombre" \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

  aws_ s3api put-bucket-versioning --bucket "$nombre" \
    --versioning-configuration Status=Enabled

  aws_ s3api put-bucket-encryption --bucket "$nombre" \
    --server-side-encryption-configuration \
      '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

  echo "  $nombre creado"
}

echo "Buckets en $REGION:"
crear_bucket "$PUBLICO"
crear_bucket "$PRIVADO"

echo
echo "Estado:"
for b in "$PUBLICO" "$PRIVADO"; do
  bloqueo=$(aws_ s3api get-public-access-block --bucket "$b" \
    --query "PublicAccessBlockConfiguration.BlockPublicPolicy" --output text)
  version=$(aws_ s3api get-bucket-versioning --bucket "$b" \
    --query "Status" --output text)
  echo "  $b · público bloqueado: $bloqueo · versionado: $version"
done
