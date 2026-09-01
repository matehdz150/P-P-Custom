#!/usr/bin/env bash
#
# La tabla única de Kustto.
#
# En DynamoDB no hay migraciones: la definición de la tabla ES el código, y
# este script es la fuente de verdad. Es idempotente — si la tabla ya existe
# no hace nada, así que se puede correr las veces que sea.
#
#   bash infra/tabla.sh
#
# LO QUE VIVE DENTRO (pk / sk)
#
#   CATEGORY      CAT#<id>        una categoría de producto
#   TEMPLATE      TPL#<id>        una plantilla de prenda
#   PRODUCT#<id>  META            el producto completo, en un solo ítem
#   PROVIDER#<id> META            el perfil del taller
#   ORDER#<id>    META            el pedido con su diseño y su bitácora
#   SLUG#<slug>   LOCK            candado de unicidad de slug
#
# Las colecciones chicas que hay que listar enteras —categorías y
# plantillas— comparten partición a propósito: así listarlas es un Query y
# no un Scan. Son unas decenas de ítems que casi nunca se escriben, o sea
# que la partición caliente no es un riesgo aquí.
#
# Los productos NO se listan desde aquí: eso lo resuelve el catálogo
# materializado en S3. Por eso no hay índice para filtrar por técnica,
# color ni días de producción.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh

TABLA="${KUSTTO_TABLA:-kustto-prod}"

if aws_ dynamodb describe-table --table-name "$TABLA" >/dev/null 2>&1; then
  echo "La tabla $TABLA ya existe. Nada que hacer."
  exit 0
fi

echo "Creando $TABLA en $REGION…"

aws_ dynamodb create-table \
  --table-name "$TABLA" \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
      AttributeName=pk,AttributeType=S \
      AttributeName=sk,AttributeType=S \
      AttributeName=gsi1pk,AttributeType=S \
      AttributeName=gsi1sk,AttributeType=S \
      AttributeName=gsi2pk,AttributeType=S \
      AttributeName=gsi2sk,AttributeType=S \
      AttributeName=gsi3pk,AttributeType=S \
      AttributeName=gsi3sk,AttributeType=S \
  --key-schema \
      AttributeName=pk,KeyType=HASH \
      AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes '[
    {
      "IndexName": "gsi1",
      "KeySchema": [
        {"AttributeName": "gsi1pk", "KeyType": "HASH"},
        {"AttributeName": "gsi1sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "gsi2",
      "KeySchema": [
        {"AttributeName": "gsi2pk", "KeyType": "HASH"},
        {"AttributeName": "gsi2sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "gsi3",
      "KeySchema": [
        {"AttributeName": "gsi3pk", "KeyType": "HASH"},
        {"AttributeName": "gsi3sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --output text --query "TableDescription.TableStatus"

echo "Esperando a que quede activa…"
aws_ dynamodb wait table-exists --table-name "$TABLA"

# El stream es de donde cuelga todo lo asíncrono: rearmar el catálogo,
# generar el archivo de impresión, avisarle al taller.
echo
echo "Lista. Stream:"
aws_ dynamodb describe-table --table-name "$TABLA" \
  --query "Table.LatestStreamArn" --output text
