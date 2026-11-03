#!/usr/bin/env bash
# Construye Focus Garden (Astro) y lo publica en AWS Amplify subiendo un zip de dist/, sin Git.
# Uso: bash deploy-amplify.sh [nombre-app] [región]
# La primera vez crea la app; las siguientes actualizan la misma (id guardado en .amplify-app-id).
set -euo pipefail

APP_NAME="${1:-focus-garden}"
REGION="${2:-${AWS_REGION:-${AWS_DEFAULT_REGION:-}}}"
BRANCH="main"
ID_FILE=".amplify-app-id"
ZIP_FILE="site.zip"

if [[ -z "$REGION" ]]; then
  echo "Indica la región: bash deploy-amplify.sh $APP_NAME us-east-1" >&2
  exit 1
fi
[[ -f package.json ]] || { echo "Ejecuta el script desde la carpeta del proyecto (donde está package.json)." >&2; exit 1; }
aws sts get-caller-identity >/dev/null || { echo "No hay credenciales de AWS válidas." >&2; exit 1; }

echo "→ Compilando (npm run build)"
npm run build

echo "→ Empaquetando dist/"
rm -f "$ZIP_FILE"
(cd dist && zip -qr "../$ZIP_FILE" . -x "*.DS_Store")

if [[ -f "$ID_FILE" ]]; then
  APP_ID="$(cat "$ID_FILE")"
  echo "→ Actualizando la app existente $APP_ID"
else
  echo "→ Creando la app $APP_NAME en $REGION"
  APP_ID="$(aws amplify create-app --name "$APP_NAME" --region "$REGION" --query app.appId --output text)"
  aws amplify create-branch --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" >/dev/null
  echo "$APP_ID" > "$ID_FILE"
fi

echo "→ Subiendo el zip"
read -r JOB_ID UPLOAD_URL < <(aws amplify create-deployment \
  --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" \
  --query '[jobId,zipUploadUrl]' --output text)
curl --fail --silent --show-error -T "$ZIP_FILE" "$UPLOAD_URL"

echo "→ Iniciando el despliegue"
aws amplify start-deployment --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" --region "$REGION" >/dev/null

# Espera a que termine
for _ in $(seq 1 30); do
  STATUS="$(aws amplify get-job --app-id "$APP_ID" --branch-name "$BRANCH" --job-id "$JOB_ID" --region "$REGION" --query job.summary.status --output text)"
  [[ "$STATUS" == "SUCCEED" ]] && break
  [[ "$STATUS" == "FAILED" || "$STATUS" == "CANCELLED" ]] && { echo "El despliegue terminó con estado $STATUS" >&2; exit 1; }
  sleep 4
done

rm -f "$ZIP_FILE"
echo "✓ Publicado: https://${BRANCH}.${APP_ID}.amplifyapp.com"
