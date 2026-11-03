---
inclusion: always
---

# Stack técnico

> Migrado de Web Components sin build a Astro + Vite el 2026-11-02. Ver
> [`docs/decisions/0001-migrar-a-astro.md`](../../exercise/docs/decisions/0001-migrar-a-astro.md)
> para el porqué y qué se conservó.

- **Astro + Vite** en el **frontend**, con un paso de build (`npm run build` genera `dist/`). `npm run dev` levanta un servidor de desarrollo.
- **Dos páginas Astro**: `src/pages/index.astro` es la **landing** (página con scroll, sin SPA) y `src/pages/app.astro` es la **app**, una SPA con pestañas por hash. `astro.config.mjs` fija `build.format: 'file'` para que ambas compilen a `index.html` y `app.html` (no a `index/` y `app/`), porque el `redirectUri` de Cognito en `auth-config.js` apunta a `/app.html` y no debe cambiar al migrar. Entrar y salir siguen siendo navegaciones reales entre ambas.
- **Sin Web Components.** Las antiguas vistas (`<tasks-view>`, `<focus-view>`, etc.) son ahora módulos JS planos en `src/views/`, montados con el helper `mountView` de `src/ui/view.js` (reemplaza a la antigua clase `StoreView`). El marcado estructural (barra de pestañas, contenedores de cada vista, secciones puramente estáticas de la landing) vive en los `.astro`; cada módulo de `src/views/` solo gobierna su contenedor con el mismo ciclo `setup()`/`update(state)`/`teardown()` de siempre.
- **Tailwind v4** vía `@tailwindcss/vite`, con los tokens de color en `src/styles/tailwind.css` (antes `src/ui/tailwind-config.js` cargado por CDN).
- **Tone.js y Three.js como paquetes npm** (`tone`, `three`), importados normalmente y empaquetados por Vite — ya no por CDN ni import map. Siguen con degradación elegante si fallan en tiempo de ejecución (ver `dependencies-policy.md`).
- **Web Worker** para el pulso del pomodoro (`src/core/ticker.worker.js`), instanciado con `new Worker(new URL('./ticker.worker.js', import.meta.url))`, compatible con Vite sin cambios.
- **localStorage** para persistir: la clave `jardin-movil:v1` guarda tareas, rondas y ajustes; la clave `focus-garden:auth:v1` guarda la sesión de cuenta (separada, para que cerrar sesión o perder tokens nunca afecte los datos del jardín).
- **Vitest** para pruebas (`npm test`), con entorno `jsdom`. Las propiedades que antes eran scripts para pegar en la consola del navegador ahora son archivos `*.test.js` reales en `exercise/test/`.
- Idioma de la interfaz: **español únicamente** (`lang="es"`, fechas con `es-MX`).

## Autenticación opcional y backend

A partir del spec `accounts-auth`, la app ofrece cuentas con **Amazon Cognito** de forma **opcional**: quien no quiera cuenta sigue usando la app con sus datos locales igual que antes.

- **Sin SDK de cliente.** No se usa `amazon-cognito-identity-js` ni un SDK equivalente. `src/core/auth.js` implementa el flujo **OAuth 2.0 (authorization code + PKCE)** con `fetch` nativo y **WebCrypto** (`crypto.subtle`), y habla con la **API JSON de Cognito Identity Provider** (`SignUp`, `ConfirmSignUp`, `InitiateAuth`, etc.) y con el **Hosted UI** de Cognito para los redirects sociales.
- **Configuración pública sin secretos** en `src/core/auth-config.js`: `userPoolId`, `clientId` (App Client sin secreto), dominio de Cognito, `redirectUri`, scopes, proveedores y el endpoint del puente OIDC. Nunca contiene ningún secreto.
- **Un único backend: el puente OIDC de GitHub** (`oidc-bridge/`, **Node + Express puro**, con su propio `package.json` y `npm`). Permite iniciar sesión con GitHub, que Cognito no soporta de forma nativa. Es el único rincón del proyecto que **sí** usa dependencias instaladas (`express` y `jose`). Los demás proveedores (Google, Meta, Login with Amazon) se resuelven con el Hosted UI, sin backend.
- **Degradación elegante:** sin red, o en un contexto no seguro donde `crypto.subtle` no existe, los controles de cuenta se deshabilitan con aviso y la app sigue funcionando sin cuenta.

## Estructura

Las rutas de los steerings, skills, agentes y specs son relativas a la carpeta de la app (`exercise/` en este repositorio). El `.kiro/` y el puente OIDC (`oidc-bridge/`) viven en la raíz del repositorio, junto a `exercise/`.

```
astro.config.mjs            output: 'static', build.format: 'file', integración de Tailwind
package.json                astro, three, tone, vitest
public/                     icon.svg, manifest.webmanifest, melodies/ (servidos tal cual)
src/pages/index.astro       landing: contenido estático + script de cliente
src/pages/app.astro         la app (SPA): marcado de la barra y contenedores + script de cliente
src/layouts/BaseLayout.astro  <head> compartido entre las dos páginas
src/views/                  un módulo JS por vista (reemplaza src/components/*.js de Web Components)
src/styles/                 tailwind.css (tokens), base.css (compartido), app.css, landing.css
src/core/                   lógica sin DOM: rules, store, ticker, feedback, lofi,
                            auth (servicio de autenticación) y auth-config (valores públicos)
src/ui/                     utilidades de interfaz: icons, sheet, util, view (reemplaza base.js), tabs
src/three/                  escena 3D
test/                       pruebas Vitest (antes scripts de consola en docs/modules/*/properties/)
docs/                       features.md y README de cada módulo
```

El puente OIDC vive fuera de `exercise/`, en la raíz del repositorio, como proyecto Node independiente:

```
oidc-bridge/                puente OIDC de GitHub: Node + Express puro, con su propio package.json
  package.json              dependencias instaladas: express y jose (scripts start/dev, sin build de front)
  server.js                 app Express; CORS por allowlist
  routes/                   authorize, callback, token, jwks, discovery (contrato OIDC)
  lib/                      github, jwt (firma RS256) y origins (allowlist, lógica pura)
  .env.example              variables requeridas, sin valores reales
  README.md                 contrato, variables de entorno y cómo correrlo local
```

Los secretos del puente (el client secret de GitHub y la llave privada de firma RS256) viven **solo** en `oidc-bridge/`, en variables de entorno, y nunca llegan al frontend.

## Reglas técnicas

- Las dependencias externas se rigen por `dependencies-policy.md`. El puente OIDC es la excepción acotada: al ser un backend Node aparte, usa `express` y `jose` instalados con `npm`, documentados en esa política.
- Todo recurso externo (Tone.js, Three.js, Cognito y el puente OIDC) debe tener degradación elegante: si no carga o no responde, la app sigue funcionando. Sin autenticación disponible, la app funciona sin cuenta.
- El tiempo del pomodoro se calcula siempre con `endsAt - Date.now()`, nunca acumulando ticks.
- Para probar en celular por red local no hay contexto seguro: no depender de `crypto.randomUUID` ni de APIs que solo existen en HTTPS sin respaldo. El flujo PKCE de la autenticación usa `crypto.subtle`, que solo existe en HTTPS o `localhost`: fuera de ese contexto, la cuenta se deshabilita con aviso y el resto de la app no se ve afectado.
- La sesión de cuenta vive en su propia clave de `localStorage` (`focus-garden:auth:v1`), separada de `jardin-movil:v1`: tocar la sesión nunca cambia tareas, rondas ni ajustes.
