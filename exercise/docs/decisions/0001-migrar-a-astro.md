# 0001. Migrar Focus Garden a Astro

| Campo | Valor |
|-------|-------|
| Estado | Aceptada (migración pendiente) |
| Fecha | 2026-11-01 |
| Decide | La persona dueña del proyecto |
| Quién migra | La misma persona, en otro IDE (no en Kiro) |

Este documento es el punto de partida de la migración. No depende del historial de ningún chat.

## Contexto

### Stack hasta ahora

- HTML + JavaScript con ES modules, sin bundler ni paso de build.
- Web Components nativos en light DOM (`customElements.define`).
- Tailwind, Tone.js y Three.js por CDN (Three.js con import map).
- Dos páginas: `index.html` (landing) y `app.html` (SPA con pestañas por hash).
- Persistencia en `localStorage`, clave `jardin-movil:v1`.

### Estado del proyecto

- **Spec 1, `landing-and-settings`:** completado.
- **Spec 2, `accounts-auth`:** implementado y subido a la rama `spec/accounts-auth` (commit `b4ee784`).
  - Autenticación opcional con Amazon Cognito: usuario y contraseña, Google, Meta, Login with Amazon y GitHub (este último vía el puente OIDC).
  - `src/core/auth.js` implementa OAuth 2.0 *authorization code + PKCE* sin SDK, con `fetch` y WebCrypto.
  - Vista `account-view`, `Account_Slot` en Ajustes y el backend `oidc-bridge/` (Node + Express).
  - QA en [`docs/qa-reports/2026-11-01-accounts-auth.md`](../qa-reports/2026-11-01-accounts-auth.md).

### Qué desencadenó la decisión

Se quería inyectar la configuración de auth desde variables de entorno para que no quedara en git. Dos hechos aparecieron:

- `process.env` no existe en el navegador, y un proyecto sin build no tiene dónde inyectar variables.
- Se evaluaron estas opciones, sin elegir ninguna:
  - **A.** Archivo `auth-config.local.js` ignorado por git.
  - **B.** `window.__AUTH_CONFIG__` inyectado.
  - **C.** `config.json` leído en runtime.
  - Un script generador sin dependencias.
  - Vite con `import.meta.env`.

Quedaron dos puntos aclarados:

- Inyectar con un build es inyección en *build-time*, no en runtime.
- Los valores de `auth-config.js` son **públicos por diseño**: User Pool ID, App Client ID público (sin secreto), dominio de Cognito, redirect URIs y endpoint del puente. No hay secretos ahí. Los secretos reales (client secret de GitHub y llave de firma RS256) viven solo en el puente.

Astro resuelve la inyección con variables `PUBLIC_*` / `import.meta.env`.

### Motivo de fondo

La complejidad de mantener todo con Web Components puros se está volviendo excesiva. La inyección de configuración fue el detonante, no la causa.

## Decisión

Migrar Focus Garden a **Astro**. La migración queda pendiente y se hace fuera de Kiro.

## Consecuencias

