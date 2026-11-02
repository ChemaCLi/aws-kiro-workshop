# Módulo accounts-auth

## Descripción

Módulo de **autenticación opcional** con Amazon Cognito (spec `accounts-auth`, el segundo de la evolución hacia cuentas y sincronización; ver `docs/current-plan.md`). Agrega, por primera vez en el proyecto, una página propia de registro e inicio de sesión dentro de la app y un pequeño backend aparte. **La cuenta es opcional**: quien no quiera cuenta sigue usando la app igual que siempre, sin registrarse. Este spec construye solo la autenticación (registro, inicio y cierre de sesión); el guardado en la nube es del spec `cloud-sync` y la sección "Mis sesiones" es del spec `multi-device-sessions`.

### Tensión con los principios del proyecto

Este módulo contradice el principio de producto 6 ("datos locales, sin cuentas ni servidor") y el stack de `tech.md` ("sin backend, sin build"). Se resuelve así: las cuentas son **opcionales**, **los datos locales siguen intactos** (la clave `jardin-movil:v1` no cambia de forma en este spec; la posible migración a la nube es del spec `cloud-sync`) y el único backend que se agrega es el puente de GitHub. Crear una cuenta o iniciar sesión **no toca** `localStorage`.

### Qué hace

- **Página de cuenta** (`<account-view>`) en la ruta hash `#/cuenta` de `app.html`, con el estilo de Focus Garden: formulario de registro, formulario de inicio de sesión y los botones de los proveedores sociales y de GitHub. Permite volver a la app sin cuenta.
- **Registro con usuario y contraseña**: Cognito crea el usuario, envía un código de confirmación al correo, se confirma la cuenta y se pasa al Name_Prompt.
- **Inicio de sesión con usuario y contraseña** contra Cognito, que establece la sesión.
- **Proveedores sociales**: Google, Meta (Facebook/Instagram) y Login with Amazon, resueltos con el Hosted UI de Cognito mediante OAuth 2.0 con código de autorización, PKCE y un `state` aleatorio.
- **GitHub** vía el **puente OIDC** (`oidc-bridge/`, con su propio README), un servicio aparte en Node.js con Express puro, porque Cognito no soporta GitHub de forma nativa. El puente traduce el inicio de sesión de GitHub a un proveedor OIDC que Cognito acepta.
- **Nombre tras el registro** (Name_Prompt): tras registrarse se pide **solo** el nombre para mostrar (Display_Name) y un botón "Ir a mi Garden". Quien inicie sesión sin nombre vuelve a verlo.
- **Account_Slot en Ajustes**: el bloque "Mi cuenta" (antes un Reserved_Slot "Próximamente") se reemplaza por el estado real de la cuenta, con el nombre o el correo y el control de cerrar sesión. El bloque "Mis sesiones" sigue "Próximamente".
- **Manejo de tokens**: los Auth_Tokens (ID, access y refresh) se guardan en el navegador para restaurar la sesión en la siguiente visita; el access token caducado se refresca con el refresh token sin pedir iniciar sesión de nuevo; se valida la firma y los claims (issuer, audience y expiración) del ID token antes de confiar en el nombre y el correo.
- **Degradación elegante**: sin red o sin el SDK de Cognito, la app sigue funcionando sin cuenta y los controles de cuenta se muestran **deshabilitados con un aviso**, sin romper el resto de Ajustes. Cuando la red o el SDK vuelven, los controles se habilitan sin recargar.
- **Datos locales intactos**: ninguna de estas acciones modifica las tareas, rondas ni ajustes de `localStorage`.

### Dónde viven los secretos

El frontend es un **cliente público sin secreto**: usa un App Client de Cognito sin client secret y protege el flujo con PKCE, el `state` aleatorio y las redirect URIs permitidas. El `Auth_Config` (`src/core/auth-config.js`) contiene **solo valores públicos**: User Pool ID, App Client ID público, dominio de Cognito, redirect URIs y el endpoint del puente. Los **secretos** (GitHub Client Secret y las llaves de firma del puente) viven **únicamente en el OIDC_Bridge**, en variables de entorno, y nunca se envían al navegador.

