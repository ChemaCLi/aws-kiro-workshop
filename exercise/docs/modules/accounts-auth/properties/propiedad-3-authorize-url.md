# Propiedad 3: la URL de autorización usa code, PKCE, state y redirect permitida

**Feature: accounts-auth, Property 3: La URL de autorización usa code, PKCE, state y una redirect permitida.**

**Validates: Requirements 4.2, 5.2, 12.1, 12.3**

## Enunciado

Para cualquier proveedor de `AUTH_CONFIG.providers` (dominio finito: se recorren todos) y cualquier `state` y `challenge`, `buildAuthorizeUrl({ provider, state, challenge })` de [`src/core/auth.js`](../../../../src/core/auth.js) devuelve una URL cuyos parámetros de consulta cumplen, sin excepción:

- `response_type` es exactamente `code` (nunca `token`: jamás se usa el flujo implícito).
- `code_challenge_method` es exactamente `S256` (PKCE).
- `code_challenge` es igual al `challenge` recibido.
- `state` es igual al `state` recibido (protección CSRF).
- `redirect_uri` es exactamente `AUTH_CONFIG.redirectUri`, una redirect permitida declarada en la config.
- `client_id` es exactamente `AUTH_CONFIG.clientId`.
- `identity_provider` es exactamente `AUTH_CONFIG.providers[provider]`.

Además, la URL **nunca** contiene un secreto: no aparece ningún parámetro `client_secret` ni `response_type=token` en toda la cadena.

Como el conjunto de proveedores es finito, el script los recorre **todos** y, por cada uno, prueba `state` y `challenge` aleatorios (≥100 iteraciones en total) para dar garantía de propiedad sobre el espacio de entradas.

## Nota sobre Node y `location`

`auth-config.js` deriva `redirectUri` de `location.origin`, que no existe en Node. El script define un `location` mínimo y limpio **antes** de importar el módulo (y lo restaura al terminar), de modo que el mismo script corre en la consola del navegador (donde `location` ya existe y el stub no se aplica) y en Node.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta y el stub de `location`. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 3: La URL de autorización usa code, PKCE, state y una redirect permitida
// Validates: Requirements 4.2, 5.2, 12.1, 12.3

// Arnés mínimo: corre `check` con `runs` entradas aleatorias y falla con la primera que no cumpla.
const forAll = (runs, generate, check) => {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
  }
};

// En Node no hay `location`; se define un stub limpio solo si falta, y se restaura al terminar.
const needsLocationStub = typeof location === 'undefined';
if (needsLocationStub) {
  globalThis.location = { origin: 'https://focus-garden.example' };
}

// Genera una cadena URL-safe aleatoria, como las que produce base64url para state y challenge.
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const randomUrlSafe = (len) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

try {
  const { buildAuthorizeUrl } = await import('./src/core/auth.js');
  const { AUTH_CONFIG } = await import('./src/core/auth-config.js');

  const providerKeys = Object.keys(AUTH_CONFIG.providers);
  if (providerKeys.length === 0) throw new Error('AUTH_CONFIG.providers está vacío: no hay nada que probar');

  // Afirma todas las garantías de la propiedad sobre una URL ya construida.
  const assertAuthorizeUrl = ({ provider, state, challenge }) => {
    const url = new URL(buildAuthorizeUrl({ provider, state, challenge }));
    const params = url.searchParams;

    // Flujo de código con PKCE, nunca implícito.
    if (params.get('response_type') !== 'code') return false;
    if (params.get('code_challenge_method') !== 'S256') return false;
    if (params.get('code_challenge') !== challenge) return false;

    // State contra CSRF: el mismo que se pasó.
    if (params.get('state') !== state) return false;

    // Redirect permitida y client_id, tomados de la config pública.
    if (params.get('redirect_uri') !== AUTH_CONFIG.redirectUri) return false;
    if (params.get('client_id') !== AUTH_CONFIG.clientId) return false;

    // El identity_provider del proveedor, tal como lo nombra Cognito.
    if (params.get('identity_provider') !== AUTH_CONFIG.providers[provider]) return false;

    // Nunca un secreto ni el flujo implícito, en ningún punto de la cadena.
    const whole = url.toString();
    if (/client_secret/i.test(whole)) return false;
    if (/response_type=token/i.test(whole)) return false;

    return true;
  };

  // 1) Dominio finito: cada proveedor, con un state/challenge fijos, cumple todas las garantías.
  for (const provider of providerKeys) {
    const input = { provider, state: randomUrlSafe(43), challenge: randomUrlSafe(43) };
    if (!assertAuthorizeUrl(input)) throw new Error(`Falla con el proveedor: ${JSON.stringify(input)}`);
  }

  // 2) Por cada proveedor, ≥100/N iteraciones con state y challenge aleatorios (≥100 en total).
  const runsPerProvider = Math.ceil(100 / providerKeys.length);
  for (const provider of providerKeys) {
    forAll(
      runsPerProvider,
      () => ({ provider, state: randomUrlSafe(randomInt(16, 64)), challenge: randomUrlSafe(randomInt(16, 64)) }),
      (input) => assertAuthorizeUrl(input),
    );
  }

  console.log(`Feature: accounts-auth, Property 3: OK (${providerKeys.length} proveedores, ${runsPerProvider * providerKeys.length} iteraciones aleatorias)`);
} finally {
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. Las rutas `./src/core/auth.js` y `./src/core/auth-config.js` del `import()` dinámico se resuelven contra la URL de la página (`index.html`), no contra este archivo. En el navegador `location` ya existe, así que el stub no se aplica.

### En Node (sin navegador)

El script ya trae el arnés `forAll`, el stub de `location` y usa `await import(...)` de nivel superior (módulo). Desde la carpeta de la app (`exercise/`), copiar el bloque ` ```js ` a la entrada de Node y ejecutarlo así (sin crear archivos temporales):

```sh
node --input-type=module
```

Pegar el contenido del bloque y cerrar con Ctrl-D. El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`.

## Resultado esperado

El script termina sin lanzar error e imprime una línea como:

```
Feature: accounts-auth, Property 3: OK (4 proveedores, 100 iteraciones aleatorias)
```

Un `Error: Falla con el proveedor: ...` o `Error: Falla con: ...` es un contraejemplo: señala una URL de autorización que no cumple alguna garantía (flujo implícito, falta de PKCE, redirect distinta de la permitida, o un secreto en la cadena) y se reporta a `coder` con la entrada que muestra.

## Última ejecución

Prueba redactada y revisada contra `buildAuthorizeUrl` de `src/core/auth.js` sin modificarlo: cada parámetro afirmado (`response_type=code`, `code_challenge_method=S256`, `code_challenge`, `state`, `redirect_uri`, `client_id`, `identity_provider`) corresponde a un `params.set(...)` de la implementación, y las garantías negativas (`client_secret`, `response_type=token`) están ausentes. No se pudo completar la corrida automatizada porque el entorno del taller agotó el tiempo de ejecución de Node; el script queda listo para pegarse en la consola de DevTools (con la app servida) o en `node --input-type=module` desde `exercise/`, donde debe imprimir `Feature: accounts-auth, Property 3: OK (...)`.
