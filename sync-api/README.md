# Sincronización en la nube

Servicio Node + Express que guarda el progreso de Focus Garden (tareas, rondas, timer y ajustes) por persona, para que aparezca igual en cualquier dispositivo donde inicie sesión. Es el segundo backend del proyecto, aparte de [`oidc-bridge/`](../oidc-bridge/README.md); el resto de la app sigue siendo estática.

## Por qué existe

El spec `accounts-auth` construyó solo la autenticación: crear cuenta o iniciar sesión **no toca** `localStorage`. Por diseño, los datos siguen siendo locales a cada dispositivo. `sync-api` es el spec `cloud-sync`: guarda una copia del mismo estado que ya vive en `localStorage['jardin-movil:v1']`, indexada por el `sub` (el id estable de Cognito) de cada persona, y la entrega de vuelta a cualquier dispositivo donde esa persona inicie sesión. Ver la decisión completa en [`exercise/docs/decisions/0003-cloud-sync-mvp.md`](../exercise/docs/decisions/0003-cloud-sync-mvp.md).

**No es sincronización en vivo.** Mientras dos dispositivos están abiertos a la vez con el mismo progreso cambiando en ambos (sesión master/slave, "Mis sesiones"), eso es el spec `multi-device-sessions`, todavía no construido. `sync-api` sincroniza al iniciar sesión y en cada cambio local, con el último cambio ganando por marca de tiempo — suficiente para "mismo progreso en otro navegador", no para ver el reloj correr en tiempo real en dos pantallas a la vez.

## Cómo se autentica

Cada petición trae `Authorization: Bearer <accessToken>`, el mismo access token que ya tiene la Session del frontend (`exercise/src/core/auth.js`). `lib/cognito-jwt.js` lo valida contra el JWKS público del User Pool de Cognito (`jose`, igual que `oidc-bridge`): firma, `iss` (el User Pool configurado), que no haya caducado, `token_use === 'access'` y que el `client_id` sea el App Client configurado. El `sub` validado es la clave con la que se guarda y se lee el progreso — **nunca** el correo, que puede repetirse entre proveedores.

No hay secretos que guardar: el JWKS de un User Pool de Cognito es público por diseño (así es como cualquier verificador de tokens funciona en OIDC), así que todas las variables de entorno de este servicio son configuración, no secretos.

## Contrato de endpoints

| Método y ruta | Responsabilidad |
|---------------|-----------------|
| `GET /state` | Devuelve el último estado guardado de la persona autenticada: `{ tasks, rounds, timer, settings, updatedAt }`. `204` sin cuerpo si todavía no ha guardado nada. `401` sin un access token válido. |
| `PUT /state` | Reemplaza el estado guardado con el que manda el cliente (`tasks`, `rounds`, `timer`, `settings`; el mismo shape que persiste `exercise/src/core/store.js`). `updatedAt` lo pone el servidor con su propio reloj (lo que venga en el cuerpo se ignora, para no confiar en el reloj del dispositivo) y se devuelve en la respuesta. `413` si la forma no es válida o algún arreglo excede el límite defensivo. `401` sin un access token válido. |

No hay autorización más allá de la identidad: cualquier persona autenticada puede leer y escribir **su propio** `sub`, nunca el de otra (la ruta nunca acepta un `sub` del cliente; siempre usa el que vino, verificado, en el token).

## Variables de entorno

Se declaran en `.env` (copiado de `.env.example`). Ningún valor tiene datos reales en el repositorio, y ninguno es secreto.

| Variable | Qué es y de dónde se obtiene |
|----------|------------------------------|
| `COGNITO_USER_POOL_ID` | El mismo User Pool que usa el frontend (`PUBLIC_COGNITO_USER_POOL_ID` en `exercise/.env`). Define de qué JWKS se validan los tokens. |
| `COGNITO_REGION` | Región del User Pool (por ejemplo `us-east-1`). |
| `COGNITO_CLIENT_ID` | El mismo App Client que usa el frontend (`PUBLIC_COGNITO_CLIENT_ID`). Un access token de otro App Client se rechaza. |
| `ALLOWED_ORIGINS` | Orígenes permitidos separados por comas. Debe incluir el dominio real del sitio publicado y, en desarrollo, `http://localhost:4321`. La coincidencia es **exacta**: un subdominio o un prefijo no cuela. |
| `PORT` | Puerto en el que escucha Express. Por defecto `8787` si se omite. No aplica cuando corre como Lambda Web Function. |
| `SYNC_TABLE_NAME` | Nombre de la tabla de DynamoDB donde vive el progreso. Por defecto `focus-garden-cloud-sync` si se omite. |

## Tabla de DynamoDB

Un ítem por persona, clave de partición `sub` (string). Sin TTL: a diferencia del code-store efímero de `oidc-bridge`, esto es dato durable que debe persistir indefinidamente.

```bash
aws dynamodb create-table \
  --table-name focus-garden-cloud-sync \
  --attribute-definitions AttributeName=sub,AttributeType=S \
  --key-schema AttributeName=sub,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

`PAY_PER_REQUEST` (bajo demanda) evita pagar capacidad reservada sin usar: para el tráfico de un workshop el costo es, en la práctica, $0.

El rol de ejecución de la Lambda necesita permiso para `dynamodb:GetItem` y `dynamodb:PutItem` sobre esta tabla (además del permiso básico de CloudWatch Logs). Ver `.kiro/skills/deploy-to-aws/SKILL.md` para el rol completo.

## Correr el servicio en local

Requiere Node 20 o superior (usa `fetch`/`import.meta.main` nativos) y, para `GET`/`PUT /state` de verdad, una tabla de DynamoDB alcanzable — la opción más simple para desarrollar sin tocar una cuenta de AWS real es [DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html) (`docker run -p 8000:8000 amazon/dynamodb-local`) con `AWS_ENDPOINT_URL_DYNAMODB=http://localhost:8000` en el `.env` (el SDK de AWS lo respeta automáticamente, sin cambiar código).

```bash
cd sync-api
npm install            # instala express, jose y el SDK de DynamoDB
cp .env.example .env   # luego rellena cada valor en .env
npm start              # arranca en el puerto de PORT (8787 por defecto)
```

Para desarrollo con recarga automática al guardar:

```bash
npm run dev            # node --watch server.js
```

Para correr las pruebas (con dobles de Cognito y DynamoDB, sin red ni cuenta de AWS real):

```bash
npm test               # node --test
```

Una vez arriba, sin un token real a mano, lo único que se puede probar sin Cognito es que el servicio rechaza una petición sin autenticar:

```bash
curl -i http://localhost:8787/state
# HTTP/1.1 401 Unauthorized
```