### Archivos clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/core/auth.js` | Lógica pura y servicio de autenticación: PKCE, `state`, URL de autorización, canje, validación de claims, refresco, round-trip de la sesión, modelo del Account_Slot, mapeo de errores. |
| `src/core/auth-config.js` | Configuración **pública** (`AUTH_CONFIG`): User Pool, App Client, dominio, redirect URIs, endpoint del puente. Sin secretos. |
| `src/components/account-view.js` | La página de cuenta (`#/cuenta`): formularios, botones de proveedores y Name_Prompt. |
| `src/components/app-shell.js` | Ruteo: `routeFromHash` distingue `#/cuenta` de las pestañas. |
| `src/components/settings-view.js` | Account_Slot que reemplaza el Reserved_Slot "Mi cuenta"; conserva "Mis sesiones" como "Próximamente". |
| `index.html` y `src/landing.js` | El Create_Account_Button de la landing es un enlace directo (`<a href="./app.html#/cuenta" data-act="account">` en `index.html`) a la página de cuenta; `landing.js` ya no intercepta ese botón para abrir una hoja, solo el botón "Entrar". |
| `src/components/landing-sheets.js` | Hoja de recordatorio "Antes de empezar" que se muestra al entrar a la app desde la landing ("Puedes crear una cuenta desde los ajustes si así lo deseas"); es informativa y nunca bloquea la entrada. |
| `oidc-bridge/` | Backend aparte en Node/Express (puente OIDC de GitHub). Tiene su **propio README** con endpoints, variables de entorno y cómo correrlo localmente. |

## Pruebas para qa-tester

Antes de empezar: servir la carpeta de la app con un servidor estático y abrir `http://localhost:8080/app.html` en un navegador con DevTools. La página de cuenta se abre en `http://localhost:8080/app.html#/cuenta`. La consola de la app ofrece `__store` (estado).

**Nota importante sobre el backend.** Varios flujos requieren **Cognito real configurado** (y, para GitHub, el **OIDC_Bridge** corriendo con sus variables de entorno). Los casos marcados con **(requiere backend)** no se pueden verificar sin esa configuración: para ellos, apóyate en las **pruebas de propiedad** de la carpeta [`properties/`](./properties/) (lógica pura de `auth.js`: PKCE, URL de autorización, canje, validación de claims, refresco, round-trip de la sesión, modelo del Account_Slot) y en las **pruebas del puente** en `oidc-bridge/test/` (contrato OIDC, canje con GitHub, orígenes permitidos, secretos solo en el servidor). Lo que **sí** se verifica sin backend: el ruteo `#/cuenta`, el diseño y los objetivos táctiles, volver sin cuenta, la degradación elegante sin red/SDK, el Account_Slot deshabilitado, que los datos locales quedan intactos y que **ningún secreto viaja** desde el front.

### Pruebas de ejemplos y bordes (UI)

#### Caso 1 — Página de cuenta con el estilo de la app (Requisito 1)

1. Abrir `http://localhost:8080/app.html#/cuenta` a 1280 px y comprobar que se muestra la página de cuenta con el formulario de registro, el de inicio de sesión y los botones de Google, Meta, Login with Amazon y GitHub.
2. Revisar los colores (crema, papel, tinta, musgo, hoja, línea) y la fuente redondeada del sistema.
3. Con DevTools, medir **cada** botón, enlace e input: altura ≥ 44 px. Inspeccionar los `input` de texto y confirmar `font-size: 16px` (para evitar el zoom automático de iOS).
4. Sin sesión iniciada, buscar y usar el control para **volver a la app sin cuenta**.
5. Con el teclado (Tab), recorrer los controles: cada uno con su `label` asociado; los de solo ícono con `aria-label`.
6. Repetir a 390 px y a 320 px: sin desbordes horizontales.

**Esperado:** `#/cuenta` muestra la página de cuenta con registro, inicio de sesión y los cinco botones de proveedor; usa los tokens de diseño y la fuente redondeada; todo objetivo táctil mide al menos 44 px de alto y los inputs de texto miden 16 px; sin sesión se puede volver a la app sin cuenta; cada control tiene etiqueta o `aria-label`; sin desbordes a 320, 390 ni 1280 px.

#### Caso 2 — Registro con usuario y contraseña (Requisito 2) — (requiere backend)

