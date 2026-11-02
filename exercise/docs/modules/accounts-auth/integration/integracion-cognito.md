# Integración de `auth.js` con Cognito (ejemplos con mocks)

**Feature: accounts-auth**

**Validates: Requirements 2.1, 2.2, 2.3, 3.1, 4.4, 9.5**

Estos NO son casos de property-based testing (no se repiten 100 veces): son **ejemplos de
integración** de los flujos de [`src/core/auth.js`](../../../../src/core/auth.js) contra
Amazon Cognito, con `fetch`, `location` y `localStorage` simulados. Se prueba un ejemplo por
flujo (y alguna variante donde ayuda a aclarar el contrato): registro, confirmación, inicio de
sesión por contraseña, canje del `code` del redirect OAuth y refresco de tokens.

La idea es verificar que `auth.js` arma las peticiones correctas (endpoint, `X-Amz-Target`,
cuerpo JSON de Cognito, endpoint `/oauth2/token`) y traduce las respuestas a la forma interna
que esperan las vistas, sin tocar datos reales ni la clave del jardín `jardin-movil:v1`.

## Qué se mockea y por qué

- **`globalThis.fetch`**: se intercepta para devolver las respuestas JSON que Cognito daría en
  cada flujo, en función del `X-Amz-Target` (API JSON de Cognito Identity Provider) o de la URL
  (`/oauth2/token` del canje OAuth y `jwks.json` para validar la firma del ID token). No hay red
  real. Se restaura el `fetch` original en el `finally`.
- **`location`**: `auth-config.js` deriva `redirectUri` de `location.origin` **al importar**, así
  que el stub de `location` se instala ANTES del `import` y se restaura al terminar. Solo se
  instala si falta (en el navegador ya existe).
- **`localStorage`**: `saveSession`/`loadSession` y el refresco escriben la sesión en la clave
  dedicada `focus-garden:auth:v1`. El script guarda el valor original de esa clave y de
  `jardin-movil:v1` antes de empezar y los restaura en el `finally`; en Node, donde no hay
  `localStorage`, instala un stub mínimo sobre un `Map`. **Nunca escribe datos de prueba en
  `jardin-movil:v1`.**
- **`sessionStorage`**: el canje OAuth (`handleRedirect`) lee el `state`/`verifier` que
  `signInWithProvider` deja en `sessionStorage` bajo `focus-garden:auth:pkce`. Como no se ejecuta
  el redirect real (que haría `location.assign`), el script **siembra** esa clave a mano para
  simular "ya volvimos del proveedor con este intento". Se restaura al terminar.

## Nota sobre el ID token del canje OAuth

`handleRedirect` solo abre sesión si el ID token es **confiable**: claims válidos (`iss`, `aud`,
`exp`) **y** firma RS256 válida contra el JWKS de Cognito. Para que el ejemplo del canje no
dependa de una firma pre-horneada, el script **genera en el momento** un par de claves RSA con
WebCrypto (`crypto.subtle`), firma un ID token real con la clave privada y publica la clave
pública como JWKS a través del `fetch` mockeado. Así el ejemplo recorre de verdad
`validateIdClaims` + `verifyIdSignature` con un token legítimo, sin secretos ni archivos.

En entornos sin `crypto.subtle` (HTTP en LAN, sin contexto seguro) `verifyIdSignature` degrada a
`false` por diseño; en ese caso el ejemplo del canje se marca como **omitido** (no como fallo) y
los demás flujos siguen corriendo. En el navegador servido por `localhost` o en Node 20+ sí hay
WebCrypto, así que el ejemplo se ejecuta completo.

## Script

Script autocontenido: trae los mocks de `fetch`, los stubs de `location`/`localStorage`, el
sembrado de `sessionStorage` y asserts simples (`throw` si no se cumple lo esperado). Pegarlo en
la consola de DevTools con la app servida, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, integración Cognito (ejemplos con mocks)
// Validates: Requirements 2.1, 2.2, 2.3, 3.1, 4.4, 9.5

// --- Asserts mínimos: lanzan con un mensaje claro si no se cumple lo esperado. ---
const assert = (condition, message) => {
  if (!condition) throw new Error(`Assert falló: ${message}`);
};
const assertEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`Assert falló: ${message} (esperado ${JSON.stringify(expected)}, recibido ${JSON.stringify(actual)})`);
  }
};

// --- Config real que usa auth-config.js, para que los mocks casen con lo que arma auth.js. ---
const REGION = 'us-east-1';
const USER_POOL_ID = 'us-east-1_XXXXXXXXX';
const CLIENT_ID = 'xxxxxxxxxxxxxxxxxxxxxxxxxx';
const COGNITO_API = `https://cognito-idp.${REGION}.amazonaws.com/`;
const EXPECTED_ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;
const SESSION_KEY = 'focus-garden:auth:v1';
const PKCE_KEY = 'focus-garden:auth:pkce';
const GARDEN_KEY = 'jardin-movil:v1';

