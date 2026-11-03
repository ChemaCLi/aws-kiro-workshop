# Puente OIDC de GitHub

Servicio Node + Express que permite **iniciar sesión con GitHub** en Focus Garden a través de Amazon Cognito. Es el único backend del proyecto; el resto de la app es estática.

## Por qué existe

Cognito ya soporta de forma nativa a Google, Meta y Login with Amazon, pero **no a GitHub**. GitHub habla OAuth 2.0, no OpenID Connect (OIDC): no emite un `id_token` firmado ni publica un documento de descubrimiento, que es lo que Cognito espera de un proveedor OIDC.

Este puente cubre ese hueco. Se registra en Cognito como un **proveedor OIDC** y, de cara a Cognito, se comporta como cualquier IdP OIDC estándar: expone descubrimiento, JWKS, `/authorize` y `/token`. Por dentro traduce ese contrato al flujo OAuth de GitHub, canjea el perfil del usuario y firma un `id_token` RS256 propio que Cognito valida contra el JWKS del puente.

El punto clave de seguridad: **los secretos (el client secret de GitHub y la clave privada de firma) viven solo en el servidor**, en variables de entorno. Nunca llegan al frontend. El frontend (`exercise/src/core/auth-config.js`) solo conoce la URL pública del puente.

## Flujo resumido

Cognito actúa como cliente del puente; el puente actúa como cliente de GitHub.

```
account-view → Cognito → oidc-bridge /authorize → GitHub
GitHub → oidc-bridge /callback → (canje + perfil) → Cognito
Cognito → oidc-bridge POST /token → id_token OIDC firmado
Cognito → oidc-bridge /.well-known/jwks.json (valida la firma)
```

El `/callback` no firma el token: emite un *authorization code* efímero propio (un solo uso, caduca en minutos) y redirige a Cognito con él. Cognito canjea ese code en `POST /token`, y solo ahí el puente firma el `id_token`. Ver el diagrama de secuencia completo en `.kiro/specs/accounts-auth/design.md` ("Flujo: GitHub vía el puente OIDC Node/Express").

## Contrato de endpoints

| Método y ruta | Responsabilidad |
|---------------|-----------------|
| `GET /.well-known/openid-configuration` | Documento de descubrimiento OIDC. Cognito lo lee para saber dónde están `/authorize`, `/token` y el JWKS, y qué capacidades ofrece el puente (code flow, RS256, claims básicos). El `issuer` y las URLs se derivan de `ISSUER`. |
| `GET /.well-known/jwks.json` | Clave **pública** de firma en formato JWKS. Cognito la usa para validar la firma de los `id_token` que emite el puente. Solo material público; nunca la clave privada. |
| `GET /authorize` | Entrada del flujo. Valida que el origen (cabecera `Origin` o la `redirect_uri`) pertenezca a la allowlist exacta, genera su propio `state` (defensa CSRF del tramo puente↔GitHub), recuerda el `state` y la `redirect_uri` de Cognito, y redirige al diálogo de autorización de GitHub. |
| `GET /callback` | GitHub devuelve aquí tras el login. Verifica el `state` del puente, canjea el code de GitHub por un access token (con el client secret), lee el perfil del usuario, emite un authorization code efímero propio y redirige a Cognito con ese code y el `state` original de Cognito. |
| `POST /token` | Cognito canjea aquí el code efímero del puente. Valida el grant (`authorization_code`) y el cliente, consume el code (un solo uso) para recuperar la identidad de GitHub, y firma con la clave privada un `id_token` RS256 que Cognito acepta. |

Toda respuesta de error se devuelve como JSON con un campo `error`, sin filtrar detalles internos. El CORS se aplica por allowlist explícita: solo los orígenes configurados reciben cabeceras CORS.

## Variables de entorno

Se declaran en `.env` (copiado de `.env.example`). Ningún valor tiene valores reales en el repositorio.

| Variable | Qué es y de dónde se obtiene |
|----------|------------------------------|
| `GITHUB_CLIENT_ID` | Client ID de la OAuth App de GitHub. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App. No es secreto, pero se configura aquí junto al resto. |
| `GITHUB_CLIENT_SECRET` | Client secret de la misma OAuth App. **Secreto**: se genera en la OAuth App de GitHub y vive solo en el servidor. |
| `OIDC_SIGNING_KEY` | Clave privada RS256 (PEM, PKCS8) con la que el puente firma los `id_token`. **Secreta.** Se pega en una sola línea usando `\n` como salto de línea literal. Ver "Generar la clave de firma". |
| `OIDC_KEY_ID` | Identificador de la clave de firma (`kid`). Cualquier cadena estable que elijas; se publica en el JWKS y va en la cabecera de cada token para que Cognito sepa qué clave usar. |
| `ALLOWED_ORIGINS` | Orígenes permitidos, separados por comas. Debe incluir el origen del redirect de Cognito. La coincidencia es **exacta**: un subdominio o un prefijo no cuela. Ejemplo: `https://focus-garden.auth.us-east-1.amazoncognito.com`. |
| `ISSUER` | URL pública base del puente, **sin barra final** (p. ej. `https://oidc-bridge.example.com`). Es el `iss` de los tokens y la base de la que se derivan las URLs del descubrimiento. Debe ser exactamente el issuer que registres en Cognito. |
| `PORT` | Puerto en el que escucha Express. Por defecto `8787` si se omite. No aplica cuando el puente corre como Lambda Web Function (Lambda maneja el puerto). |
| `CODE_STORE_TABLE_NAME` | Nombre de la tabla de DynamoDB donde vive el authorization code efímero del puente (ver abajo). Por defecto `focus-garden-oidc-bridge-codes` si se omite. |