1. En `#/cuenta`, enviar el formulario de registro con un correo nuevo y una contraseña válida.
2. Observar el aviso de que se envió un código al correo y el campo para escribirlo; introducir el código y confirmar.
3. Repetir el registro con un correo **ya registrado**.
4. Intentar registrarse con una contraseña que **no** cumple la política del User Pool.
5. Enviar un código de confirmación **incorrecto o caducado** y usar la opción de reenviar.

**Esperado:** al enviar, Cognito crea el usuario y aparece el aviso del código con su campo; al confirmar con el código correcto se pasa al Name_Prompt; con un correo ya registrado aparece el mensaje de correo en uso y se ofrece iniciar sesión; con una contraseña que no cumple la política se muestran las reglas incumplidas **antes** de enviar; con un código incorrecto o caducado se muestra el error y se ofrece reenviar. Sin backend, apóyate en la propiedad 13 (reglas de contraseña) y la propiedad 14 (mensajes de error).

#### Caso 3 — Inicio de sesión con usuario y contraseña (Requisito 3) — (requiere backend)

1. Con una cuenta ya confirmada, enviar el formulario de inicio con el correo y la contraseña correctos.
2. Enviar con credenciales **incorrectas** y leer el mensaje.
3. Con una cuenta **sin confirmar**, intentar iniciar sesión.
4. Iniciar sesión con una cuenta **sin Display_Name** y observar a dónde lleva la app.

**Esperado:** con credenciales correctas Cognito devuelve los tokens, se guardan y se establece la sesión, y la app navega a Tareas; con credenciales incorrectas aparece un mensaje que no revela si falló el correo o la contraseña; con una cuenta sin confirmar se ofrece reenviar el código y continuar la confirmación; si falta el Display_Name se pasa primero al Name_Prompt. Sin backend, apóyate en la propiedad 7 (destino tras iniciar sesión según Display_Name) y la propiedad 14 (mensajes de error).

#### Caso 4 — Proveedores sociales: Google, Meta, Login with Amazon (Requisito 4) — (requiere backend)

1. En `#/cuenta`, comprobar que hay un botón por cada proveedor social: Google, Meta y Login with Amazon.
2. Con DevTools > Network abierta y "Preserve log" activo, tocar un proveedor y observar el redirect al Hosted UI de Cognito; inspeccionar la URL de autorización: `response_type=code`, `code_challenge`, `code_challenge_method=S256`, `state` y una `redirect_uri` de las permitidas.
3. Completar el inicio en el proveedor y volver; observar que se establece la sesión y, si falta el nombre, aparece el Name_Prompt.
4. Simular un `state` que **no** coincide al volver (editar el parámetro `state` del redirect).
5. **Cancelar** el flujo en el Hosted UI y volver.

**Esperado:** hay un botón por proveedor; al tocarlo se inicia el flujo de código con PKCE y `state`, y se redirige al Hosted UI; al volver con un código válido y el `state` coincidente, se canjea el código con el verificador y se establece la sesión (con Name_Prompt si falta el nombre); si el `state` no coincide, se descarta la respuesta y se muestra un error sin abrir sesión; si se cancela en el Hosted UI, se vuelve a la página de cuenta sin mensaje de error. Sin backend, apóyate en las propiedades 2 (PKCE), 3 (URL de autorización), 4 (canje valida el state) y 5 (state aleatorio).

#### Caso 5 — Inicio con GitHub mediante el puente OIDC (Requisito 5) — (requiere backend + puente)

1. En `#/cuenta`, comprobar el botón para iniciar sesión con GitHub.
2. Con el OIDC_Bridge corriendo, tocar el botón de GitHub y observar el flujo de código con PKCE y `state` contra Cognito, usando el puente como proveedor de identidad; completar el inicio y volver.
3. **Detener** el OIDC_Bridge (o bloquear su endpoint en Network) y tocar el botón de GitHub.
4. Con DevTools > Network, inspeccionar todas las peticiones que salen del **front** durante el flujo de GitHub.

**Esperado:** hay un botón de GitHub; con el puente disponible el inicio funciona como los demás proveedores (code + PKCE + state, canje y sesión); si el puente no responde, aparece el mensaje de que GitHub no está disponible y **los demás métodos siguen funcionando**; el front lee el endpoint del puente desde el `Auth_Config` y **no** incluye ningún secreto de GitHub en sus peticiones. El canje con GitHub y los secretos solo en el servidor se verifican en `oidc-bridge/test/`.

