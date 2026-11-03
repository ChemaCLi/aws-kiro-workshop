#!/usr/bin/env bash
# Construye Focus Garden (Astro) y lo publica en un bucket S3 privado con CloudFront (HTTPS).
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
[[ -f package.json ]] || { echo "Ejecuta el script desde la carpeta del proyecto (donde está package.json)." >&2; exit 1; }
aws sts get-caller-identity >/dev/null || { echo "No hay credenciales de AWS válidas." >&2; exit 1; }

echo "→ Compilando (npm run build)"
npm run build
[[ -f dist/index.html ]] || { echo "El build no generó dist/index.html." >&2; exit 1; }

echo "→ Desplegando infraestructura ($STACK en $REGION)"
aws cloudformation deploy --stack-name "$STACK" --template-file "$TEMPLATE" --region "$REGION" --no-fail-on-empty-changeset

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}
BUCKET="$(output BucketName)"
DISTRIBUTION="$(output DistributionId)"
URL="$(output SiteUrl)"

# sync sube todo con el tipo de contenido que detecta por extensión; .webmanifest se corrige aparte.
echo "→ Subiendo dist/ a s3://$BUCKET"
aws s3 sync dist/ "s3://$BUCKET" --region "$REGION" --delete

echo "→ Ajustando tipos de contenido"
aws s3 cp dist/manifest.webmanifest "s3://$BUCKET/manifest.webmanifest" --region "$REGION" --content-type "application/manifest+json" >/dev/null

echo "→ Invalidando la caché de CloudFront"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" >/dev/null

echo "✓ Publicado: $URL"
echo "  (la primera vez CloudFront puede tardar unos minutos en estar disponible)"
