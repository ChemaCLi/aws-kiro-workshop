---
name: deploy-to-aws
description: Publica Focus Garden en AWS como sitio estático de la forma más sencilla. Actívala cuando se pida publicar, desplegar, subir a AWS, hospedar la web app, obtener una URL pública o actualizar el sitio ya publicado. Incluye dos rutas, AWS Amplify (la más fácil) y S3 + CloudFront (más control), con scripts listos.
---

# Publicar en AWS

Focus Garden es un sitio **100 % estático** (sin build). Se publica copiando `index.html`, `manifest.webmanifest`, `icon.svg`, `melodies/` y `src/`. **No se suben** `.kiro/`, `docs/`, `.git/` ni `README.md`.

## Elegir ruta

| Ruta | Cuándo | Esfuerzo | Resultado |
|------|--------|----------|-----------|
| **A. Amplify (zip)** | Primera vez, taller, demo | 1 comando | `https://main.<appId>.amplifyapp.com` con HTTPS |
| **B. S3 + CloudFront** | Quieres control, dominio propio o costo mínimo | 2 comandos | `https://<id>.cloudfront.net` con HTTPS, bucket privado |

Pregunta cuál prefiere el usuario; si no sabe, usar la **A**.

## Desde dónde se ejecuta

Los scripts se ejecutan **desde la carpeta de la app** (la que contiene `index.html`; en este repositorio es `exercise/`). Los scripts viven en el `.kiro` de la raíz del repositorio, por eso en los comandos de abajo se usa `../.kiro/...`. Si copiaste `.kiro` dentro de tu propio proyecto, usa `.kiro/...`.

## Antes de empezar (ambas rutas)

1. Confirmar con el usuario la **cuenta y región** de AWS. No asumirlas.
2. Verificar credenciales: `aws sts get-caller-identity`. Si falla, guiar a `aws configure sso` o `aws configure`, sin pedir ni guardar claves en archivos del proyecto.
3. Verificar que `aws --version` existe (AWS CLI v2). Si no, enviar a la guía oficial de instalación.
4. Confirmar que la app abre localmente y que el QA básico pasó (`qa-tester`).
5. **Pedir confirmación antes de crear recursos.** Explicar qué se creará y que puede generar costos (mínimos para un sitio estático).

## Ruta A: Amplify con zip

```bash
bash ../.kiro/skills/deploy-to-aws/scripts/deploy-amplify.sh [nombre-app] [región]
```

El script: arma `site.zip` solo con los archivos publicables, crea la app y la rama `main` la primera vez, sube el zip y lanza el despliegue. Guarda el id de la app en `.amplify-app-id` para que las siguientes ejecuciones **actualicen** el mismo sitio. Imprime la URL.

Alternativa sin CLI: consola de Amplify > **Create new app** > **Deploy without Git provider** > arrastrar `site.zip` (crearlo con la sección "Empaquetar" de abajo).

## Ruta B: S3 + CloudFront

```bash
bash ../.kiro/skills/deploy-to-aws/scripts/deploy-s3-cloudfront.sh <nombre-stack> [región]
```

El script despliega `scripts/cloudfront.yaml` (bucket privado + CloudFront con Origin Access Control + HTTPS), sincroniza los archivos con `aws s3 sync` y crea una invalidación de caché. Imprime la URL. Volver a ejecutarlo actualiza el sitio.

Notas:
- `index.html` es el documento raíz. La navegación usa `#/ruta`, así que **no hace falta** reescritura de rutas SPA.
- Verificar los tipos de contenido: `.webmanifest` debe servirse como `application/manifest+json`, `.json` como `application/json` y `.js` como `text/javascript`. El script los fija explícitamente.
- Sin invalidación, CloudFront puede servir la versión anterior hasta por un día.

## Después de publicar

1. Abrir la URL en el teléfono y en escritorio. Revisar consola sin errores.
2. Comprobar que Tailwind, Tone.js y Three.js cargan (están por CDN; HTTPS es obligatorio para Wake Lock y algunas APIs).
3. Probar el flujo corto: crear tarea, ronda en modo demo, ver el jardín.
4. Anotar la URL y la fecha en el changelog de `docs/features.md` o en el README del proyecto.

## Limpieza (importante en un taller)

Pedir confirmación y eliminar lo creado para no dejar recursos:

```bash
# Amplify
aws amplify delete-app --app-id "$(cat .amplify-app-id)" && rm .amplify-app-id
# S3 + CloudFront: vaciar el bucket y borrar el stack
aws s3 rm "s3://<bucket>" --recursive
aws cloudformation delete-stack --stack-name <nombre-stack>
```

## Empaquetar manualmente

```bash
zip -r site.zip index.html manifest.webmanifest icon.svg melodies src -x "*.DS_Store"
```

## Migración a otro stack

Si el proyecto ya usa React o Vue con build (Vite), publicar la carpeta `dist/` en lugar de la raíz, con la misma plantilla de S3 + CloudFront, y añadir reescritura de rutas si se usa router por historial. Ver skill `migrate-to-react-or-vue`.

## Seguridad

- Nunca poner claves de AWS en el repositorio ni en los scripts.
- El bucket de la ruta B es privado; solo CloudFront puede leerlo.
- No usar `--acl public-read`.