#### Caso 6 — Nombre tras el registro y repregunta al iniciar sesión (Requisito 6) — (requiere backend)

1. Completar un registro por cualquier método sin Display_Name previo y observar el Name_Prompt.
2. Comprobar que el Name_Prompt pide **solo** el nombre; escribirlo y observar que aparece el botón "Ir a mi Garden".
3. Tocar "Ir a mi Garden".
4. Repetir el registro pero **salir del Name_Prompt sin escribir nombre**.
5. Iniciar sesión de nuevo con una cuenta cuyo Display_Name sigue faltando.

**Esperado:** tras un registro sin nombre aparece el Name_Prompt que pide solo el Display_Name; al escribirlo se guarda como atributo en Cognito y aparece el botón "Ir a mi Garden"; tocarlo lleva a Tareas; salir sin escribir nombre lleva a Tareas sin guardar nombre; quien inicie sesión sin Display_Name vuelve a ver el Name_Prompt antes de Tareas; el Name_Prompt no pide ningún otro dato. Sin backend, apóyate en la propiedad 7 (el destino depende solo de la Display_Name).

#### Caso 7 — Account_Slot y cierre de sesión en Ajustes (Requisito 7)

1. **Sin sesión** y con el SDK disponible: en Ajustes, al final, revisar el bloque "Mi cuenta"; debe ser un control que lleva a la página de cuenta para crear cuenta o iniciar sesión.
2. Comprobar que "Mis sesiones" sigue con la etiqueta "Próximamente".
3. **Con sesión** (requiere backend): revisar que el Account_Slot muestra el Display_Name (o el correo si falta el nombre) y un control de cerrar sesión.
4. Antes de cerrar sesión, anotar en `__store.state` las tareas, rondas y ajustes.
5. Tocar "cerrar sesión" y observar el toast; volver a revisar `__store.state` y `localStorage['jardin-movil:v1']`.

**Esperado:** "Mi cuenta" ya no dice "Próximamente": sin sesión es un control que lleva a la página de cuenta; con sesión muestra el nombre o el correo y permite cerrar sesión; "Mis sesiones" sigue "Próximamente"; al cerrar sesión se descartan los tokens, termina la sesión y aparece el toast "Sesión cerrada"; **las tareas, rondas y ajustes de `localStorage['jardin-movil:v1']` quedan exactamente igual** (ver también el Caso 12). Sin backend, apóyate en la propiedad 12 (modelo del Account_Slot).

#### Caso 8 — Opcionalidad y coexistencia con el modo sin cuenta (Requisito 8)

1. Sin iniciar sesión, usar Tareas, Foco (una ronda), Jardín 3D y Estadísticas; comprobar que todo funciona desde los datos locales.
2. En la **landing** (`http://localhost:8080/`), tocar el Create_Account_Button ("Mantén vivo tu jardín, lleva tu progreso contigo").
3. En la landing, usar el flujo "Iniciar sin cuenta" / "Empezar mi jardín".
4. Crear una cuenta o iniciar sesión (requiere backend) y volver a revisar las tareas, rondas y ajustes locales.
5. Recorrer todas las pestañas buscando alguna función bloqueada tras una sesión.

**Esperado:** la app es totalmente usable sin sesión; el Create_Account_Button de la landing ahora navega a la página de cuenta en vez de abrir la hoja "Próximamente"; el flujo de entrar sin cuenta conserva su comportamiento y no exige cuenta; crear cuenta o iniciar sesión deja los datos locales **intactos**; ninguna función queda bloqueada tras una sesión.

#### Caso 9 — Configuración pública y manejo de tokens (Requisito 9)

1. Abrir `src/core/auth-config.js` y revisar `AUTH_CONFIG`: solo User Pool ID, App Client ID público, dominio de Cognito, redirect URIs y endpoint del puente; **ningún** secreto (client secret, secreto de GitHub, secreto del App Client).
2. Confirmar que el App Client de Cognito usado es **sin** secreto (cliente público con PKCE).
3. Con sesión iniciada (requiere backend), recargar la página: la sesión se restaura mientras los tokens siguen válidos.
4. Forzar un access token caducado con el refresh token aún válido y observar que la sesión se refresca sin pedir iniciar sesión de nuevo.
5. Forzar un refresh token caducado o rechazado y observar que termina la sesión y aparece la página de cuenta para un nuevo inicio.

