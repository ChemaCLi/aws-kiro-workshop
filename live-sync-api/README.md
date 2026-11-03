# Sincronización en vivo (WebSocket)

Dos funciones Lambda detrás de una API Gateway **WebSocket**, que sincronizan el pomodoro en vivo entre los dispositivos de una persona que están conectados a la vez (modelo master/slave). Es el tercer backend del proyecto, aparte de [`oidc-bridge/`](../oidc-bridge/README.md) y [`sync-api/`](../sync-api/README.md).

## Por qué existe, y qué NO hace

`sync-api` (spec `cloud-sync`) ya guarda el progreso y lo trae de vuelta al iniciar sesión en otro dispositivo — pero con un retraso de segundos, y solo al conciliar (al iniciar sesión, o en cada cambio local). Eso no alcanza para ver el **mismo reloj correr en dos pantallas abiertas a la vez** sin recargar, que es justo lo que pedía el requerimiento original ("si empiezo el conteo en la computadora, al abrir el celular éste muestra la tarea activa y se pone en modo slave"). Eso es lo que hace este servicio, y **solo** esto: sincroniza el `timer` (tarea activa, estado, cuenta regresiva) en vivo. Las tareas, rondas y ajustes los sigue sincronizando `sync-api`, con su propia latencia — no hace falta duplicarlos aquí.

**No incluye todavía** una UI de "Mis sesiones" (listar/nombrar/cerrar sesiones remotas desde Ajustes): sigue "Próximamente" en el frontend. La señal para construirla ya existe en el modelo de conexiones de este servicio.

## Por qué Event Functions, no Lambda Web Functions

A diferencia de `oidc-bridge`/`sync-api` (servidores Express completos, desplegados como Lambda Web Functions con `aws lambda-web deploy`), esto son conexiones **bidireccionales persistentes** — el caso de uso que la skill `aws-serverless` del proyecto asigna a **API Gateway WebSocket API** con **Event Functions** clásicas (Lambda invocada por evento, sin servidor HTTP propio). Por eso el despliegue es distinto: zip + `aws lambda create-function`/`update-function-code`, no `aws lambda-web`.

## Las dos funciones

| Función | Cuándo corre | Qué hace |
|---------|--------------|----------|
| `authorizer.js` | Solo en la ruta `$connect`, una vez por conexión nueva | Lee el access token de Cognito de la query string (`?token=...` — un WebSocket del navegador no puede mandar cabeceras propias al conectar) y lo valida contra el JWKS del User Pool (`lib/cognito-jwt.js`, misma lógica que `sync-api`, duplicada). Si es válido, autoriza la conexión y expone el `sub` en el contexto; si no, la conexión se rechaza antes de llegar a `router.js`. |
| `router.js` | En cada evento de la conexión: `$connect`, `$disconnect`, `$default` y las rutas propias de abajo | Toda la lógica del modelo master/slave (ver abajo). Una sola función para todas las rutas, no una por ruta. |

## El modelo master/slave

- **Al conectar** (`$connect`), el dispositivo intenta reclamar el rol de **master** para su cuenta. Lo consigue si nadie más lo tiene ahora mismo, o si quien lo tenía ya no está conectado (se perdió su `$disconnect`). Si lo consigue, el servidor le confirma `{type: 'init', role: 'master'}`. Si no, queda como **slave** y recibe de inmediato el último timer conocido: `{type: 'init', role: 'slave', timer}`.
- **Solo el master manda cambios** (`state-update`, con el `timer` actual): el servidor valida que venga de la conexión master registrada —si no, lo ignora en silencio, para que un cliente confundido nunca corrompa el estado compartido— y lo retransmite a todas las demás conexiones de esa cuenta.
- **Al desconectarse** (`$disconnect`) el master, el servidor avisa `{type: 'master-disconnected'}` a quien quede conectado, para que pueda ofrecer "¿quieres reanudar?" y mandar `claim-master` si la persona acepta.
- **`ping`** es un no-op: recibir cualquier mensaje ya resetea el timeout de inactividad de API Gateway (10 min); no hace falta que el servidor responda nada.

## Contrato de mensajes

Cliente → servidor (cuerpo `{"action": "...", ...}`, por la ruta correspondiente):

| `action` | Quién lo manda | Payload |
|----------|----------------|---------|
| `state-update` | Solo el master | `{ timer }` |
| `claim-master` | Cualquiera que quiera tomar el rol | — |
| `ping` | Cualquiera, cada pocos minutos | — |

Servidor → cliente:

| `type` | Cuándo |
|--------|--------|
| `init` | Justo después de `$connect`: `{ role: 'master' }` o `{ role: 'slave', timer }` |
| `state-update` | El master mandó un cambio: `{ timer }` |
| `master-disconnected` | El master se desconectó | 
| `claim-master-result` | Respuesta a un `claim-master`: `{ success: boolean }` |

## Tablas de DynamoDB

- **`focus-garden-connections`** (PK `connectionId`, GSI `sub-index` por `sub`): una fila por conexión abierta ahora mismo, con `deviceId` y TTL a 2 horas (el máximo de duración de una conexión de API Gateway), para limpiar huérfanas si se pierde `$disconnect`.
- **`focus-garden-live-timer`** (PK `sub`): un ítem por persona con quién es su master ahora mismo (`masterConnectionId`) y el último `timer` que mandó. Sin TTL: se sobrescribe, no expira.

```bash
aws dynamodb create-table \
  --table-name focus-garden-connections \
  --attribute-definitions AttributeName=connectionId,AttributeType=S AttributeName=sub,AttributeType=S \
  --key-schema AttributeName=connectionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[{"IndexName":"sub-index","KeySchema":[{"AttributeName":"sub","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}]'

aws dynamodb update-time-to-live \
  --table-name focus-garden-connections \
  --time-to-live-specification "Enabled=true,AttributeName=ttl"

aws dynamodb create-table \
  --table-name focus-garden-live-timer \
  --attribute-definitions AttributeName=sub,AttributeType=S \
  --key-schema AttributeName=sub,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

## Variables de entorno

Ver `.env.example` — documenta qué pasarle a cada función Lambda (ninguna es secreta: el JWKS de Cognito es público por diseño, igual que en `sync-api`).

## Correr las pruebas

```bash
cd live-sync-api
npm install
npm test               # node --test: dobles de DynamoDB y de ApiGatewayManagementApi, sin red
```

No hay un servidor local que levantar (a diferencia de `oidc-bridge`/`sync-api`): son Event Functions, solo se ejecutan invocadas por API Gateway. Las pruebas llaman `handler(event)` directamente con eventos de WebSocket simulados.

## Aprovisionar y desplegar

Ver `.kiro/skills/deploy-to-aws/SKILL.md`, sección "Sincronización en vivo: live-sync-api" — incluye los comandos exactos para crear la API WebSocket, sus rutas, el authorizer, y desplegar ambas funciones.
