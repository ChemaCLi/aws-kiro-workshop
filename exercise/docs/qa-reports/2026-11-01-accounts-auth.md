# QA accounts-auth (+ regresión settings Caso 11) · 2026-11-01

**Método usado:** sin MCP `chrome-devtools` en esta sesión y sin infraestructura AWS
(Cognito real) ni el puente OIDC desplegado con sus variables de entorno. La verificación
fue por **análisis estático de código y documentación** más **ejecución real de las pruebas
del puente OIDC** (`node --test`, que sí corre porque `oidc-bridge/` es un proyecto Node
aparte con sus dependencias instaladas). Los **scripts de propiedad del frontend**
(`auth.js`, `app-shell.js`) **no se pudieron ejecutar en Node en esta sandbox**: importar esos
módulos ES cuelga la resolución (la misma peculiaridad que documentan los propios `.md` de
propiedad); se validaron por lectura contra el código. No se levantó navegador.

## Resumen

**No aprobado todavía.** Ninguna prueba quedó ❌. El contrato del puente OIDC se ejecutó y
**pasa (14/14)**. Las 13 propiedades del frontend, la integración con mocks y los casos de UI
quedan ⚠️ (no verificables por ejecución en esta sesión: unos requieren navegador, otros
requieren backend, y los scripts de `auth.js` no corren en este Node). Se revisaron todos por
lectura y son coherentes con el código, salvo dos discrepancias de documentación menores
(ver "Discrepancias"). No se marca "Aprobado" por falta de evidencia observada del frontend.

- Puente OIDC (`oidc-bridge/test/`, `node --test`): **14 de 14 ✅** (ejecutado).
- Propiedades frontend 1–14 (consola/Node): **⚠️** bien formadas, etiquetadas y coherentes
  con el código; sin ejecutar aquí (cuelgue de import en Node; requieren DevTools).
- Integración Cognito con mocks: **⚠️** script completo y coherente; sin ejecutar.
- Casos UI 1–12 del README accounts-auth: la mayoría **requieren backend** → pendientes;
  los verificables sin backend (ruteo, diseño, degradación, no interferencia) revisados por
  código **sin discrepancias de comportamiento**.
- Settings Caso 11 (Account_Slot / "Mis sesiones"): invariantes confirmados por código ✅
  (lógica); render e interacción ⚠️ (requieren navegador).

## Invariantes clave verificados por código (sin backend)

| Invariante | Resultado | Evidencia (lectura de código) |
|-----------|-----------|-------------------------------|
| `auth-config.js` no contiene secretos | ✅ | Solo `userPoolId`, `clientId` (público, comentado "sin secreto"), `region`, `cognitoDomain`, `redirectUri`, `scopes`, `providers`, `oidcBridgeEndpoint`. Grep en `src/**/*.js` y `*.html` de `client_secret|secret|PRIVATE KEY|OIDC_SIGNING_KEY`: única coincidencia es un comentario en `auth.js` que dice que NUNCA se envía `client_secret`. |
| `routeFromHash('#/cuenta')` → `{kind:'route',id:'account'}`; otros → tab; basura → `tasks` | ✅ | `app-shell.js` `routeFromHash`: normaliza `replace(/^#\/?/,'').trim()`, `=== 'cuenta'` → route/account; id en `TABS` → tab/id; resto → tab/tasks. Función pura, recibe el hash por argumento. |
| `signOut()` borra solo `focus-garden:auth:v1` y no toca `jardin-movil:v1` | ✅ | `auth.js` `signOut()`: `localStorage.removeItem(SESSION_KEY)` con `SESSION_KEY='focus-garden:auth:v1'`; limpia memoria y emite `app:auth`. No referencia `jardin-movil:v1`. La sesión vive en clave dedicada (comentario explícito, Propiedad 8). |
| Degradación: `isAuthAvailable()` y estado `disabled` | ✅ | `isAuthAvailable()` = `navigator.onLine !== false` && `crypto.subtle` presente. `accountSlotModel(session,false)` → `{enabled:false,mode:'disabled',canSignOut:false}`. `account-view` pinta `#disabledBody()` cuando `!#available`; `onAvailabilityChange` re-pinta sin recargar con `online/offline`. |
| `account-view`: inputs 16px, objetivos 44px, aria-labels, labels | ✅ | `#field()` usa `text-[16px]` y `min-h-11` (44px) con `<label for>`; `#primaryButton`/`#providersBlock`/botones de texto usan `min-h-11`; botones de proveedor con `aria-label="Continuar con ..."`; interruptores de settings con `role="switch"` + `aria-label`. |
| Account_Slot (settings) refleja las 3 situaciones | ✅ | `settings-view.js` `accountSlot(model)` cubre `disabled`/`guest`/`signed-in` desde `accountSlotModel(getSession(), isAuthAvailable())`; `#goToAccount()` fija `location.hash='#/cuenta'`; `#signOut()` llama `signOut()` + toast "Sesión cerrada". |
| "Mis sesiones" sigue "Próximamente" | ✅ | `reservedSlot('Mis sesiones', ...)` con `aria-disabled="true"`, `text-ink/50`, etiqueta "Próximamente", sin `data-act`. |
| Create_Account_Button de la landing navega a `#/cuenta` | ✅ | `index.html`: `<a href="./app.html#/cuenta" data-act="account">Mantén vivo tu jardín...`; `landing.js` comenta que ahora es enlace directo y solo intercepta "Entrar". |

