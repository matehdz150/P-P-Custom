#!/usr/bin/env bash
#
# Las métricas que k6 NO puede ver, recogidas de CloudWatch tras una ejecución.
#
#   bash pruebas/carga/recoger-metricas.sh <minutos-hacia-atras>
#
# POR QUÉ HACE FALTA ESTE ARCHIVO. k6 mide desde fuera: latencia y códigos de
# respuesta. La mitad de los criterios que interesan viven dentro de AWS —
# concurrencia de Lambda, throttles, duración, peticiones limitadas de DynamoDB—
# y ahí k6 no llega. Poner un umbral de k6 sobre esas métricas sería escribir un
# umbral que no puede saltar nunca.
#
# NO TOCA NADA. Sólo lee.

set -euo pipefail
cd "$(dirname "$0")/../.."
source infra/aws.sh

MINUTOS="${1:-30}"
DESDE=$(date -u -v-"${MINUTOS}"M +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -d "${MINUTOS} minutes ago" +%Y-%m-%dT%H:%M:%S)
HASTA=$(date -u +%Y-%m-%dT%H:%M:%S)

echo "Ventana: $DESDE → $HASTA (UTC)"
echo

pico() {  # namespace metrica dimension estadistico etiqueta
  local v
  v=$(aws_ cloudwatch get-metric-statistics \
    --namespace "$1" --metric-name "$2" \
    ${3:+--dimensions "$3"} \
    --start-time "$DESDE" --end-time "$HASTA" \
    --period 60 --statistics "$4" \
    --query "reverse(sort_by(Datapoints,&$4))[0].$4" --output text 2>/dev/null || echo "n/d")
  printf "  %-46s %s\n" "$5" "${v:-0}"
}

echo "── Lambda ─────────────────────────────────────────────────"
for F in kustto-admin kustto-compradores kustto-proveedores; do
  echo "  [$F]"
  pico AWS/Lambda ConcurrentExecutions "Name=FunctionName,Value=$F" Maximum "    concurrencia (pico)"
  pico AWS/Lambda Throttles            "Name=FunctionName,Value=$F" Sum     "    throttles (max/min)"
  pico AWS/Lambda Duration             "Name=FunctionName,Value=$F" Maximum "    duración máxima (ms)"
  pico AWS/Lambda Duration             "Name=FunctionName,Value=$F" Average "    duración media (ms)"
  pico AWS/Lambda Errors               "Name=FunctionName,Value=$F" Sum     "    errores (max/min)"
done

echo
echo "── Concurrencia de la CUENTA (la cuota compartida) ────────"
pico AWS/Lambda ConcurrentExecutions "" Maximum "  concurrencia total (pico)"
echo "  cuota actual:"
aws_ lambda get-account-settings --query "AccountLimit.ConcurrentExecutions" --output text | sed 's/^/    /'

echo
echo "── API Gateway ────────────────────────────────────────────"
pico AWS/ApiGateway 4xx   "Name=ApiId,Value=kd8ydpp2c6" Sum "  4xx (incluye 429)"
pico AWS/ApiGateway 5xx   "Name=ApiId,Value=kd8ydpp2c6" Sum "  5xx"
pico AWS/ApiGateway Count "Name=ApiId,Value=kd8ydpp2c6" Sum "  peticiones (max/min)"
pico AWS/ApiGateway Latency "Name=ApiId,Value=kd8ydpp2c6" Average "  latencia media (ms)"
echo "  NOTA: API Gateway HTTP no separa 429 de los demás 4xx en CloudWatch."
echo "        El conteo fiable de 429 es el de k6 (kustto_429)."

echo
echo "── DynamoDB ───────────────────────────────────────────────"
pico AWS/DynamoDB ThrottledRequests           "Name=TableName,Value=kustto-prod" Sum "  peticiones limitadas"
pico AWS/DynamoDB ConsumedReadCapacityUnits   "Name=TableName,Value=kustto-prod" Sum "  RCU consumidas (max/min)"
pico AWS/DynamoDB ConsumedWriteCapacityUnits  "Name=TableName,Value=kustto-prod" Sum "  WCU consumidas (max/min)"
pico AWS/DynamoDB SuccessfulRequestLatency    "Name=TableName,Value=kustto-prod,Name=Operation,Value=Query" Average "  latencia de Query (ms)"

echo
echo "── SQS ────────────────────────────────────────────────────"
COLAS=$(aws_ sqs list-queues --query "QueueUrls" --output text 2>/dev/null || true)
if [ -z "$COLAS" ] || [ "$COLAS" = "None" ]; then
  echo "  NO HAY NINGUNA COLA en esta cuenta."
  echo "  ApproximateAgeOfOldestMessage no existe todavía: el correo y el aviso"
  echo "  al taller se mandan de forma SÍNCRONA dentro de la petición. Esa"
  echo "  métrica sólo tendrá sentido cuando el correo pase a ser asíncrono."
else
  for Q in $COLAS; do
    printf "  [%s]\n" "$(basename "$Q")"
    pico AWS/SQS ApproximateAgeOfOldestMessage "Name=QueueName,Value=$(basename "$Q")" Maximum "    antigüedad del más viejo (s)"
    pico AWS/SQS ApproximateNumberOfMessagesVisible "Name=QueueName,Value=$(basename "$Q")" Maximum "    mensajes en cola"
  done
fi

echo
echo "── SES ────────────────────────────────────────────────────"
aws_ sesv2 get-account --query "{enviados24h:SendQuota.SentLast24Hours,tope24h:SendQuota.Max24HourSend,tasaMax:SendQuota.MaxSendRate,produccion:ProductionAccessEnabled}" --output table 2>/dev/null || echo "  n/d"