## Generar la clave de firma RS256

El puente firma con una clave privada RSA y publica solo la pública en el JWKS. Genera el par con OpenSSL:

```bash
# Clave privada RSA en formato PKCS8 (lo que jose espera)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out oidc-private.pem
```

`OIDC_SIGNING_KEY` necesita el PEM en una sola línea, con `\n` literales en lugar de saltos reales. Para convertirlo:

```bash
# Imprime el PEM con los saltos de línea reemplazados por \n literales
awk 'NR>1{printf "\\n"} {printf "%s", $0}' oidc-private.pem
```

Copia esa salida como valor de `OIDC_SIGNING_KEY` en `.env`. El puente deriva la clave pública automáticamente para el JWKS; no hace falta configurarla aparte. Elige un `OIDC_KEY_ID` (por ejemplo `focus-garden-2026`) y mantenlo estable mientras uses la misma clave.

> No subas la clave privada ni el `.env` al repositorio. `.env` queda fuera del control de versiones.

## Tabla de DynamoDB para los authorization code

Entre `/callback` (donde el puente ya conoce la identidad de GitHub) y `/token` (donde Cognito canjea el code por el ID token firmado) hay que recordar a qué identidad corresponde cada code. Ese code **no vive en memoria del proceso**: cuando el puente corre como Lambda Web Function, cada entorno de ejecución tiene su propia memoria, y nada garantiza que `/callback` y el `/token` que le sigue segundos después caigan en la misma instancia. `lib/code-store.js` usa una tabla de DynamoDB compartida en su lugar.

Crearla una sola vez (el nombre debe coincidir con `CODE_STORE_TABLE_NAME`):

```bash
aws dynamodb create-table \
  --table-name focus-garden-oidc-bridge-codes \
  --attribute-definitions AttributeName=code,AttributeType=S \
  --key-schema AttributeName=code,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

aws dynamodb update-time-to-live \
  --table-name focus-garden-oidc-bridge-codes \
  --time-to-live-specification "Enabled=true,AttributeName=ttl"
```

`PAY_PER_REQUEST` (bajo demanda) evita pagar capacidad reservada sin usar: para el tráfico de un workshop el costo es, en la práctica, $0. El TTL en el atributo `ttl` limpia los code que nadie canjeó, pero no es instantáneo (hasta 48 h) — `consumeCode` igual valida la expiración a mano en cada canje, así que el TTL es solo limpieza de respaldo, nunca la garantía de seguridad.

El rol de ejecución de la Lambda necesita permiso para `dynamodb:PutItem` y `dynamodb:DeleteItem` sobre esta tabla (además del permiso básico de CloudWatch Logs). Ver `.kiro/skills/deploy-to-aws/SKILL.md` para el rol completo.

## Correr el puente en local

Requiere Node 20 o superior (usa `fetch` nativo e `import.meta.main`) y una tabla de DynamoDB
alcanzable (ver "Tabla de DynamoDB para los authorization code" abajo): el code efímero entre
`/callback` y `/token` ya no vive en memoria del proceso, así que hace falta algo con qué hablar
incluso en local. La opción más simple para desarrollar sin tocar una cuenta de AWS real es
[DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
(`docker run -p 8000:8000 amazon/dynamodb-local`) con `AWS_ENDPOINT_URL_DYNAMODB=http://localhost:8000`
en el `.env` (el SDK de AWS lo respeta automáticamente, sin cambiar código).

```bash
cd oidc-bridge
npm install            # instala express, jose y el SDK de DynamoDB
cp .env.example .env   # luego rellena cada valor en .env
npm start              # arranca en el puerto de PORT (8787 por defecto)
```

Para desarrollo con recarga automática al guardar:

```bash
npm run dev            # node --watch server.js
```

Para correr las pruebas (la propiedad 15 de la allowlist de orígenes, con el runner nativo de Node):

```bash
npm test               # node --test
```

Una vez arriba, el descubrimiento debería responder:

```bash
curl http://localhost:8787/.well-known/openid-configuration
```

## Registrar el puente como proveedor OIDC en Cognito

Pasos generales (configuración manual en la consola de AWS; este repositorio solo trae el código del puente):

1. Despliega el puente en una URL pública con HTTPS y fija `ISSUER` a esa URL exacta, sin barra final.
2. En el User Pool de Cognito, agrega un *identity provider* de tipo **OpenID Connect (OIDC)**.
3. Usa como *Issuer URL* el valor de `ISSUER`. Cognito leerá `/.well-known/openid-configuration` para descubrir `/authorize`, `/token` y el JWKS.
4. Configura el *client ID* y el *client secret* del proveedor OIDC según lo que espere tu endpoint `/token` (el puente valida el `client_id` como audiencia del token).
5. Mapea los atributos: `email`, `name` y `preferred_username` que el puente incluye en los claims del `id_token`.
6. Añade el origen del redirect de Cognito a `ALLOWED_ORIGINS` del puente.
7. En el App Client de Cognito, habilita este proveedor OIDC (el frontend lo invoca con `identity_provider=GitHubBridge`, ver `auth-config.js`).

Desde el frontend no cambia nada del flujo social: GitHub se comporta como un proveedor más. Si el puente no responde, `auth.js` avisa "GitHub no disponible" y los demás métodos de inicio de sesión siguen funcionando.
