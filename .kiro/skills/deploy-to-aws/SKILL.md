---
name: deploy-to-aws
description: Publica Focus Garden en AWS, tanto el sitio estático (Amplify o S3+CloudFront) como las cuentas opcionales (Cognito + el puente OIDC de GitHub en Lambda). Actívala cuando se pida publicar, desplegar, subir a AWS, hospedar la web app, configurar el login real, obtener una URL pública o actualizar lo ya publicado.
---

# Publicar en AWS

Focus Garden es un sitio **estático construido con Astro** (ver `docs/decisions/0001-migrar-a-astro.md`): `npm run build` genera `dist/` y eso es lo único que se publica. **No se suben** `src/`, `.kiro/`, `docs/`, `.git/`, `node_modules/` ni `README.md`; los scripts de esta skill corren el build y publican `dist/` por ti.

## Elegir ruta

| Ruta | Cuándo | Esfuerzo | Resultado |
|------|--------|----------|-----------|
| **A. Amplify (zip)** | Primera vez, taller, demo | 1 comando | `https://main.<appId>.amplifyapp.com` con HTTPS |
| **B. S3 + CloudFront** | Quieres control, dominio propio o costo mínimo | 2 comandos | `https://<id>.cloudfront.net` con HTTPS, bucket privado |

Pregunta cuál prefiere el usuario; si no sabe, usar la **A**.

## Desde dónde se ejecuta

Los scripts se ejecutan **desde la carpeta de la app** (la que contiene `package.json` y `astro.config.mjs`; en este repositorio es `exercise/`). Los scripts viven en el `.kiro` de la raíz del repositorio, por eso en los comandos de abajo se usa `../.kiro/...`. Si copiaste `.kiro` dentro de tu propio proyecto, usa `.kiro/...`.

## Antes de empezar (ambas rutas)

1. Confirmar con el usuario la **cuenta y región** de AWS. No asumirlas.
2. Verificar credenciales: `aws sts get-caller-identity`. Si falla, guiar a `aws configure sso` o `aws configure`, sin pedir ni guardar claves en archivos del proyecto.
3. Verificar que `aws --version` existe (AWS CLI v2). Si no, enviar a la guía oficial de instalación.
4. Correr `npm install` si falta `node_modules/`, y `npm test` para el QA automatizado (Vitest). Confirmar además que la app abre localmente (`npm run dev`) y que el QA manual pasó (`qa-tester`).
5. **Pedir confirmación antes de crear recursos.** Explicar qué se creará y que puede generar costos (mínimos para un sitio estático). Los scripts corren `npm run build` por ti; no hace falta correrlo antes a mano.

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
- `dist/index.html` es el documento raíz (la landing) y `dist/app.html` es la app (Astro compila a esos nombres por `build.format: 'file'` en `astro.config.mjs`, para no romper el `redirectUri` de Cognito). Ambas son archivos reales y la navegación dentro de la app usa `#/ruta`, así que **no hace falta** reescritura de rutas SPA. Si agregas otra página `.astro`, el build la incluye sola.
- Verificar los tipos de contenido: `.webmanifest` debe servirse como `application/manifest+json`. El script lo fija explícitamente; el resto (`.html`, `.js`, `.css`, `.json`, `.svg`) lo detecta bien `aws s3 sync` por la extensión.
- Sin invalidación, CloudFront puede servir la versión anterior hasta por un día.

## Después de publicar

1. Abrir la URL en el teléfono y en escritorio. Revisar consola sin errores.
2. Comprobar que el jardín 3D y la música cargan (Three.js y Tone.js ahora van empaquetados en el build, ya no por CDN; HTTPS es obligatorio para Wake Lock y algunas APIs).
3. Probar el flujo corto: crear tarea, ronda en modo demo, ver el jardín.
4. Anotar la URL y la fecha en el changelog de `docs/features.md` o en el README del proyecto.

## Cuentas: Cognito + el puente OIDC en Lambda

Esto publica la parte de autenticación opcional (spec `accounts-auth`): el User Pool de Cognito y `oidc-bridge/` (necesario solo para el inicio de sesión con GitHub). Es aparte del sitio estático de arriba y **no usa AWS Secrets Manager**: los secretos del puente viven en **GitHub Secrets** y GitHub Actions los pasa como variables de entorno de la función al desplegar — por eso casi todo esto se hace una sola vez, a mano, y el redeploy de rutina del puente queda automatizado.

### 1. Rol de despliegue para GitHub Actions (una sola vez)

