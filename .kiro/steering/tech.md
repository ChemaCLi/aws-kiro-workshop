---
inclusion: always
---

# Stack técnico

- **HTML + JavaScript ES modules** en el **frontend**, sin bundler ni paso de build. Se abre `index.html` o se sirve con cualquier servidor estático. (El único backend es el puente OIDC opcional; ver "Autenticación opcional y backend".)
- **Dos páginas**: `index.html` es la **landing** (página con scroll, sin SPA) y `app.html` es la **app**, una SPA con pestañas por hash. Entrar y salir son navegaciones reales entre ambas.
- **Web Components nativos** (`customElements.define`) con **light DOM** (sin Shadow DOM) para que Tailwind aplique directo.
- **Tailwind por CDN** (`https://cdn.tailwindcss.com`) con la configuración de colores en `src/ui/tailwind-config.js`, que cargan las dos páginas.
- **Tone.js por CDN** para la música y la campanita. No hay archivos de audio: las melodías son JSON en `melodies/`.
- **Three.js por CDN** con import map, solo para el mundo 3D y cargado con `import()` dinámico.
- **Web Worker** para el pulso del pomodoro (`src/core/ticker.worker.js`).
- **localStorage** para persistir: la clave `jardin-movil:v1` guarda tareas, rondas y ajustes; la clave `focus-garden:auth:v1` guarda la sesión de cuenta (separada, para que cerrar sesión o perder tokens nunca afecte los datos del jardín).
- Idioma de la interfaz: **español únicamente** (`lang="es"`, fechas con `es-MX`).

## Autenticación opcional y backend

A partir del spec `accounts-auth`, la app ofrece cuentas con **Amazon Cognito** de forma **opcional**: quien no quiera cuenta sigue usando la app con sus datos locales igual que antes.

- **El frontend sigue sin paso de build.** La autenticación **no** agrega un bundler ni compilación: se escribe con ES modules como el resto de la app.
- **Sin SDK de cliente.** No se usa `amazon-cognito-identity-js` ni un SDK equivalente. `src/core/auth.js` implementa el flujo **OAuth 2.0 (authorization code + PKCE)** con `fetch` nativo y **WebCrypto** (`crypto.subtle`), y habla con la **API JSON de Cognito Identity Provider** (`SignUp`, `ConfirmSignUp`, `InitiateAuth`, etc.) y con el **Hosted UI** de Cognito para los redirects sociales.
- **Configuración pública sin secretos** en `src/core/auth-config.js`: `userPoolId`, `clientId` (App Client sin secreto), dominio de Cognito, `redirectUri`, scopes, proveedores y el endpoint del puente OIDC. Nunca contiene ningún secreto.
- **Un único backend: el puente OIDC de GitHub** (`oidc-bridge/`, **Node + Express puro**, con su propio `package.json` y `npm`). Permite iniciar sesión con GitHub, que Cognito no soporta de forma nativa. Es el único rincón del proyecto que **sí** usa dependencias instaladas (`express` y `jose`). Los demás proveedores (Google, Meta, Login with Amazon) se resuelven con el Hosted UI, sin backend.
- **Degradación elegante:** sin red, o en un contexto no seguro donde `crypto.subtle` no existe, los controles de cuenta se deshabilitan con aviso y la app sigue funcionando sin cuenta.

## Estructura

Las rutas de los steerings, skills, agentes y specs son relativas a la carpeta de la app (`exercise/` en este repositorio). El `.kiro/` y el puente OIDC (`oidc-bridge/`) viven en la raíz del repositorio, junto a `exercise/`.

```
index.html                  landing: contenido estático, import map de Three.js
app.html                    la app (SPA): <app-shell>, import map, Tone.js
manifest.webmanifest        metadatos de instalación (start_url: app.html)
melodies/                   melodías lofi en JSON + index.json
src/landing.js              arranque de la landing
src/main.js                 arranque de la app
src/styles/                 base.css (compartido), app.css, landing.css
src/core/                   lógica sin DOM: rules, store, ticker, feedback, lofi,
                            auth (servicio de autenticación) y auth-config (valores públicos)
src/ui/                     utilidades de interfaz: icons, sheet, util, base, tailwind-config
src/components/             un Web Component por módulo visible
src/three/                  escena 3D
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
- Si el usuario migra a React o Vue (ver skill `migrate-to-react-or-vue`), esta sección se actualiza y la política de dependencias deja de limitarse a CDN.
