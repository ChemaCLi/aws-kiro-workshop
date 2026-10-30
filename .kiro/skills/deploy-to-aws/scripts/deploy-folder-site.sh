#!/usr/bin/env bash
# Publica una carpeta estática (HTML de entrada + subcarpetas) en S3 privado + CloudFront (HTTPS).
# Uso: bash deploy-folder-site.sh <nombre-stack> <carpeta> <archivo-html-de-entrada> <subcarpetas,separadas,por,coma> [región]
# Ejemplo: bash deploy-folder-site.sh workshop-presentation workshop/presentation presentation.html css,js,assets us-east-1
# La página de entrada se sirve como index.html. Reutiliza cloudfront.yaml. Volver a ejecutarlo actualiza el sitio.
set -euo pipefail

STACK="${1:?Indica el nombre del stack, por ejemplo: workshop-presentation}"
DIR="${2:?Indica la carpeta a publicar}"
ENTRY="${3:?Indica el HTML de entrada dentro de la carpeta, por ejemplo: presentation.html}"
SUBDIRS="${4:?Indica las subcarpetas a publicar separadas por coma, por ejemplo: css,js,assets}"
REGION="${5:-${AWS_REGION:-${AWS_DEFAULT_REGION:-}}}"
TEMPLATE="$(dirname "$0")/cloudfront.yaml"

if [[ -z "$REGION" ]]; then
  echo "Indica la región como quinto argumento, por ejemplo us-east-1." >&2
  exit 1
fi
[[ -f "$DIR/$ENTRY" ]] || { echo "No existe $DIR/$ENTRY" >&2; exit 1; }
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

# Solo se suben las subcarpetas indicadas; sync detecta el tipo de contenido por extensión.
INCLUDES=()
IFS=',' read -r -a FOLDERS <<< "$SUBDIRS"
for folder in "${FOLDERS[@]}"; do
  INCLUDES+=(--include "$folder/*")
done

echo "→ Subiendo $SUBDIRS a s3://$BUCKET"
aws s3 sync "$DIR" "s3://$BUCKET" --region "$REGION" --delete \
  --exclude "*" "${INCLUDES[@]}" --exclude "*.DS_Store" --no-progress

echo "→ Subiendo $ENTRY como index.html"
aws s3 cp "$DIR/$ENTRY" "s3://$BUCKET/index.html" --region "$REGION" --content-type "text/html; charset=utf-8" >/dev/null

echo "→ Invalidando la caché de CloudFront"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" >/dev/null

echo "✓ Publicado: $URL"
echo "  (la primera vez CloudFront puede tardar unos minutos en estar disponible)"