// --- Stubs de entorno: location antes del import; localStorage/sessionStorage si faltan. ---
const needsLocationStub = typeof location === 'undefined';
if (needsLocationStub) {
  globalThis.location = { origin: 'https://focus-garden.example' };
}
const makeStorageStub = () => {
  const backing = new Map();
  return {
    getItem: (key) => (backing.has(key) ? backing.get(key) : null),
    setItem: (key, value) => void backing.set(key, String(value)),
    removeItem: (key) => void backing.delete(key),
  };
};
const needsLocalStub = typeof localStorage === 'undefined';
if (needsLocalStub) globalThis.localStorage = makeStorageStub();
const needsSessionStub = typeof sessionStorage === 'undefined';
if (needsSessionStub) globalThis.sessionStorage = makeStorageStub();

// --- Utilidades para base64url, que necesita el ID token firmado del canje OAuth. ---
const toBase64url = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const jsonToBase64url = (value) => toBase64url(new TextEncoder().encode(JSON.stringify(value)));

// Genera un par RSA y firma un ID token RS256 real; devuelve el JWT y el JWKS público.
// Si no hay WebCrypto (HTTP sin contexto seguro), devuelve null y el canje se omite.
const makeSignedIdToken = async (claims) => {
  if (!(typeof crypto !== 'undefined' && crypto.subtle)) return null;
  const algorithm = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
  const keyPair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
  const kid = 'test-key-1';
  const header = { alg: 'RS256', kid, typ: 'JWT' };
  const signingInput = `${jsonToBase64url(header)}.${jsonToBase64url(claims)}`;
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(signingInput)),
  );
  const jwt = `${signingInput}.${toBase64url(signatureBytes)}`;
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const jwks = { keys: [{ ...publicJwk, kid, alg: 'RS256', use: 'sig' }] };
  return { jwt, jwks };
};

// --- Respuestas simuladas de Cognito por cada acción/URL. Se arman antes de instalar el mock. ---
// Guardamos los originales para restaurarlos al terminar, aunque algo falle.
const originalFetch = globalThis.fetch;
const originalSession = localStorage.getItem(SESSION_KEY);
const originalPkce = sessionStorage.getItem(PKCE_KEY);
const originalGarden = localStorage.getItem(GARDEN_KEY);

// Una respuesta JSON mínima compatible con lo que lee callCognito/handleRedirect.
const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

