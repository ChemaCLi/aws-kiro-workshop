# 0003. Cloud-sync: guardar y sincronizar progreso entre dispositivos

| Campo | Valor |
|-------|-------|
| Estado | Aceptada |
| Fecha | 2026-11-03 |
| Decide | La persona dueña del proyecto |

## Contexto

Tras desplegar `accounts-auth` con correo y contraseña ([decisión 0002](0002-pausar-proveedores-sociales.md)), el usuario probó iniciar sesión en otro navegador y no vio sus tareas ni el reloj del pomodoro. No era un bug: `accounts-auth` solo construye autenticación, y sus propios requisitos dicen explícitamente que crear cuenta o iniciar sesión **no toca** `localStorage`. El guardado y la sincronización son el spec 3, `cloud-sync` (ver `current-plan.md`), que hasta ahora no existía ni como spec ni como código.

El usuario también mencionó la sesión master/slave (spec 4, `multi-device-sessions`): sincronización **en vivo** cuando dos dispositivos están abiertos a la vez, con WebSocket, elección de master/slave y la sección "Mis sesiones". Esa pieza queda **fuera de este cambio**, a propósito: es bastante más grande (API Gateway WebSocket, tabla de conexiones, protocolo de arbitraje) y es justo lo que `current-plan.md` ya marcaba como el paso siguiente al 3, no el mismo.

## Decisión

Se construye `cloud-sync` (spec 3) directo a implementación, sin pasar por `requirements.md`/`design.md`/`tasks.md` como con `accounts-auth` (decisión explícita del usuario).

- **Qué se sincroniza**: exactamente lo que `exercise/src/core/store.js` persiste — `tasks`, `rounds`, `timer`, `settings`. Todo lo demás (jardín, estadísticas, plantas) se deriva en `core/rules.js` a partir de esos cuatro campos; no hace falta sincronizar nada más.
- **Base de datos: DynamoDB** (ya es el patrón del proyecto para `oidc-bridge`). Un ítem por persona, clave de partición `sub` (el id estable de Cognito, nunca el correo). Tabla `focus-garden-cloud-sync`, `PAY_PER_REQUEST`, sin TTL (dato durable, no efímero como el code-store del puente).
- **Nuevo servicio `sync-api/`**, Lambda Web Function con el mismo patrón que `oidc-bridge/` (Express puro, `index.js`/`server.js`, `routes/`, `lib/`, pruebas con `node --test`). Autentica cada petición validando el access token de Cognito contra el JWKS del User Pool (`jose`), nunca contra un secreto propio: no hay nada que guardar como secreto en este servicio. Contrato: `GET /state` y `PUT /state`.
- **Resolución de conflictos: último cambio gana**, por `updatedAt` (epoch ms). Es la opción simple que `current-plan.md` ya sugería como default; queda documentada como decisión tomada, no como pregunta abierta. El servidor pone su propio `updatedAt` en cada `PUT` (no confía en el reloj del dispositivo que escribe).
- **Cuándo sincroniza**: al establecer una Session (una conciliación: compara local vs. nube y aplica el que gane) y, de ahí en adelante, con un debounce corto en cada cambio local, más un flush inmediato al ocultar u cerrar la pestaña. No es sincronización en vivo entre pestañas abiertas a la vez — eso es `multi-device-sessions`.

## Consecuencias

- `exercise/src/core/auth.js`: la Session ahora incluye `sub` (antes no se guardaba, aunque ya se decodificaba). Necesario para indexar el progreso en la nube por persona.
- `exercise/src/core/store.js`: nuevo método `replaceState(next)` y un nuevo campo `updatedAt` en el estado persistido (lo pone `#commit()` en cada mutación). No hay migración de esquema: el shape guardado localmente no cambia, solo gana un campo más.
- Quien use la app **sin cuenta** no ve ningún cambio: `cloud-sync` nunca corre sin una Session activa, y cerrar sesión deja de sincronizar sin tocar `localStorage` (igual que ya garantizaba `accounts-auth`).
- `current-plan.md` marca el spec 3 como implementado y resuelve sus preguntas abiertas de base de datos y conflictos; la de WebSocket vs. polling queda abierta para el spec 4.

## Qué queda fuera (spec 4, `multi-device-sessions`)

- Sincronización en vivo con dos dispositivos abiertos a la vez (ver el reloj correr igual en ambos sin recargar).
- Elección de dispositivo master/slave, `session_id` por dispositivo, y la sección "Mis sesiones" en Ajustes (sigue "Próximamente").
- El canal en tiempo real (WebSocket vs. polling) sigue siendo una pregunta abierta para ese spec.
