#!/usr/bin/env bash
#
# El reenviador del buzón y la regla que lo dispara.
#
#   bash infra/lambda-correo.sh
#
# Necesita infra/correo.sh corrido antes: de ahí salen el bucket y el TXT de
# verificación.
#
# A DÓNDE SE REENVÍA
#   KUSTTO_DESTINO. Se guarda en infra/.correo la primera vez. Para cambiarlo:
#     KUSTTO_DESTINO=otro@gmail.com bash infra/lambda-correo.sh
#
#   Mientras la cuenta esté en el sandbox de SES, ese destino tiene que estar
#   VERIFICADO como identidad, o el reenvío falla con un 400 que no dice gran
#   cosa. El script lo pide solo y avisa; hay que hacer clic en el correo que
#   manda AWS.
#
# EL ORDEN DE LAS ACCIONES DE LA REGLA IMPORTA
#   Primero S3, después Lambda. Corren en orden, y la función lee de S3 lo que
#   la acción anterior acaba de dejar. Al revés no habría nada que leer.

set -euo pipefail
cd "$(dirname "$0")/.."
source infra/aws.sh
source infra/.correo

FUNCION="${KUSTTO_LAMBDA_CORREO:-kustto-correo}"
ROL="${FUNCION}-rol"
CONJUNTO="${KUSTTO_REGLAS_CORREO:-kustto-entrada}"
REGLA="reenviar-todo"
REMITENTE="${KUSTTO_REMITENTE:-buzon@${KUSTTO_DOMINIO}}"

if [ -z "${KUSTTO_DESTINO:-}" ]; then
  echo "Falta KUSTTO_DESTINO: a qué bandeja se reenvía." >&2
  echo "  KUSTTO_DESTINO=tu@gmail.com bash infra/lambda-correo.sh" >&2
  exit 1
fi

CUENTA=$(aws_ sts get-caller-identity --query Account --output text)

# ── El rol ─────────────────────────────────────────────────────────────────
if ! aws_ iam get-role --role-name "$ROL" >/dev/null 2>&1; then
  echo "Creando rol $ROL…"
  aws_ iam create-role --role-name "$ROL" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' >/dev/null

  aws_ iam attach-role-policy --role-name "$ROL" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

  # Sólo leer el correo guardado y enviar. Ni borrar, ni tocar la tabla.
  aws_ iam put-role-policy --role-name "$ROL" --policy-name buzon \
    --policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [
        {
          \"Effect\": \"Allow\",
          \"Action\": \"s3:GetObject\",
          \"Resource\": \"arn:aws:s3:::${KUSTTO_BUCKET_CORREO}/${KUSTTO_PREFIJO_CORREO}*\"
        },
        {
          \"Effect\": \"Allow\",
          \"Action\": [\"ses:SendEmail\", \"ses:SendRawEmail\"],
          \"Resource\": \"*\"
        }
      ]
    }"

  echo "Esperando a que IAM propague el rol…"
  sleep 12
fi

ROL_ARN=$(aws_ iam get-role --role-name "$ROL" --query "Role.Arn" --output text)

# ── El paquete ─────────────────────────────────────────────────────────────
echo "Empaquetando…"
(cd services/correo && pnpm build >/dev/null)
rm -f services/correo/correo.zip
if command -v zip >/dev/null 2>&1; then
  (cd services/correo/dist && zip -q -r ../correo.zip handler.mjs)
else
  powershell.exe -NoProfile -Command "Compress-Archive -Path services\correo\dist\handler.mjs -DestinationPath services\correo\correo.zip -Force" >/dev/null
fi

VARIABLES="Variables={KUSTTO_BUCKET_CORREO=$KUSTTO_BUCKET_CORREO,KUSTTO_PREFIJO_CORREO=$KUSTTO_PREFIJO_CORREO,KUSTTO_REMITENTE=$REMITENTE,KUSTTO_DESTINO=$KUSTTO_DESTINO}"

if aws_ lambda get-function --function-name "$FUNCION" >/dev/null 2>&1; then
  echo "Actualizando código…"
  aws_ lambda update-function-code --function-name "$FUNCION" \
    --zip-file fileb://services/correo/correo.zip >/dev/null
  aws_ lambda wait function-updated --function-name "$FUNCION"
  aws_ lambda update-function-configuration --function-name "$FUNCION" \
    --environment "$VARIABLES" >/dev/null
  aws_ lambda wait function-updated --function-name "$FUNCION"