try {
  // Sembramos el jardín con un valor conocido para medir no interferencia de verdad.
  const gardenFixture = JSON.stringify({ v: 1, tasks: [{ id: 't1' }], rounds: [] });
  localStorage.setItem(GARDEN_KEY, gardenFixture);

  // El ID token firmado (si hay WebCrypto) para el flujo de canje OAuth.
  const nowSeconds = Math.floor(Date.now() / 1000);
  const signed = await makeSignedIdToken({
    iss: EXPECTED_ISSUER,
    aud: CLIENT_ID,
    exp: nowSeconds + 3600, // en SEGUNDOS epoch, como exige validateIdClaims
    email: 'oauth@focus-garden.example',
    name: 'Olivia OAuth',
  });

  // Enrutador del fetch mockeado: decide la respuesta por URL y por X-Amz-Target.
  // Cada acción devuelve exactamente la forma que Cognito daría, para que auth.js la traduzca.
  const routeFetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const headers = (init && init.headers) || {};
    const target = headers['X-Amz-Target'] || '';

    // JWKS de Cognito para verificar la firma del ID token del canje.
    if (url.includes('/.well-known/jwks.json')) {
      return jsonResponse(signed ? signed.jwks : { keys: [] });
    }

    // Canje OAuth: /oauth2/token devuelve tokens en snake_case (flujo authorization_code).
    if (url.includes('/oauth2/token')) {
      return jsonResponse({
        id_token: signed ? signed.jwt : 'sin-webcrypto',
        access_token: 'access-oauth',
        refresh_token: 'refresh-oauth',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }

    // API JSON de Cognito: la acción va en X-Amz-Target (p. ej. ...Service.SignUp).
    if (url === COGNITO_API) {
      if (target.endsWith('.SignUp')) {
        // Registro: cuenta sin confirmar, Cognito manda código al correo.
        return jsonResponse({ UserConfirmed: false, UserSub: 'sub-123' });
      }
      if (target.endsWith('.ConfirmSignUp')) {
        return jsonResponse({});
      }
      if (target.endsWith('.InitiateAuth')) {
        const payload = JSON.parse((init && init.body) || '{}');
        if (payload.AuthFlow === 'USER_PASSWORD_AUTH') {
          // Login por contraseña: AuthenticationResult con los tokens y su vida.
          return jsonResponse({
            AuthenticationResult: {
              IdToken: 'id-login',
              AccessToken: 'access-login',
              RefreshToken: 'refresh-login',
              ExpiresIn: 3600,
              TokenType: 'Bearer',
            },
          });
        }
        if (payload.AuthFlow === 'REFRESH_TOKEN_AUTH') {
          // Refresco: Cognito NO devuelve refresh token nuevo; solo id/access renovados.
          return jsonResponse({
            AuthenticationResult: {
              IdToken: 'id-refreshed',
              AccessToken: 'access-refreshed',
              ExpiresIn: 3600,
              TokenType: 'Bearer',
            },
          });
        }
      }
    }

    // Cualquier otra ruta no esperada: falla el ejemplo con un error claro en vez de red real.
    throw new Error(`fetch inesperado en el mock: ${url} (target: ${target})`);
  };
  globalThis.fetch = routeFetch;

  // Import DESPUÉS de los stubs: auth-config.js lee location.origin al importar.
  const {
    signUp,
    confirmSignUp,
    signInWithPassword,
    handleRedirect,
    refreshIfNeeded,
    getSession,
    saveSession,
    signOut,
  } = await import('./src/core/auth.js');

  // --- (a) Registro: signUp devuelve needsConfirmation cuando la cuenta queda sin confirmar. ---
  const signUpResult = await signUp({ email: 'nueva@focus-garden.example', password: 'Abcdef1!' });
  assertEqual(signUpResult.email, 'nueva@focus-garden.example', 'signUp conserva el correo');
  assertEqual(signUpResult.userConfirmed, false, 'signUp refleja que la cuenta no está confirmada');
  assertEqual(signUpResult.needsConfirmation, true, 'signUp pide confirmación cuando UserConfirmed es false');

  // --- (b) Confirmación: confirmSignUp resuelve ok con el código correcto. ---
  const confirmResult = await confirmSignUp({ email: 'nueva@focus-garden.example', code: '123456' });
  assertEqual(confirmResult.confirmed, true, 'confirmSignUp marca la cuenta como confirmada');
  assertEqual(confirmResult.email, 'nueva@focus-garden.example', 'confirmSignUp conserva el correo');

  // --- (c) Login por contraseña: abre sesión desde AuthenticationResult y devuelve la ruta. ---
  signOut(); // partimos sin sesión previa
  const loginResult = await signInWithPassword({ email: 'olivia@focus-garden.example', password: 'Abcdef1!' });
  assert(loginResult.session, 'signInWithPassword devuelve una sesión');
  assertEqual(loginResult.session.accessToken, 'access-login', 'la sesión toma el access token de Cognito');
  assertEqual(loginResult.session.refreshToken, 'refresh-login', 'la sesión toma el refresh token de Cognito');
  assert(loginResult.session.accessExpiresAt > Date.now(), 'el access token queda vigente tras el login');
  // Sin Display_Name (no viene en AuthenticationResult) la ruta es el Name_Prompt.
  assertEqual(loginResult.route, 'name-prompt', 'sin Display_Name el login lleva al Name_Prompt');
  assert(getSession() !== null, 'el login deja la sesión activa en memoria');

  // --- (d) Canje del code del redirect OAuth: valida el state, canjea y abre sesión. ---
  if (signed) {
    signOut();
    // Simulamos "ya volvimos del proveedor": sembramos el intento que dejaría signInWithProvider.
    const state = 'estado-de-este-intento';
    sessionStorage.setItem(PKCE_KEY, JSON.stringify({ state, verifier: 'verificador-pkce', provider: 'Google' }));
    const redirectResult = await handleRedirect({ code: 'codigo-de-cognito', state });
    assert(redirectResult.session, 'handleRedirect abre sesión con state correcto y token confiable');
    assertEqual(redirectResult.session.accessToken, 'access-oauth', 'la sesión toma el access token del canje');
    assertEqual(redirectResult.session.email, 'oauth@focus-garden.example', 'el correo sale de los claims del ID token');
    // El ID token trae `name`, así que la ruta va directo a Tareas.
    assertEqual(redirectResult.route, 'tasks', 'con Display_Name en los claims la ruta es tasks');
    // El intento se consume: una segunda vuelta con el mismo state ya no tiene PKCE guardado.
    assertEqual(sessionStorage.getItem(PKCE_KEY), null, 'el canje consume el state/verifier una sola vez');
  } else {
    console.log('  (d) canje OAuth: omitido (sin WebCrypto en este entorno, verifyIdSignature degrada a false)');
  }

  // --- (e) Refresco: con access caducado y refresh vigente, refreshIfNeeded renueva tokens. ---
  const now = Date.now();
  saveSession({
    idToken: 'id-viejo',
    accessToken: 'access-viejo',
    refreshToken: 'refresh-vigente',
    accessExpiresAt: now - 1000, // ya caducó
    refreshExpiresAt: now + 60 * 60 * 1000, // sigue vigente
    displayName: 'Renata',
    email: 'renata@focus-garden.example',
  });
  const refreshed = await refreshIfNeeded();
  assert(refreshed, 'refreshIfNeeded devuelve una sesión renovada, no null');
  assertEqual(refreshed.accessToken, 'access-refreshed', 'el access token se renovó');
  assertEqual(refreshed.idToken, 'id-refreshed', 'el ID token se renovó');
  // Cognito no devuelve refresh token nuevo en REFRESH_TOKEN_AUTH: se conserva el anterior.
  assertEqual(refreshed.refreshToken, 'refresh-vigente', 'el refresh token se conserva');
  assert(refreshed.accessExpiresAt > Date.now(), 'la expiración del access se movió al futuro');

  // --- No interferencia: tras todos los flujos, el jardín sigue byte a byte igual. ---
  assertEqual(localStorage.getItem(GARDEN_KEY), gardenFixture, 'los flujos de auth no tocan jardin-movil:v1');

  console.log('Feature: accounts-auth, integración Cognito: OK');
} finally {
  // Restaurar fetch y las claves reales; borrar las que no existían antes.
  globalThis.fetch = originalFetch;
  if (originalSession === null) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, originalSession);
  if (originalPkce === null) sessionStorage.removeItem(PKCE_KEY);
  else sessionStorage.setItem(PKCE_KEY, originalPkce);
  if (originalGarden === null) localStorage.removeItem(GARDEN_KEY);
  else localStorage.setItem(GARDEN_KEY, originalGarden);

  // Retirar los stubs que haya instalado este script, para no filtrarlos al entorno.
  if (needsSessionStub) delete globalThis.sessionStorage;
  if (needsLocalStub) delete globalThis.localStorage;
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o
   `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`. Conviene
   `localhost` para que haya contexto seguro y `crypto.subtle` esté disponible (el ejemplo del
   canje OAuth firma un ID token real).
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador
   `location`, `localStorage` y `sessionStorage` ya existen, así que los stubs no se aplican; el
   script guarda y restaura el valor real de las claves y reemplaza `fetch` solo mientras corre.
   El `await import('./src/core/auth.js')` resuelve la ruta relativa a la URL de la página.

### En Node (sin navegador)

El script trae el arnés de asserts, los mocks de `fetch`, los stubs de `location`,
`localStorage` y `sessionStorage`, y usa `await import(...)` de nivel superior (módulo). Node 20+
expone `crypto.subtle` y `TextEncoder`/`TextDecoder` como globales, así que el ID token firmado
también funciona. Desde la carpeta de la app (`exercise/`), se copia el bloque ` ```js ` a la
entrada de Node:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth.js')`
resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde
`exercise/`. No se crea ningún archivo temporal.

## Resultado esperado

El script termina sin lanzar error e imprime:

```
Feature: accounts-auth, integración Cognito: OK
```

Si el entorno no tiene WebCrypto, antes del `OK` aparece la línea
`  (d) canje OAuth: omitido ...` y los otros cuatro flujos igual se verifican.

Un `Error: Assert falló: ...` señala que un flujo no devolvió lo esperado (por ejemplo, el login
no abrió sesión, el canje no validó el token o el refresco no renovó el access), e indica qué
afirmación no se cumplió. Un `Error: fetch inesperado en el mock: ...` significa que `auth.js`
llamó a una URL o acción que el mock no cubre, lo que delataría un cambio en el endpoint o en el
`X-Amz-Target` de alguna petición. En cualquier caso, el `finally` restaura `fetch` y las claves,
así que la app queda con sus datos originales, y el caso se reporta a `coder`.

## Última ejecución

Pendiente de correr en este entorno. El script está completo y listo para ejecutarse en la
consola de DevTools con la app servida en `localhost` (para tener `crypto.subtle`), o en Node 20+
por stdin (`node --input-type=module`, pegar el bloque y cerrar con Ctrl-D) desde la carpeta
`exercise/`.

Nota del entorno: igual que en las propiedades 5 y 9, en esta sandbox la combinación
`node --input-type=module --eval` con `await import('./src/core/auth.js')` se cuelga al resolver
el módulo (peculiaridad de `--eval` + top-level `await import`, no de la lógica ni del módulo).
Usar la consola de DevTools o `node --input-type=module` por stdin, que resuelven el `import` sin
ese cuelgue.