Nunca se guardan llaves de AWS de larga duración en el repositorio. Crea (si no existe ya en la cuenta) el proveedor OIDC de GitHub en IAM y un rol de confianza acotado a este repo:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1   # ver nota de aws-iam: AWS ya no exige thumbprint real para la mayoría de proveedores OIDC, pero el parámetro es obligatorio en la API
```

Crea el rol con una trust policy que exija `repo:<owner>/<repo>:*` (ajusta el repo) y adjúntale permisos **solo** para `lambda-web:*` sobre la función `focus-garden-oidc-bridge` (no permisos de administrador). Guarda su ARN en la variable de repositorio `AWS_DEPLOY_ROLE_ARN` (GitHub: Settings > Secrets and variables > Actions > Variables).

### 2. Tabla de DynamoDB y rol de ejecución de la Lambda (una sola vez)

El code efímero entre `/callback` y `/token` del puente vive en DynamoDB, no en memoria (ver `oidc-bridge/README.md`, "Tabla de DynamoDB para los authorization code" — ahí están los comandos exactos de `create-table`). Crea después un rol de **ejecución** (el que asume la Lambda al correr, distinto del rol de despliegue del paso 1) con el permiso básico de Lambda (`AWSLambdaBasicExecutionRole`, para CloudWatch Logs) más una política acotada a `dynamodb:PutItem` y `dynamodb:DeleteItem` solo sobre el ARN de esa tabla. Guarda su ARN en la variable de repositorio `OIDC_BRIDGE_EXECUTION_ROLE_ARN`.

### 3. Secretos y config del puente en GitHub

En Settings > Secrets and variables > Actions del repositorio:

| Nombre | Tipo | Valor |
|--------|------|-------|
| `OIDC_BRIDGE_GH_CLIENT_SECRET` | Secret | Client secret de la OAuth App de GitHub |
| `OIDC_SIGNING_KEY` | Secret | Llave privada RS256 (ver "Generar la clave de firma RS256" en `oidc-bridge/README.md`) |
| `OIDC_BRIDGE_GH_CLIENT_ID` | Variable | Client id de la OAuth App de GitHub |
| `OIDC_KEY_ID` | Variable | `kid` de la llave de firma |
| `ALLOWED_ORIGINS` | Variable | Orígenes permitidos, separados por comas |
| `ISSUER` | Variable | URL pública del puente (la que da el primer deploy) |
| `CODE_STORE_TABLE_NAME` | Variable | Nombre de la tabla del paso 2 |

Nunca uses el prefijo `GITHUB_` para un secreto o variable propia: GitHub Actions lo reserva para sus propias variables y rechaza el nombre.

### 4. Desplegar el puente

El workflow `.github/workflows/deploy-oidc-bridge.yml` corre `aws lambda-web deploy` en cada push a `main` que toque `oidc-bridge/**` (o manualmente desde la pestaña Actions). La primera vez crea la Web Function y su endpoint HTTPS (`authType: ApplicationManaged`, público); las siguientes actualizan la misma. Anota la URL que imprime: es el `ISSUER`/`oidcBridgeEndpoint`, y hay que corregir la variable `ISSUER` de GitHub con el valor real después del primer deploy (hay una dependencia circular: el issuer de la función es su propia URL, que solo se conoce después de crearla).

### 5. Cognito: User Pool, App Client y los 4 proveedores

```bash
# User Pool + dominio del Hosted UI
aws cognito-idp create-user-pool --pool-name focus-garden --query 'UserPool.Id' --output text
aws cognito-idp create-user-pool-domain --user-pool-id <pool-id> --domain focus-garden --managed-login-version 2

# App Client público (sin secreto), authorization code + PKCE
aws cognito-idp create-user-pool-client \
  --user-pool-id <pool-id> --client-name focus-garden-web \
  --no-generate-secret \
  --allowed-o-auth-flows-user-pool-client \
  --allowed-o-auth-flows code --allowed-o-auth-scopes openid email profile \
  --supported-identity-providers COGNITO \
  --callback-urls "http://localhost:4321/app.html" \
  --logout-urls "http://localhost:4321/app.html"
```

Después de crear el App Client, si el dominio usa managed login v2, asígnale un estilo (si no, su página de login queda rota):

```bash
aws cognito-idp create-managed-login-branding \
  --user-pool-id <pool-id> --client-id <client-id> --use-cognito-provided-values
```

Registra los proveedores (nunca pongas un `client_secret` en la línea de comandos; pásalo con `file://` desde un archivo temporal con `umask 077`, ver la skill `aws-auth`):

- **Google, Meta (Facebook), Login with Amazon**: `create-identity-provider` con `--provider-type Google|Facebook|LoginWithAmazon`. Las tres OAuth Apps aún no existen — créalas en sus consolas con el redirect `https://<dominio-cognito>/oauth2/idpresponse` (Google Cloud Console, Meta for Developers, Amazon Developer Console).
- **GitHub**: `--provider-type OIDC` con `--provider-details issuer=<ISSUER-del-puente>,client_id=...,client_secret=...,attributes_request_method=GET`. La OAuth App de GitHub (Settings > Developer settings > OAuth Apps) usa como redirect `https://<url-de-la-lambda>/callback` (el del puente, no el de Cognito). Ver también `oidc-bridge/README.md`, "Registrar el puente como proveedor OIDC en Cognito".

Agrega los 4 (`Google`, `Facebook`, `LoginWithAmazon`, el nombre del proveedor OIDC de GitHub) a `--supported-identity-providers` del App Client con un **read-modify-write completo** (`update-user-pool-client` reemplaza todo el cliente; lee primero con `describe-user-pool-client`, aplica el cambio y reenvía el objeto entero — ver la skill `aws-auth`, es un error fácil de cometer que rompe el cliente en silencio).

### 6. Conectar con el frontend

Copia `exercise/.env.example` a `exercise/.env` y pon ahí `PUBLIC_COGNITO_USER_POOL_ID`, `PUBLIC_COGNITO_CLIENT_ID`, `PUBLIC_COGNITO_DOMAIN` y `PUBLIC_OIDC_BRIDGE_ENDPOINT` con los valores reales de este User Pool y del puente. Publica el sitio (Ruta A o B de arriba) y, ya con su URL de CloudFront/Amplify, vuelve a `update-user-pool-client` para agregar `https://<dominio-del-sitio>/app.html` a `--callback-urls`/`--logout-urls` (otra vez, read-modify-write completo).

## Progreso en la nube: sync-api

Esto publica el spec `cloud-sync`: `sync-api/`, el servicio que guarda tareas/rondas/timer/ajustes por persona (ver `sync-api/README.md`). Mismo patrón de despliegue que el puente (Lambda Web Function + GitHub Actions con OIDC federation), pero **ninguna de sus variables es secreta** — el JWKS de Cognito que valida es público por diseño — así que todo va como GitHub Variables, sin Secrets.

### 1. Tabla de DynamoDB y roles (una sola vez)

```bash
aws dynamodb create-table \
  --table-name focus-garden-cloud-sync \
  --attribute-definitions AttributeName=sub,AttributeType=S \
  --key-schema AttributeName=sub,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Sin TTL (a diferencia de la tabla del puente): es dato durable, no efímero. Crea un rol de **ejecución** nuevo (`AWSLambdaBasicExecutionRole` + `dynamodb:GetItem`/`PutItem` solo sobre esta tabla) — guarda su ARN en la variable `SYNC_API_EXECUTION_ROLE_ARN` — y un rol de **despliegue** nuevo para GitHub Actions (mismo proveedor OIDC de IAM del paso 1 de la sección de Cognito, permisos acotados a `lambda-web:*` sobre `focus-garden-sync-api`) — guarda su ARN en `SYNC_API_DEPLOY_ROLE_ARN`.

### 2. Variables de GitHub (ninguna es secreta)

| Nombre | Valor |
|--------|-------|
| `SYNC_API_DEPLOY_ROLE_ARN` | ARN del rol de despliegue de arriba |
| `SYNC_API_EXECUTION_ROLE_ARN` | ARN del rol de ejecución de arriba |
| `SYNC_API_COGNITO_USER_POOL_ID` | El mismo User Pool que ya usa el frontend |
| `SYNC_API_COGNITO_CLIENT_ID` | El mismo App Client que ya usa el frontend |
| `ALLOWED_ORIGINS` | Orígenes permitidos, separados por comas (puede reutilizar el mismo valor que el puente) |
| `SYNC_TABLE_NAME` | Nombre de la tabla del paso 1 |

### 3. Desplegar

El workflow `.github/workflows/deploy-sync-api.yml` corre `aws lambda-web deploy` en cada push a `main` que toque `sync-api/**` (o manualmente desde Actions). Anota la URL que imprime el primer deploy: es `PUBLIC_SYNC_API_ENDPOINT`.

### 4. Conectar con el frontend

Agrega `PUBLIC_SYNC_API_ENDPOINT` a `exercise/.env` con la URL del paso 3 y vuelve a publicar el sitio (Ruta A o B de arriba).

## Limpieza (importante en un taller)

Pedir confirmación y eliminar lo creado para no dejar recursos:

```bash
# Amplify
aws amplify delete-app --app-id "$(cat .amplify-app-id)" && rm .amplify-app-id
# S3 + CloudFront: vaciar el bucket y borrar el stack
aws s3 rm "s3://<bucket>" --recursive
aws cloudformation delete-stack --stack-name <nombre-stack>
# Cuentas: el puente, su tabla y el User Pool (en este orden, para no dejar nada huérfano)
aws lambda-web delete-web-function --function-name focus-garden-oidc-bridge
aws dynamodb delete-table --table-name focus-garden-oidc-bridge-codes
aws cognito-idp delete-user-pool-domain --user-pool-id <pool-id> --domain focus-garden
aws cognito-idp delete-user-pool --user-pool-id <pool-id>
# Progreso en la nube: sync-api y su tabla
aws lambda-web delete-web-function --function-name focus-garden-sync-api
aws dynamodb delete-table --table-name focus-garden-cloud-sync
```

No olvides borrar también las OAuth Apps de Google/Meta/Amazon/GitHub si ya no se van a usar, y los GitHub Secrets/Variables del repositorio.

## Empaquetar manualmente

```bash
npm run build
(cd dist && zip -r ../site.zip . -x "*.DS_Store")
```

## Seguridad

- Nunca poner claves de AWS en el repositorio ni en los scripts.
- El bucket de la ruta B es privado; solo CloudFront puede leerlo.
- No usar `--acl public-read`.
