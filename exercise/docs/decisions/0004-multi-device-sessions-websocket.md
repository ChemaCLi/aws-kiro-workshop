# 0004. Multi-device-sessions: timer en vivo por WebSocket, master/slave

| Campo | Valor |
|-------|-------|
| Estado | Aceptada |
| Fecha | 2026-11-03 |
| Decide | La persona dueña del proyecto |

## Contexto

Con `cloud-sync` (spec 3, decisión 0003) ya desplegado, el usuario confirmó que el guardado funciona entre dispositivos, pero preguntó específicamente por la sincronización **en vivo** que ya estaba descrita en el requerimiento original (`current-plan.md`, "Sesiones activas y multidispositivo"): dos dispositivos abiertos a la vez deben ver el mismo reloj de pomodoro corriendo, con un dispositivo master y los demás slave. Esto quedó explícitamente fuera de `cloud-sync` (ver "Qué queda fuera" en la decisión 0003) precisamente para no mezclarlo con el guardado asíncrono. El usuario confirmó el canal: **WebSocket**, resolviendo la última pregunta abierta de `current-plan.md`.

## Decisión

Se construye `multi-device-sessions` (spec 4) directo a implementación, igual que `cloud-sync`. Alcance de esta entrega: **solo** la sincronización en vivo del pomodoro entre dispositivos conectados a la vez, con master/slave y el aviso de reanudar cuando el master se desconecta. La UI de "Mis sesiones" (listar/nombrar/cerrar sesiones remotas) queda fuera, a propósito — sigue "Próximamente".

- **Nuevo servicio `live-sync-api/`**: dos funciones Lambda **Event Functions** (no Lambda Web Functions como `oidc-bridge`/`sync-api`) detrás de una **API Gateway WebSocket API** — primera vez que el proyecto usa este form factor, confirmado con la skill `aws-serverless` del repositorio ("conexiones bidireccionales persistentes → API Gateway WebSocket API con Event Functions").
- **Autenticación**: un Lambda authorizer en la ruta `$connect`, porque el navegador no puede mandar cabeceras propias al abrir un WebSocket (el access token viaja en la query string). Reutiliza la misma lógica de validación que `sync-api/lib/cognito-jwt.js`, duplicada (mismo patrón que `lib/origins.js` entre `oidc-bridge`/`sync-api`).
- **Modelo master/slave**: el primero en conectar para una cuenta es master; los demás son slave. Solo el master puede mandar cambios del timer; el servidor los ignora en silencio si no vienen de la conexión master registrada (nunca corrompe el estado compartido). Si el master se desconecta, el servidor avisa a quien quede para que pueda ofrecer "¿quieres reanudar?" y reclamar el rol.
- **Qué viaja por el WebSocket**: solo el `timer` (tarea activa, estado, cuenta regresiva). Las tareas, rondas y ajustes los sigue sincronizando `cloud-sync` — no hace falta duplicarlos aquí, y mezclar ambos canales habría complicado el diseño sin necesidad.
- **Despliegue**: con AWS CLI directo (no CloudFormation), igual que el resto del proyecto. Primera vez que se despliega una Lambda zip "clásica" en vez de con `aws lambda-web`.

## Consecuencias

- `exercise/src/core/store.js`: nuevo método `applyRemoteTimer(timer)`, que reemplaza solo el `timer` (a diferencia de `replaceState`, que reemplaza todo el estado) — así un timer recibido en vivo nunca pisa tareas/rondas/ajustes locales.
- Nuevo concepto en el proyecto: un `deviceId` estable por dispositivo (`core/device-id.js`), que no existía antes (ni siquiera para `accounts-auth`/`cloud-sync`, que identifican por `sub`, no por dispositivo).
- Quien use la app sin cuenta, o con un solo dispositivo a la vez, no ve ningún cambio: `live-sync.js` nunca corre sin una Session activa, igual que `cloud-sync.js`.
- `current-plan.md` marca el spec 4 como implementado (en su alcance acotado) y resuelve la última pregunta abierta (WebSocket, no polling).

## Qué queda fuera, a propósito

- UI de "Mis sesiones" en Ajustes: listar, nombrar o cerrar sesiones remotas. El modelo de conexiones (`focus-garden-connections`) ya tiene lo necesario para construirla como un paso pequeño después.
- Sincronización en vivo de tareas/ajustes: se queda en `cloud-sync`, con su latencia de segundos (no es algo que la persona esté mirando en tiempo real como el reloj).