**Esperado:** `AUTH_CONFIG` contiene solo valores públicos y ningún secreto; el App Client es público sin secreto; los tokens se guardan en el navegador y la sesión se restaura en la siguiente visita mientras son válidos; con el access token caducado y el refresh válido se obtienen tokens nuevos sin reiniciar sesión; con el refresh caducado o rechazado termina la sesión y se muestra la página de cuenta; al establecer la sesión se valida la firma y los claims (issuer, audience, expiración) del ID token antes de confiar en el nombre y el correo. Sin backend, apóyate en las propiedades 6 (Auth_Config solo público), 9 (round-trip de la sesión), 10 (decisión de refresco) y 11 (validación de claims).

#### Caso 10 — Degradación elegante sin red o sin SDK (Requisito 10)

1. En DevTools > Network, poner la red **sin conexión** y abrir `#/cuenta`.
2. Observar los controles de registro, inicio y proveedores.
3. Con la red sin conexión (o bloqueando el CDN del SDK de Cognito), abrir **Ajustes** y revisar el Account_Slot y el resto de la vista.
4. Volver a poner la red **con conexión** (o desbloquear el CDN) **sin recargar** y observar los controles de cuenta.
5. Revisar que el SDK de Cognito se carga por CDN con **versión fija**.

**Esperado:** sin SDK la app sigue funcionando sin cuenta y los controles de cuenta se muestran **deshabilitados con un aviso**; sin red, la página de cuenta muestra los controles de registro, inicio y proveedores deshabilitados con el aviso "Necesitas conexión para usar tu cuenta"; en Ajustes el Account_Slot se muestra deshabilitado con aviso y **no rompe** el resto de la vista; cuando la red o el SDK vuelven, los controles se habilitan **sin recargar**; el SDK se carga por CDN con versión fija (nunca `latest`). Esta es la prueba de bloqueo de red/CDN; apóyate también en la propiedad 12 (Account_Slot deshabilitado sin SDK).

#### Caso 11 — Puente OIDC de GitHub como servicio Node/Express (Requisito 11) — (requiere puente)

1. Abrir el README del puente (`oidc-bridge/`) y seguir las instrucciones para correrlo localmente con sus variables de entorno.
2. Comprobar que es un servicio Node.js con Express puro, aparte del frontend, sin paso de build de front.
3. Consultar los endpoints OIDC que Cognito requiere: autorización, token y JSON Web Key Set.
4. Confirmar que el GitHub Client ID, el GitHub Client Secret y las llaves de firma se leen de **variables de entorno** y no del `Auth_Config`.
5. Hacer una petición desde un **origen no permitido** y observar el rechazo.
6. Ejecutar las pruebas de `oidc-bridge/test/`.

**Esperado:** el puente es un servicio Node/Express separado, sin build de front; expone los endpoints de autorización, token y JWKS; lee el Client ID, el Client Secret y las llaves de firma de variables de entorno (nunca del `Auth_Config`); al recibir una autorización de GitHub la canjea con GitHub y emite un ID token OIDC que Cognito acepta; acepta solo el redirect de Cognito y los orígenes permitidos y rechaza cualquier otro; el README documenta cómo correrlo y qué variables requiere; las pruebas de `oidc-bridge/test/` pasan.

#### Caso 12 — Seguridad: ningún secreto viaja y cerrar sesión no toca los datos (Requisito 12)

1. Buscar en todo el frontend (`src/`, `app.html`) cualquier `client_secret`, secreto de GitHub o secreto del App Client de Cognito. No debe haber ninguno.
2. En DevTools > Network, con "Preserve log" activo, recorrer todos los flujos de inicio de sesión disponibles e inspeccionar cada petición que sale del **front**: comprobar que **ningún secreto** (`client_secret`, secreto de GitHub) viaja en la URL, los encabezados ni el cuerpo.
3. Confirmar en las URLs de autorización que se usa `response_type=code` con PKCE (`code_challenge`, `S256`) y **nunca** el flujo implícito (`response_type=token`).
4. Confirmar que el `state` cambia en cada intento y que un redirect con `state` que no coincide se rechaza (ver Caso 4).
5. Confirmar que solo se redirige a las redirect URIs declaradas en el `Auth_Config`.
6. Con sesión iniciada, anotar el valor completo de `localStorage['jardin-movil:v1']`; tocar "Cerrar sesión" en Ajustes; volver a leer `localStorage['jardin-movil:v1']` y compararlo byte a byte.

