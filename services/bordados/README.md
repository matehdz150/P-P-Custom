# Bordado: API asíncrona

`POST /bordados/jobs` y `GET /bordados/jobs/:jobId` requieren el JWT del pool de compradores. El API valida producto, lado, técnica, medidas y el snapshot; SQS sólo recibe `jobId` y `designHash`.

La implementación se instala con `bash infra/bordado.sh`, pero el script no forma parte de ningún despliegue general y tanto API como worker quedan con `KUSTTO_EMBROIDERY_ENABLED=false` salvo habilitación explícita.

Los parámetros de `experimental-v1-2026-09-05` proceden del spike y no tienen validación física. No conectar a checkout ni taller antes de test-sew.
