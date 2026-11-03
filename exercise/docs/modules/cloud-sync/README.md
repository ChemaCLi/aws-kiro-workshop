# Módulo cloud-sync

## Descripción

Módulo de **guardado y sincronización** del progreso entre dispositivos (spec `cloud-sync`, el tercero de la evolución hacia cuentas y sincronización; ver `docs/current-plan.md`). Se implementó directo a código, sin `requirements.md`/`design.md`/`tasks.md` (decisión explícita del usuario; ver [`docs/decisions/0003-cloud-sync-mvp.md`](../../decisions/0003-cloud-sync-mvp.md)). Solo corre con una Session de `accounts-auth` activa: sin cuenta, nada cambia.

**No es sincronización en vivo.** Sincroniza al iniciar sesión y en cada cambio local, con el último cambio ganando por marca de tiempo. Ver el reloj correr igual en dos pantallas abiertas a la vez, con un dispositivo master y otro slave, es el spec `multi-device-sessions`, todavía sin construir.

### Qué hace

- **Al iniciar sesión** (correo/contraseña o, en el futuro, un proveedor social), concilia una vez el estado local con el guardado en la nube: si la nube tiene algo más reciente (o si el dispositivo está vacío y la nube no), reemplaza tareas/rondas/timer/ajustes locales; si lo local es más reciente (o la nube no tiene nada), sube el estado local.
- **En cada cambio local** (completar una tarea, correr una ronda, cambiar un ajuste), sube el estado a la nube con un pequeño retraso (para no mandar una petición por cada tecla), más un envío inmediato al ocultar u cerrar la pestaña.
- **Último cambio gana**: la marca de tiempo (`updatedAt`) la pone el **servidor**, no el dispositivo (un reloj de dispositivo desajustado no debe decidir qué progreso se pierde). Si solo un lado tiene datos reales, gana el que tiene datos, nunca el vacío.
- **Sin sesión, no corre.** No hay ninguna llamada de red de sincronización sin una Session activa, y cerrar sesión deja de sincronizar sin tocar `localStorage` (mismo principio que ya garantiza `accounts-auth`).
- **El reloj del pomodoro ya "viaja bien"**: el timer se guarda con una marca absoluta de fin (`endsAt`), así que un dispositivo que recibe un timer `running` retoma la cuenta regresiva correctamente sin ningún trabajo extra.

### Archivos clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/core/cloud-sync.js` | Toda la lógica de sincronización: `decideSync` (pura: push/pull/noop), `reconcile` (concilia una vez al iniciar sesión), `startCloudSync`/`stopCloudSync` (debounce en cada cambio, flush al ocultar/cerrar la pestaña). |
| `src/core/store.js` | `replaceState(next)` (nuevo): aplica un estado recibido de la nube normalizándolo igual que `load()`, y pasa por `#commit()` para persistir y notificar `'change'`. `updatedAt` (nuevo campo del estado persistido) lo pone `#commit()` en cada mutación. |
| `src/core/auth.js` | La Session ahora incluye `sub` (el id estable de Cognito; antes se decodificaba pero no se guardaba), que es la clave con la que se indexa el progreso en la nube. `signInWithPassword` ahora también emite `app:auth`, igual que ya hacía el flujo OAuth, para que `cloud-sync.js` se entere de cualquier inicio de sesión. |
| `src/core/auth-config.js` | Nuevo valor público `syncApiEndpoint` (`PUBLIC_SYNC_API_ENDPOINT`), igual patrón que `oidcBridgeEndpoint`. |
| `src/views/app-shell.js` | Arranca/para `cloud-sync` en cada cambio de sesión (`app:auth`) y al cargar la app con una sesión ya guardada (`refreshIfNeeded`). |
| `sync-api/` | Backend aparte en Node/Express (mismo patrón que `oidc-bridge/`), con su **propio README**: contrato `GET`/`PUT /state`, cómo valida el access token de Cognito, variables de entorno y cómo correrlo localmente. |

## Pruebas para qa-tester

Las pruebas de propiedad (`decideSync` y `Store.replaceState`) cubren la lógica sin red ni backend: `exercise/test/core/cloud-sync.test.js` y la sección "cloud-sync" de `exercise/test/core/store.test.js`. Las de `sync-api/test/server.test.js` cubren el contrato del backend con dobles de Cognito y DynamoDB (sin red real).

#### Caso 1 — Mismo progreso en otro navegador (requiere backend desplegado)

1. Con `sync-api` desplegado y `PUBLIC_SYNC_API_ENDPOINT` configurado, iniciar sesión con una cuenta, crear una tarea y completarla con al menos una ronda.
2. Abrir la app en otro navegador (o uno en incógnito) e iniciar sesión con la misma cuenta.

**Esperado:** la tarea y la ronda aparecen igual en el segundo navegador, sin recargar dos veces ni perder nada.

#### Caso 2 — Último cambio gana (requiere backend desplegado)

1. Con sesión iniciada en dos navegadores con el mismo progreso, crear una tarea distinta en cada uno, sin recargar el otro.
2. Cerrar sesión y volver a iniciarla en el navegador que quedó más atrás (o recargar la página).

**Esperado:** el navegador que recién concilia termina viendo el progreso más reciente (incluida la tarea que creó el otro), no el suyo propio si era más viejo.

#### Caso 3 — Sin sesión, no hay sincronización

1. Sin iniciar sesión, abrir DevTools → Network, crear tareas y correr una ronda.

**Esperado:** ninguna petición sale hacia `PUBLIC_SYNC_API_ENDPOINT`; todo sigue funcionando solo con `localStorage`, igual que antes de este módulo.

#### Caso 4 — Cerrar sesión no toca los datos locales

1. Con sesión iniciada y progreso sincronizado, cerrar sesión.
2. Revisar `localStorage['jardin-movil:v1']`.

**Esperado:** las tareas y rondas siguen intactas; cerrar sesión solo detiene la sincronización, no borra ni modifica nada local.

## Changelog

### 1.0.0 — 2026-11-03

Primera versión: `sync-api/` desplegable como Lambda Web Function, `decideSync`/`replaceState` en el frontend, arranque/parada automática desde `app-shell.js`. Sin sincronización en vivo (spec `multi-device-sessions` pendiente).