**Esperado:** el frontend no contiene ningún secreto; en la pestaña Network **ningún secreto viaja** desde el front en ningún flujo; se usa el flujo de código con PKCE para todos los proveedores y nunca el implícito; el `state` es fresco por intento y los redirect con `state` distinto se rechazan; solo se redirige a las URIs permitidas; **"Cerrar sesión" NO modifica `localStorage['jardin-movil:v1']`** (las tareas, rondas y ajustes quedan idénticos). El secreto de GitHub y las llaves de firma solo en el servidor se verifican en `oidc-bridge/test/`. Sin backend, apóyate en las propiedades 2, 3, 4 y 5.

### Pruebas de propiedades (consola del navegador)

El proyecto no tiene Node, bundler ni ejecutor de pruebas, y la política de dependencias pide confirmación antes de sumar una librería. Las propiedades de la lógica pura de `core` se ejecutan por eso en la consola del navegador con un arnés de pocas líneas, sin dependencias.

**Arnés `forAll(runs, generate, check)`:**

```js
// Arnés mínimo: corre `check` con `runs` entradas aleatorias y falla con la primera que no cumpla.
const forAll = (runs, generate, check) => {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
  }
};
```

- `runs`: número de iteraciones.
- `generate()`: devuelve una entrada aleatoria nueva en cada llamada.
- `check(input)`: devuelve `true` si la propiedad se cumple. Si devuelve `false`, el arnés lanza un error con la entrada que falló, que sirve como contraejemplo.

Algunas propiedades de este módulo (por ejemplo la del desafío PKCE) usan `crypto.subtle`, que es asíncrono; esas traen una variante `async` del arnés que espera cada resultado (`await check(input)`). Cada script lo incluye tal cual.

**Cómo ejecutarlo:**

1. Servir la app con cualquier servidor estático y abrirla en un **contexto seguro** (`http://localhost:8080` o `https://`): `crypto.subtle` solo existe ahí, así que las propiedades de PKCE y de firma no corren por IP de LAN sin HTTPS.
2. Abrir la consola de DevTools, pegar el script de la propiedad (ver la carpeta de abajo). Cada script es autocontenido: trae el arnés, la etiqueta y, cuando hace falta, un stub de `location` para correr también en Node 20+. Los módulos se importan con `await import('./src/core/auth.js')`.
3. Correr **al menos 100 iteraciones** con datos aleatorios (`runs >= 100`).
4. En dominios finitos (por ejemplo todos los proveedores de `AUTH_CONFIG.providers`) no se muestrea: se recorre el dominio completo con un bucle y se combina con `forAll` para las variaciones aleatorias.
5. Las propiedades que tocan el estado guardado (`saveSession`, `loadSession`) deben restaurar el `localStorage` original al terminar, para no dejar datos de prueba.

**Etiqueta de cada propiedad:** `Feature: accounts-auth, Property N: título`. El script que la comprueba empieza con esa etiqueta como comentario.

**Resultado esperado:** el script termina sin lanzar error. Un `Error: Falla con: ...` indica un contraejemplo y se reporta a `coder` con la entrada que muestra.

**Scripts de las propiedades:** cada propiedad guarda su script en [`properties/`](./properties/), con el nombre `propiedad-N-<tema>.md`.