- El frontend deja de ser "sin build". Habrá `package.json`, `node_modules/` y un paso de build.
- La política de dependencias deja de limitarse a CDN en el frontend (ver [Pendientes](#steerings-y-skills-que-quedan-desactualizados)).
- La configuración de auth puede leerse de variables de entorno en build-time. Cambiarla exige reconstruir el sitio.
- El sitio hoy es estático. Si se mantiene así, el despliegue sigue siendo publicar archivos, pero ahora desde la carpeta de salida del build.
- La skill `migrate-to-react-or-vue` **no cubre Astro** (confirmado al leerla): su descripción y sus pasos hablan solo de React, Vue y Vite. No sirve tal cual. Sí es útil como lista de riesgos (timer con `endsAt`, `dispose()` de la escena, respaldo cuando Tone.js o Three.js fallan, compatibilidad de `localStorage`).

## Qué se conserva

Lo siguiente es independiente del framework de UI.

| Pieza | Detalle |
|-------|---------|
| `oidc-bridge/` completo | Servicio Node aparte, su README y sus 14 pruebas con `node:test` (14/14 en el reporte de QA). Sigue con `express` y `jose`. |
| Lógica sin DOM de `src/core/` | `rules.js`, `store.js`, `auth.js`, `ticker.js` y `ticker.worker.js`, `feedback.js`, `lofi.js`. |
| `auth-config.js` como contrato | Misma forma y mismos campos públicos. Cambia de dónde salen los valores (ver abajo). |
| Reglas de producto | `docs/features.md`, los README de módulos en `docs/modules/` y `product.md`. |
| Propiedades de `accounts-auth` | Las 15 propiedades y sus enunciados (sección *Correctness Properties* de `.kiro/specs/accounts-auth/design.md`). Ver la nota de abajo. |
| Diseño de seguridad | PKCE, `state` aleatorio, tokens en la clave separada `focus-garden:auth:v1`, validación de firma y claims del ID token, secretos solo en el puente. |
| Datos locales | `localStorage` `jardin-movil:v1`, sin cambios de forma. Quien ya usa la app no pierde su progreso. |
| Sistema de diseño | Tokens de color, tipografía y movimiento de `design-system.md`. |

Nota sobre las propiedades: 13 tienen script en `docs/modules/accounts-auth/properties/` (propiedades 1 a 7 y 9 a 14). La propiedad 15 vive en `oidc-bridge/test/origins.test.js`. La propiedad 8 (la autenticación nunca altera los datos locales) no tiene script aislado: se verifica con los casos de `qa-tester`.

## Qué cambia o debe revisarse

No se decide aquí cómo. Es la lista de lo que la migración toca.

| Hoy | Al migrar |
|-----|-----------|
| Web Components: `<app-shell>`, `<tasks-view>`, `<focus-view>`, `<garden-view>`, `<stats-view>`, `<settings-view>`, `<account-view>`, `<hero-garden>` | Se reescriben como componentes y páginas de Astro. Los que necesiten interactividad serán islas. |
| Ruteo por hash: pestañas (`#tasks`, `#focus`, …) y `#/cuenta`, decididos por `routeFromHash` en `app-shell.js` | Se replantea con el enrutado de Astro. Considerar que `routeFromHash` tiene propiedad 1 y que el redirect de OAuth vuelve a `app.html` con `code` y `state` en `location.search`. |
| Dos páginas: `index.html` (landing) y `app.html` (SPA) | Se replantean con las páginas de Astro. `redirectUri` apunta hoy a `app.html`: debe seguir coincidiendo con lo declarado en el App Client de Cognito. |
| Tailwind por CDN, configurado en `src/ui/tailwind-config.js` | Pasa a integración. Los tokens de color no cambian. |
| Three.js y Tone.js por CDN o import map | Pasan a paquetes. Siguen necesitando degradación elegante si fallan. |
| `auth-config.js` con valores literales y `location.origin` | Debe leer de variables `PUBLIC_*`. `location.origin` no existe al construir o renderizar en servidor: calcular `redirectUri` en el cliente o desde una variable. |
| Propiedades como scripts pegables en la consola, porque no hay runner | Podrían correr con un runner (p. ej. `node:test` o Vitest). En la pasada de QA, los scripts de `auth.js` no corrieron en el Node de esa sesión: sus imports se colgaron (ver el reporte de QA). |
| Pomodoro con `endsAt - Date.now()` y Web Worker | No cambia la regla. El worker debe seguir funcionando con el bundler (ver skill `web-worker-timer`). |
| `store.js` con eventos `change` y `round`, y eventos en `document` (`app:navigate`, `app:toast`, `app:auth`) | Revisar cómo se comparte entre islas (pregunta abierta). |

## Steerings y skills que quedan desactualizados

Lista de pendientes para quien migre. **No se editaron al registrar esta decisión.** Hacerlo al migrar, no antes.

### Steerings (`.kiro/steering/`)

| Archivo | Qué dice hoy y quedaría falso |
|---------|-------------------------------|
| `tech.md` | Sin bundler ni build, Web Components nativos, Tailwind/Tone/Three por CDN, estructura de archivos. Ya prevé actualizarse si el usuario migra. |
| `dependencies-policy.md` | "Solo CDN, sin instalar nada" para el frontend. Ya prevé la "Excepción: migración de tecnología" y pide actualizar `tech.md`. |
| `architecture.md` | Capas `components → ui → core`, vistas que extienden `StoreView`, "Dónde poner cosas nuevas". |
| `code-standards.md` | Estructura de componente con `StoreView`, light DOM, HTML generado con template literals y `esc()`. |
| `design-system.md` | Solo si cambia cómo se usa Tailwind (CDN → integración). |
| `custom-agents.md` | Rutas y alcance de `coder` (`src/`, `index.html`) y la mención de `migrate-to-react-or-vue`. |

### Skills (`.kiro/skills/`)

| Skill | Por qué |
|-------|---------|
| `migrate-to-react-or-vue` | No cubre Astro. No sirve tal cual. |
| `deploy-to-aws` | Publica archivos estáticos sin build. Habría que publicar la carpeta de salida del build. |
| `responsive-mobile-first` | Técnicas pensadas para el shell con `position: fixed` y Web Components. |
| `update-3d-world` | Describe `garden-scene.js` y `garden-view.js` como Web Component. |
| `web-worker-timer` | Describe el worker sin bundler. |
| `add-lofi-melody` | Asume `melodies/` servido como estático y el import por CDN de Tone.js. |
| `unit-tests-web-components` | Skill nueva, aún sin commitear. Prueba Web Components con Jest y jsdom; deja de aplicar a lo que se reescriba como Astro. |

Revisar también el `README.md` de la raíz y el de `exercise/`, y `melodies/README.md`, si mencionan "sin build" o "Web Components".

## Decisiones abiertas

1. **Framework de islas dentro de Astro.** ¿Ninguno (solo `<script>` de Astro), React, Vue, Svelte o Solid?
2. **Modo de salida.** ¿Estático, o servidor/híbrido? El sitio hoy es estático.
3. **Estado compartido entre islas.** ¿Cómo se expone `store.js` a varias islas sin acoplarlas?
4. **Hosting.** ¿Dónde se aloja el sitio y dónde el puente OIDC?
5. **Alcance de la migración.** ¿De una vez o incremental (módulo por módulo)?

## Estado del trabajo al momento de decidir

### Pendiente en `accounts-auth`

La infraestructura real de AWS **no está creada**:

- User Pool de Cognito.
- App Client público (sin secreto).
- Dominio del Hosted UI.
- Secreto del puente en AWS Secrets Manager (idea inicial para guardar los secretos del puente).
- Hosting del puente.
- Apps OAuth en Google, Meta, Amazon y GitHub.

Región elegida: `us-east-1`.

`src/core/auth-config.js` sigue con **placeholders** (`us-east-1_XXXXXXXXX`, `xxxxxxxxxxxxxxxxxxxxxxxxxx`, `oidc-bridge.example.com`). No hay IDs de cuenta de AWS ni credenciales reales en el repositorio, que es open source. Los flujos que requieren Cognito real quedaron sin probar en navegador (ver el reporte de QA).

### Specs siguientes

- **3, `cloud-sync`** y **4, `multi-device-sessions`**: sin spec. Deben plantearse sobre el stack nuevo, no sobre Web Components. Ver [`docs/current-plan.md`](../current-plan.md).

### Rama

La rama `spec/accounts-auth` está subida con el commit `b4ee784` y aún no se integra a `main`.
