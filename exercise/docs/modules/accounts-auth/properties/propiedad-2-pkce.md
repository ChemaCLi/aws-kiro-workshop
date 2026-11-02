# Propiedad 2: el desafío PKCE deriva del verificador y es verificable

**Feature: accounts-auth, Property 2: El desafío PKCE deriva del verificador y es verificable.**

**Validates: Requirements 4.4, 12.1**

## Enunciado

Para la función `pkceChallenge(verifier)` de [`src/core/auth.js`](../../../../src/core/auth.js), que deriva el desafío PKCE como `base64url(SHA-256(verifier))` con el método `S256`:

Con ≥100 verificadores aleatorios (cadenas de longitud y contenido variados, con el mismo alfabeto que produce un verifier real), se cumple para cada uno:

1. **Determinista.** El mismo `verifier` siempre produce el mismo `challenge`: dos llamadas con el mismo verificador dan cadenas idénticas.
2. **Formato base64url sin relleno.** El `challenge` es una cadena no vacía compuesta solo por `[A-Za-z0-9-_]`: nunca lleva `=`, ni `+`, ni `/`. Además, como es `base64url(SHA-256(...))` de 32 bytes, mide exactamente 43 caracteres.
3. **Verificable.** Recomputar el desafío por un camino independiente (SHA-256 del verificador con `crypto.subtle.digest` y codificar a base64url con una implementación propia dentro del script) da exactamente el mismo `challenge`. Así quien canjea el `code` puede probar posesión del verifier.

El script complementa con el verificador canónico de la RFC 7636 (`verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"` → `challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"`) como caso fijo conocido, para anclar que la derivación es la estándar y no solo "consistente consigo misma".

## Nota sobre `crypto.subtle` (navegador y Node)

`pkceChallenge` usa `crypto.subtle.digest`, que solo existe en contextos seguros. En el navegador está disponible en `https://` y en `http://localhost`; si se sirve la app por IP de LAN sin HTTPS, `crypto.subtle` es `undefined` y `pkceChallenge` degrada devolviendo `null` (la propiedad no aplica: el flujo social se marca como no disponible). En Node 20+ existe como `globalThis.crypto.subtle`, así que el script corre tal cual. El script comprueba primero que `crypto.subtle` esté disponible; si no lo está, se detiene con un aviso claro en vez de dar un falso fallo.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta y una reimplementación independiente de la verificación. Pegarlo en la consola de DevTools con la app abierta (en `https://` o `http://localhost`), o correrlo en Node 20+ (ver más abajo).