| # | Propiedad | Requisitos | Script |
|---|-----------|------------|--------|
| 1 | La ruta de cuenta se decide solo por el hash | 1.1 | [propiedad-1-ruta-hash.md](./properties/propiedad-1-ruta-hash.md) |
| 2 | El desafío PKCE deriva del verificador y es verificable | 4.4, 12.1 | [propiedad-2-pkce.md](./properties/propiedad-2-pkce.md) |
| 3 | La URL de autorización usa code, PKCE, state y una redirect permitida | 4.2, 5.2, 12.1, 12.3 | [propiedad-3-authorize-url.md](./properties/propiedad-3-authorize-url.md) |
| 4 | El canje valida el state y nunca envía secreto | 4.3, 4.5, 5.4, 9.3, 12.2 | [propiedad-4-canje-state.md](./properties/propiedad-4-canje-state.md) |
| 5 | El state es fresco y suficientemente aleatorio | 12.2 | [propiedad-5-state-aleatorio.md](./properties/propiedad-5-state-aleatorio.md) |
| 6 | Auth_Config solo contiene valores públicos | 5.6, 9.1, 9.2, 12.4 | [propiedad-6-auth-config-publico.md](./properties/propiedad-6-auth-config-publico.md) |
| 7 | El destino tras iniciar sesión depende solo de la Display_Name | 3.5, 4.7, 6.1, 6.5 | [propiedad-7-post-signin-route.md](./properties/propiedad-7-post-signin-route.md) |
| 9 | Guardar y cargar la sesión es un round-trip | 9.4 | [propiedad-9-sesion-roundtrip.md](./properties/propiedad-9-sesion-roundtrip.md) |
| 10 | La decisión de refresco cubre todas las expiraciones | 9.5, 9.6 | [propiedad-10-refresco.md](./properties/propiedad-10-refresco.md) |
| 11 | El ID token se acepta solo con claims correctos | 9.7, 12.5 | [propiedad-11-validar-claims.md](./properties/propiedad-11-validar-claims.md) |
| 12 | El modelo del Account_Slot refleja disponibilidad y sesión | 7.1, 7.2, 7.3, 10.1, 10.3 | [propiedad-12-account-slot.md](./properties/propiedad-12-account-slot.md) |
| 13 | Las reglas de contraseña incumplidas son exactas | 2.5 | [propiedad-13-reglas-contrasena.md](./properties/propiedad-13-reglas-contrasena.md) |
| 14 | Los errores de autenticación mapean a mensajes seguros | 2.4, 3.3 | [propiedad-14-errores-auth.md](./properties/propiedad-14-errores-auth.md) |
| 15 | El puente acepta solo orígenes de la allowlist | 11.5, 12.6 | `oidc-bridge/test/origins.test.js` |

**Pruebas del puente OIDC:** el contrato del `oidc-bridge/` (endpoints OIDC, canje con GitHub, orígenes permitidos y secretos solo en el servidor) se verifica con las pruebas de `oidc-bridge/test/`, descritas en el README del puente.

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0.0 | 2026-11-01 | Versión inicial del módulo de autenticación opcional con Amazon Cognito. Página de cuenta (`<account-view>`) en la ruta `#/cuenta` con registro e inicio de sesión por usuario y contraseña, proveedores sociales (Google, Meta, Login with Amazon) por el Hosted UI con código de autorización + PKCE + `state`, e inicio con GitHub mediante el puente OIDC (`oidc-bridge/`, backend Node/Express con los secretos en variables de entorno). Name_Prompt tras el registro, Account_Slot real en Ajustes que reemplaza el Reserved_Slot "Mi cuenta" (se conserva "Mis sesiones" como "Próximamente"), y el Create_Account_Button de la landing conectado a la página de cuenta. Manejo de tokens (guardado, refresco y validación de claims), degradación elegante sin red o sin SDK y datos locales intactos (la clave `jardin-movil:v1` no cambia). Las cuentas son opcionales: la tensión con el principio 6 de `product.md` y con `tech.md` se resuelve documentando que los datos siguen siendo locales y que el único backend es el puente de GitHub. |
| 1.0.1 | 2026-11-01 | Correcciones de documentación, sin cambio de comportamiento. Se corrigió la atribución en "Archivos clave": la navegación del Create_Account_Button vive en `index.html` (enlace a `./app.html#/cuenta`) y `src/landing.js`, mientras que `landing-sheets.js` solo muestra la hoja informativa "Antes de empezar". La propiedad 4 se actualizó para reflejar que `handleRedirect` ya está implementada y compara el `state` por igualdad estricta (el helper `stateAccepts` queda como oráculo de referencia). Se agregó la propiedad 15 (el puente acepta solo orígenes de la allowlist, `oidc-bridge/test/origins.test.js`) al inventario de propiedades. |
