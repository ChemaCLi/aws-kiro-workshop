#!/usr/bin/env bash
# Publica una página HTML de un solo archivo (sin build) en S3 privado + CloudFront (HTTPS).
# Uso: bash deploy-single-page.sh <nombre-stack> <ruta/a/index.html> [región]
# Reutiliza cloudfront.yaml. Volver a ejecutarlo actualiza el sitio.
set -euo pipefail

STACK="${1:?Indica el nombre del stack, por ejemplo: workshop-prompts}"
PAGE="${2:?Indica la ruta del HTML, por ejemplo: ../workshop/prompts/index.html}"
REGION="${3:-${AWS_REGION:-${AWS_DEFAULT_REGION:-}}}"
TEMPLATE="$(dirname "$0")/cloudfront.yaml"

if [[ -z "$REGION" ]]; then
  echo "Indica la región: bash deploy-single-page.sh $STACK $PAGE us-east-1" >&2
  exit 1
fi
[[ -f "$PAGE" ]] || { echo "No existe el archivo: $PAGE" >&2; exit 1; }
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

# La página se sirve siempre como index.html, sin importar cómo se llame el archivo local.
echo "→ Subiendo $PAGE a s3://$BUCKET/index.html"
aws s3 cp "$PAGE" "s3://$BUCKET/index.html" --region "$REGION" --content-type "text/html; charset=utf-8" >/dev/null

echo "→ Invalidando la caché de CloudFront"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" >/dev/null

echo "✓ Publicado: $URL"
echo "  (la primera vez CloudFront puede tardar unos minutos en estar disponible)"