```js
// Feature: accounts-auth, Property 2: El desafío PKCE deriva del verificador y es verificable
// Validates: Requirements 4.4, 12.1

// Arnés mínimo: corre `check` con `runs` entradas aleatorias y falla con la primera que no cumpla.
// `check` puede ser async (pkceChallenge lo es): se espera cada resultado.
const forAll = async (runs, generate, check) => {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!(await check(input))) throw new Error(`Falla con: ${JSON.stringify(input)}`);
  }
};

// `crypto.subtle` solo existe en contexto seguro (HTTPS o localhost) y en Node 20+.
// Sin él, pkceChallenge degrada a null y la propiedad no aplica: se avisa y se detiene.
if (!globalThis.crypto?.subtle) {
  throw new Error('crypto.subtle no está disponible: sirve la app por HTTPS o localhost, o usa Node 20+. La propiedad no aplica en este entorno.');
}

const { pkceChallenge } = await import('./src/core/auth.js');

// --- Verificación independiente ---------------------------------------------
// Reimplementación propia de base64url(SHA-256(verifier)), por un camino distinto al de
// auth.js, para comparar contra su salida. Si ambas coinciden, el desafío es verificable.

// Codifica bytes en base64url: base64 estándar, sin relleno `=`, con `-` y `_`.
const toBase64Url = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Recomputa el desafío esperado desde cero: SHA-256 del verifier, luego base64url.
const expectedChallenge = async (verifier) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toBase64Url(new Uint8Array(digest));
};

// --- Generador de verificadores --------------------------------------------
// Un verifier PKCE real es una cadena de 43 a 128 caracteres del alfabeto "unreserved"
// de la RFC 7636. Se generan longitudes y contenidos variados para cubrir el espacio.
const VERIFIER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const randomVerifier = () => {
  const length = randomInt(43, 128);
  let out = '';
  for (let i = 0; i < length; i++) out += VERIFIER_ALPHABET[Math.floor(Math.random() * VERIFIER_ALPHABET.length)];
  return out;
};

// Formato base64url sin relleno: solo [A-Za-z0-9-_], nunca `=`, `+` ni `/`.
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

// Un challenge cumple la propiedad si: no es null, es base64url válido de 43 chars,
// es determinista (dos llamadas iguales) y coincide con la recomputación independiente.
const challengeHoldsFor = async (verifier) => {
  const challenge = await pkceChallenge(verifier);
  if (typeof challenge !== 'string' || challenge.length === 0) return false; // en contexto seguro nunca es null
  if (!BASE64URL_RE.test(challenge)) return false;        // 2) formato base64url sin padding
  if (challenge.length !== 43) return false;              // base64url de 32 bytes (SHA-256) = 43 chars
  const again = await pkceChallenge(verifier);
  if (again !== challenge) return false;                  // 1) determinista
  const recomputed = await expectedChallenge(verifier);
  return recomputed === challenge;                        // 3) verificable por camino independiente
};

// 1) Caso canónico conocido de la RFC 7636 (ancla que la derivación es la estándar).
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const canonical = await pkceChallenge(RFC_VERIFIER);
if (canonical !== RFC_CHALLENGE) {
  throw new Error(`Caso canónico RFC 7636 falla: se esperaba ${RFC_CHALLENGE} y se obtuvo ${canonical}`);
}

// 2) ≥100 verificadores aleatorios: la propiedad se cumple para cada uno.
await forAll(120, randomVerifier, challengeHoldsFor);

console.log('Feature: accounts-auth, Property 2: OK (caso canónico RFC 7636 + 120 verificadores aleatorios)');
```

## Cómo ejecutarlo

### En el navegador

1. Servir la app con un servidor estático y abrirla en un contexto seguro: `http://localhost:8080` (o `https://`). Por IP de LAN sin HTTPS no hay `crypto.subtle` y el script se detiene con un aviso, porque la propiedad no aplica ahí.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. La ruta `./src/core/auth.js` del `import()` dinámico se resuelve contra la URL de la página (`app.html`), no contra este archivo.

### En Node (sin navegador)

El script usa `await import(...)` de nivel superior (módulo) y Node 20+ ya trae `globalThis.crypto.subtle`. Desde la carpeta de la app (`exercise/`), ejecutar:

```sh
node --input-type=module
```

y pegar el contenido del bloque ` ```js `, cerrando con Ctrl-D. El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`.

## Resultado esperado

El script termina sin lanzar error y muestra en consola:

```
Feature: accounts-auth, Property 2: OK (caso canónico RFC 7636 + 120 verificadores aleatorios)
```

Un `Error: Caso canónico RFC 7636 falla: ...` indica que la derivación no es la estándar (revisar `base64url` o el `digest` en `auth.js`). Un `Error: Falla con: "<verifier>"` es un contraejemplo de la parte aleatoria (determinismo, formato o verificabilidad) y se reporta a `coder` con el verificador que muestra. Un `Error: crypto.subtle no está disponible...` significa que el entorno no es seguro: no es un fallo de la propiedad, solo que no se puede comprobar ahí.

## Última ejecución

Pendiente de ejecutar. El entorno de este repositorio cuelga al hacer `spawn` de Node desde el shell (timeout), por lo que el script queda escrito y revisado contra `pkceChallenge` de `src/core/auth.js` (que codifica `base64url(SHA-256(verifier))` sin relleno con `-`/`_`), sin ejecutarse aquí. Se corre pegándolo en la consola de DevTools con la app servida en `http://localhost` o en Node 20+ con `node --input-type=module`.