## Puente OIDC — pruebas ejecutadas (node --test)

Ejecutado en `oidc-bridge/` con `node --test`. **14/14 ✅**:

| Prueba | Resultado |
|--------|-----------|
| Property 15 — allowlist: acepta solo miembro exacto (200 iter) | ✅ |
| Property 15 — miembro exacto siempre acepta | ✅ |
| Property 15 — rechaza subdominios | ✅ |
| Property 15 — rechaza prefijo/sufijo/puerto/esquema/espacios | ✅ |
| Property 15 — string vacío nunca acepta | ✅ |
| Property 15 — allowlist no-arreglo se rechaza | ✅ |
| Property 15 — origen no-string se rechaza | ✅ |
| jwks publica RS256 público sin material privado (d,p,q,dp,dq,qi ausentes) | ✅ |
| authorize redirige a GitHub con client_id y state del puente (origen permitido) | ✅ |
| authorize 403 con origen fuera de allowlist (`origen_no_permitido`) | ✅ |
| callback canjea code de GitHub y redirige a Cognito con code efímero | ✅ |
| token canjea code del puente por id_token RS256 firmado y verificable | ✅ |
| token rechaza con `invalid_grant` un code ya usado (un solo uso) | ✅ |
| token rechaza `grant_type` no soportado (`unsupported_grant_type`) | ✅ |

Confirma: contrato OIDC (jwks/authorize/callback/token), canje con GitHub, secretos solo en
el servidor (clave de firma de prueba generada en el test con `jose`, nunca en el repo),
orígenes por allowlist exacta. Dependencias fijas en `package.json`: `express@5.3.0`,
`jose@6.2.14` (sin `latest`), con `node_modules` presente.

## Propiedades del frontend (revisadas por lectura; no ejecutadas aquí)

Las 13 propiedades (`propiedad-1,2,3,4,5,6,7,9,10,11,12,13,14`; no existe la 8, que es el
invariante de no-interferencia referido en comentarios) están **bien formadas**: título,
etiqueta `Feature: accounts-auth, Property N`, `Validates: Requirements`, script
autocontenido con el arnés `forAll`, stubs para Node y sección "Cómo ejecutarlo"/"Resultado
esperado". Cada script apunta a la función real exportada y pura correspondiente de
`auth.js`/`app-shell.js`, que fue leída y coincide con lo que la propiedad afirma. La
integración `integracion-cognito.md` (etiqueta `Feature: accounts-auth`) mockea `fetch`,
`location`, `localStorage`, `sessionStorage` y firma un ID token real con WebCrypto; su
enrutador de `fetch` casa con los endpoints y `X-Amz-Target` que arma `auth.js`.