else
  echo "Creando función $FUNCION…"
  aws_ lambda create-function --function-name "$FUNCION" \
    --runtime nodejs20.x --role "$ROL_ARN" --handler handler.handler \
    --zip-file fileb://services/correo/correo.zip \
    --timeout 30 --memory-size 512 --environment "$VARIABLES" >/dev/null
  aws_ lambda wait function-active --function-name "$FUNCION"
fi

# SES invoca la función. Sin este permiso la regla se crea igual y el correo
# se guarda, pero el reenvío no ocurre nunca y no hay error visible.
aws_ lambda add-permission --function-name "$FUNCION" \
  --statement-id ses-buzon \
  --action lambda:InvokeFunction \
  --principal ses.amazonaws.com \
  --source-account "$CUENTA" >/dev/null 2>&1 || true

# ── El destino, mientras haya sandbox ──────────────────────────────────────
ESTADO_DESTINO=$(aws_ ses get-identity-verification-attributes \
  --identities "$KUSTTO_DESTINO" \
  --query "VerificationAttributes.\"${KUSTTO_DESTINO}\".VerificationStatus" \
  --output text 2>/dev/null || echo "None")

if [ "$ESTADO_DESTINO" != "Success" ]; then
  echo "Pidiendo verificación de $KUSTTO_DESTINO…"
  aws_ ses verify-email-identity --email-address "$KUSTTO_DESTINO" >/dev/null
  echo "  ⚠️  Revisa esa bandeja y haz clic en el enlace de AWS."
fi

# ── La regla ───────────────────────────────────────────────────────────────
if ! aws_ ses describe-receipt-rule-set --rule-set-name "$CONJUNTO" >/dev/null 2>&1; then
  echo "Creando conjunto de reglas $CONJUNTO…"
  aws_ ses create-receipt-rule-set --rule-set-name "$CONJUNTO" >/dev/null
fi

ACCIONES="[
  {
    \"S3Action\": {
      \"BucketName\": \"${KUSTTO_BUCKET_CORREO}\",
      \"ObjectKeyPrefix\": \"${KUSTTO_PREFIJO_CORREO}\"
    }
  },
  {
    \"LambdaAction\": {
      \"FunctionArn\": \"arn:aws:lambda:${REGION}:${CUENTA}:function:${FUNCION}\",
      \"InvocationType\": \"Event\"
    }
  }
]"

REGLA_JSON="{
  \"Name\": \"${REGLA}\",
  \"Enabled\": true,
  \"TlsPolicy\": \"Optional\",
  \"Recipients\": [\"${KUSTTO_DOMINIO}\"],
  \"ScanEnabled\": true,
  \"Actions\": ${ACCIONES}
}"

if aws_ ses describe-receipt-rule --rule-set-name "$CONJUNTO" --rule-name "$REGLA" >/dev/null 2>&1; then
  echo "Actualizando la regla…"
  aws_ ses update-receipt-rule --rule-set-name "$CONJUNTO" --rule "$REGLA_JSON" >/dev/null
else
  echo "Creando la regla…"
  aws_ ses create-receipt-rule --rule-set-name "$CONJUNTO" --rule "$REGLA_JSON" >/dev/null
fi

ACTIVO=$(aws_ ses describe-active-receipt-rule-set --query "Metadata.Name" --output text 2>/dev/null || echo "None")
if [ "$ACTIVO" != "$CONJUNTO" ]; then
  echo "Activando $CONJUNTO…"
  aws_ ses set-active-receipt-rule-set --rule-set-name "$CONJUNTO" >/dev/null
fi

grep -v '^KUSTTO_DESTINO=\|^KUSTTO_REMITENTE=' infra/.correo > infra/.correo.tmp || true
mv infra/.correo.tmp infra/.correo
cat >> infra/.correo <<EOF
KUSTTO_REMITENTE=$REMITENTE
KUSTTO_DESTINO=$KUSTTO_DESTINO
EOF

echo
echo "Listo."
echo "  función  : $FUNCION"
echo "  regla    : $CONJUNTO/$REGLA — todo @${KUSTTO_DOMINIO}"
echo "  guarda en: s3://${KUSTTO_BUCKET_CORREO}/${KUSTTO_PREFIJO_CORREO}"
echo "  reenvía a: $KUSTTO_DESTINO (desde $REMITENTE)"
