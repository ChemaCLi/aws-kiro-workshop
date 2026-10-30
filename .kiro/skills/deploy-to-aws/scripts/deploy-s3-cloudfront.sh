#!/usr/bin/env bash
# Publica Focus Garden en un bucket S3 privado con CloudFront (HTTPS).
# Uso: bash deploy-s3-cloudfront.sh <nombre-stack> [región]
# Volver a ejecutarlo actualiza el sitio.
set -euo pipefail

STACK="${1:?Indica el nombre del stack, por ejemplo: focus-garden}"
REGION="${2:-${AWS_REGION:-${AWS_DEFAULT_REGION:-}}}"
TEMPLATE="$(dirname "$0")/cloudfront.yaml"

if [[ -z "$REGION" ]]; then
  echo "Indica la región: bash deploy-s3-cloudfront.sh $STACK us-east-1" >&2
  exit 1
fi
[[ -f index.html ]] || { echo "Ejecuta el script desde la carpeta del proyecto (donde está index.html)." >&2; exit 1; }
aws sts get-caller-identity >/dev/null || { echo "No hay credenciales de AWS válidas." >&2; exit 1; }

echo "→ Desplegando infraestructura ($STACK en $REGION)"
aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" --region "$REGION" --no-fail-on-empty-changeset

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET="$(output BucketName)"
DISTRIBUTION="$(output DistributionId)"
URL="$(output SiteUrl)"

# sync sube todo con el tipo de contenido que detecta; luego se fijan los que importan.
echo "→ Subiendo archivos a s3://$BUCKET"
aws s3 sync . "s3://$BUCKET" --region "$REGION" --delete \
  --exclude "*" --include "index.html" --include "manifest.webmanifest" --include "icon.svg" \
  --include "melodies/*" --include "src/*"

echo "→ Ajustando tipos de contenido"
aws s3 cp manifest.webmanifest "s3://$BUCKET/manifest.webmanifest" --region "$REGION" --content-type "application/manifest+json" >/dev/null
aws s3 cp icon.svg "s3://$BUCKET/icon.svg" --region "$REGION" --content-type "image/svg+xml" >/dev/null
aws s3 cp melodies "s3://$BUCKET/melodies" --recursive --region "$REGION" --content-type "application/json" --exclude "*" --include "*.json" >/dev/null
aws s3 cp src "s3://$BUCKET/src" --recursive --region "$REGION" --content-type "text/javascript" --exclude "*" --include "*.js" >/dev/null

echo "→ Invalidando la caché de CloudFront"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" >/dev/null

echo "✓ Publicado: $URL"
echo "  (la primera vez CloudFront puede tardar unos minutos en estar disponible)"
