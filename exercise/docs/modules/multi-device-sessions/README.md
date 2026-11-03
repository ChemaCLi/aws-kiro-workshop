# Módulo multi-device-sessions

## Descripción

Módulo de **sincronización en vivo** del pomodoro entre dispositivos abiertos a la vez (spec `multi-device-sessions`, el cuarto de la evolución hacia cuentas y sincronización; ver `docs/current-plan.md`). Implementado directo a código, sin `requirements.md`/`design.md`/`tasks.md` (decisión del usuario; ver [`docs/decisions/0004-multi-device-sessions-websocket.md`](../../decisions/0004-multi-device-sessions-websocket.md)). Solo corre con una Session de `accounts-auth` activa y más de un dispositivo conectado a la vez.

**Acotado al timer.** A diferencia de `cloud-sync` (tareas/rondas/ajustes, con un pequeño retraso), esto sincroniza **solo** el `timer` del pomodoro, **en vivo**, por WebSocket. Las tareas ya llegan por `cloud-sync`; no hace falta duplicarlas aquí.

**Qué NO incluye todavía.** La UI de "Mis sesiones" en Ajustes (listar, nombrar o cerrar sesiones remotas) sigue "Próximamente" — el modelo de conexiones del backend ya tiene lo necesario para construirla como un paso pequeño después.

### Qué hace

- **Modelo master/slave**: el primer dispositivo que conecta para una cuenta es el **master**; los demás son **slave**. Solo el master manda cambios del timer (seleccionar tarea, iniciar, pausar, cancelar, terminar ronda); el backend los retransmite en vivo a los demás dispositivos de esa cuenta.
- **Nunca se corrompe el estado compartido**: el backend valida que cada `state-update` venga de la conexión master registrada; si no, lo ignora en silencio.
- **Reanudar si el master se va**: al desconectarse el master, el backend avisa a quien quede conectado. La app muestra un aviso ("Tenías una sesión activa, ¿la quieres reanudar?") con una acción que reclama el rol de master para ese dispositivo.
- **La conexión se cuida sola**: un ping periódico evita que se cierre por inactividad; si igual se cierra (inactividad, caída de red, o el máximo de 2 horas de una conexión de API Gateway), se reconecta sola con un backoff creciente.
- **Sin sesión, no corre.** Igual que `cloud-sync`: no hay ninguna conexión de red sin una Session activa, y cerrar sesión la detiene sin tocar `localStorage`.

### Archivos clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/core/live-sync.js` | Cliente WebSocket: conecta, reconecta con backoff, manda el timer solo si este dispositivo es master y cambió, aplica los timers que lleguen como slave, muestra el aviso de reanudar. `startLiveSync`/`stopLiveSync`. |
| `src/core/device-id.js` | `getDeviceId()`: id estable de este dispositivo/navegador, generado una vez y guardado en `localStorage` aparte de `jardin-movil:v1` y `focus-garden:auth:v1`. |
| `src/core/store.js` | `applyRemoteTimer(timer)` (nuevo): reemplaza solo `timer`, deja `tasks`/`rounds`/`settings` intactos — a diferencia de `replaceState` (de `cloud-sync`), que reemplaza todo. |
| `src/core/auth-config.js` | Nuevo valor público `liveSyncEndpoint` (`PUBLIC_LIVE_SYNC_ENDPOINT`, `wss://...`). |
| `src/views/app-shell.js` | Arranca/para `live-sync.js` en cada cambio de sesión, igual que `cloud-sync.js`. |
| `live-sync-api/` | Backend aparte: dos funciones Lambda **Event Functions** (no Lambda Web Functions, primera vez en el proyecto) detrás de una API Gateway **WebSocket**. Tiene su **propio README** con el contrato de mensajes, el modelo de datos y cómo desplegarlo. |

## Pruebas para qa-tester

Las pruebas de propiedad (`applyRemoteTimer`) viven en `exercise/test/core/store.test.js`. Las del backend (`live-sync-api/test/`) cubren el modelo master/slave completo con dobles de DynamoDB y de la API de administración de conexiones, sin red real.

#### Caso 1 — Ver el mismo reloj en dos dispositivos (requiere backend desplegado)

1. Iniciar sesión con la misma cuenta en dos navegadores (o uno en incógnito).
2. En el primero, seleccionar una tarea y tocar ▶ para iniciar una ronda.

**Esperado:** el segundo navegador muestra la misma tarea activa y el mismo reloj corriendo, sin recargar ni tocar nada ahí.

#### Caso 2 — Solo un dispositivo manda el tiempo (requiere backend desplegado)

1. Con el escenario del caso 1, en el segundo navegador (slave) abrir DevTools y tratar de alterar el timer local (por ejemplo, llamando a `__store.start()` en la consola para otra tarea).

**Esperado:** el cambio se revierte o queda sobrescrito por el próximo `state-update` real del master; el segundo navegador nunca se convierte en la fuente de verdad mientras el master siga conectado.

#### Caso 3 — Reanudar si el master se desconecta (requiere backend desplegado)

1. Con el escenario del caso 1 y una ronda corriendo, cerrar la pestaña del navegador master.
2. En el navegador que queda, esperar el aviso.

**Esperado:** aparece el toast "Tenías una sesión activa, ¿la quieres reanudar?"; al tocar "Reanudar", ese dispositivo pasa a ser el master (un cambio posterior del timer ahí se transmite normalmente si se abre un tercer dispositivo).

#### Caso 4 — Sin sesión o con un solo dispositivo, no cambia nada

1. Sin iniciar sesión, usar la app normalmente (crear tareas, correr una ronda).
2. Con sesión iniciada en un solo dispositivo, repetir.

**Esperado:** en ambos casos la app funciona exactamente igual que antes de este módulo; sin sesión no hay ninguna conexión WebSocket.

## Changelog

### 1.0.0 — 2026-11-03

Primera versión: `live-sync-api/` desplegable (API Gateway WebSocket + dos Lambda Event Functions), `live-sync.js`/`device-id.js`/`Store.applyRemoteTimer` en el frontend, arranque/parada automática desde `app-shell.js`. Acotado al timer del pomodoro; sin UI de "Mis sesiones" todavía.