Todas quedan ⚠️ porque no se ejecutaron: en esta sandbox, importar `src/core/auth.js` o
`src/components/app-shell.js` desde Node cuelga la resolución del módulo (reproducido: un
probe que solo hace `await import('./src/core/auth.js')` agota el tiempo). Es la limitación de
entorno que los propios `.md` anotan. Para evidencia observada: pegar cada script en la
consola de DevTools con la app servida en `localhost`, o `node --input-type=module` por stdin.

## Pendientes por requerir backend (no ejecutables aquí)

Casos UI del README marcados "(requiere backend)" — necesitan un User Pool de Cognito real y,
para GitHub, el puente desplegado con variables de entorno:

- Caso 2 (registro usuario/contraseña), Caso 3 (inicio usuario/contraseña), Caso 4
  (proveedores sociales), Caso 5 (GitHub vía puente), Caso 6 (Name_Prompt), partes "con
  sesión" de los Casos 7, 9, 12. Apoyo documentado: propiedades 2,3,4,5,7,9,10,11,13,14 y la
  integración con mocks.
- Casos sin backend que igual requieren **navegador** para evidencia observada: Caso 1
  (diseño/objetivos táctiles a 320/390/1280), Caso 7 sin sesión (navegación a `#/cuenta`),
  Caso 8 (opcionalidad), Caso 10 (degradación con red offline sin recargar). Lógica revisada
  por código sin discrepancias.

## Settings · Caso 11 (regresión Account_Slot)

- Sin sesión + auth disponible → `guest`: control que lleva a `#/cuenta`. ✅ (código)
- "Mis sesiones" "Próximamente", `aria-disabled`, atenuado, sin toque. ✅ (código)
- Con sesión → nombre/correo + "Cerrar sesión"; cerrar sesión no toca `jardin-movil:v1`. ✅
  (invariante de `signOut`; el estado "con sesión" visible requiere backend/navegador ⚠️).
- Sin red/WebCrypto → bloque `disabled` con aviso, resto de Ajustes intacto. ✅ (código)

## Discrepancias (para coder / documenter)

1. **`propiedad-4-canje-state.md` desactualizada.** El documento dice que la validación del
   `state` "vive dentro de `handleRedirect`, que se implementa en la tarea 2.3" y por eso
   **replica** la regla en un helper local `stateAccepts` en vez de probar la función real.
   Pero `handleRedirect` **ya está implementada** en `auth.js` (hace
   `sent.state === returnedState`). La lógica coincide, así que no es un bug de código, pero
   el texto de la propiedad quedó viejo: convendría actualizarla para ejercitar
   `handleRedirect` directamente (o al menos corregir la redacción). Hallazgo de documentación.

2. **Atribución imprecisa en el README de accounts-auth.** La tabla "Archivos clave" asigna a
   `src/components/landing-sheets.js` el cambio "El Create_Account_Button de la landing ahora
   navega a la página de cuenta en vez de abrir la hoja 'Próximamente'". En el código, esa
   navegación vive en `index.html` (`<a href="./app.html#/cuenta">`) y `src/landing.js`;
   `landing-sheets.js` solo contiene el recordatorio "Antes de empezar". El comportamiento es
   correcto; solo la atribución del archivo es imprecisa. Hallazgo de documentación.

## Pruebas faltantes en el README (propuestas)

- **Propiedad 15 (puente).** Está en `oidc-bridge/test/origins.test.js` con la etiqueta
  `Feature: accounts-auth, Property 15`, pero la tabla de propiedades del README de
  accounts-auth llega hasta la 14 y remite al puente en prosa. Proponer una fila que la
  nombre explícitamente para que el inventario de propiedades esté completo:
  `| 15 | El puente acepta solo orígenes de la allowlist | 11.5, 12.6 | oidc-bridge/test/origins.test.js |`.

## Notas de verificación

- No se modificó código de la app (rol qa-tester).
- Changelog de ambos módulos revisado: `accounts-auth` 1.0.0 (2026-11-01) y `settings` 2.1.0
  (2026-11-01, Account_Slot real) tienen entrada para este cambio. ✅
- Comando ejecutado: `node --test` en `oidc-bridge/` (14/14). Los imports de `auth.js` en Node
  se confirmó que cuelgan; no quedaron procesos ni archivos temporales.
