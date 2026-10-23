#!/usr/bin/env bash
# Copia los agentes de agentes/ a la carpeta .kiro/agents/ de cada escenario.
set -euo pipefail
cd "$(dirname "$0")"
for escenario in 01-exploracion 02-compartible 03-profesional; do
  mkdir -p "$escenario/.kiro/agents"
  cp agentes/*.md "$escenario/.kiro/agents/"
  echo "Agentes copiados en $escenario/.kiro/agents/"
done
