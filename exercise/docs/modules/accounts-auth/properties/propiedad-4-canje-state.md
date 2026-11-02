# Propiedad 4: el canje valida el state y nunca envía secreto

**Feature: accounts-auth, Property 4: El canje valida el state y nunca envía secreto.**

**Validates: Requirements 4.3, 4.5, 5.4, 9.3, 12.2**

## Enunciado

La propiedad cubre dos cosas del flujo de autorización + PKCE de [`src/core/auth.js`](../../../../src/core/auth.js):

1. **Validación del State_Value (bicondicional).** Para cualquier par `(sent, returned)` de valores de state, el redirect se acepta (y solo entonces se canjea el code) **si y solo si** `sent === returned`; cuando difieren, no se establece ninguna Session (req. 4.3, 4.5, 12.2). La comparación es por **igualdad estricta** de cadenas.

2. **`buildTokenRequest` nunca envía secreto y siempre lleva el verifier.** Para cualquier `code` y `verifier`, `buildTokenRequest({ code, verifier })` devuelve `{ url, body }` donde el `body` (un `URLSearchParams`):
   - **NUNCA** contiene `client_secret` (el App Client es público; la seguridad recae en PKCE, req. 9.3, 12.1),
   - **SIEMPRE** contiene `code_verifier` exactamente igual al `verifier` recibido (prueba de posesión PKCE, req. 5.4),
   - lleva `code` exactamente igual al recibido y `grant_type=authorization_code`.

## Qué es puro y exportado, y qué se replica

- La parte 2 se verifica **directamente** sobre `buildTokenRequest`, que `auth.js` **exporta** y que es pura (no toca el DOM ni la red; solo arma `{ url, body }`).
- La parte 1 (comparar el state enviado contra el devuelto) **no es una función pura aislada**: esa validación vive dentro de `handleRedirect`, que ya está implementada en `auth.js` y compara, por igualdad estricta, el `state` de la vuelta (`returnedState`) contra el que se guardó antes del redirect en `sessionStorage` (`sent.state === returnedState`); si no coinciden devuelve `{ error: 'state-mismatch' }` y no abre ninguna Session. Como `handleRedirect` no es pura (lee `sessionStorage` y ejecuta `fetch`), este script no la invoca directamente: **replica** la única regla de esa comparación —la igualdad estricta— en un helper local `stateAccepts(sent, returned)` que actúa como **oráculo de referencia** y verifica el bicondicional sobre pares aleatorios. Ese helper debe coincidir con la comparación real de `handleRedirect`, y el script deja anotada esa correspondencia.

## Nota sobre Node y `location`

`auth-config.js` deriva `redirectUri` de `location.origin`, que no existe en Node, y `auth.js` lo importa. El script define un `location` mínimo y limpio **antes** de importar el módulo (y lo restaura al terminar), de modo que el mismo script corre en la consola del navegador (donde `location` ya existe y el stub no se aplica) y en Node.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta, el stub de `location` y el helper de comparación de state. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 4: El canje valida el state y nunca envía secreto
// Validates: Requirements 4.3, 4.5, 5.4, 9.3, 12.2

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

// --- Helpers de generación ---------------------------------------------------

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Cadena opaca tipo base64url, como un state o un code reales (letras, dígitos, - y _).
const randomToken = (len = randomInt(8, 44)) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

// --- Parte 1: validación del State_Value (bicondicional) ---------------------

// Regla PURA de la validación del state que `handleRedirect` ya aplica en `auth.js`:
// aceptar el redirect y canjear el code si y SOLO si el state devuelto es idéntico al
// enviado. Igualdad estricta de cadenas, sin normalizar. Es la misma comparación que hace
// `handleRedirect` (`sent.state === returnedState`); este helper es su oráculo de referencia.
const stateAccepts = (sent, returned) => sent === returned;

// Oráculo de referencia, escrito aparte de la implementación: el bicondicional esperado.
const expectedAccept = (sent, returned) => sent === returned;

try {
  // Importa el servicio real. La ruta relativa se resuelve contra la URL de la página en el
  // navegador, y contra la carpeta desde la que corre Node (ver "Cómo ejecutarlo").
  const { buildTokenRequest } = await import('./src/core/auth.js');

  // 1a) Casos límite del bicondicional (dominio fijo): el acuerdo exacto acepta; cualquier
  //     diferencia (mayúsculas, espacio, vacío, prefijo) rechaza.
  const edgeCases = [
    ['abc123', 'abc123', true],
    ['abc123', 'abc124', false],
    ['abc123', 'ABC123', false],   // la igualdad es sensible a mayúsculas
    ['abc123', 'abc123 ', false],  // un espacio al final ya no es igual
    ['', '', true],
    ['x', '', false],
    ['', 'x', false],
    ['token', 'tokentoken', false],
  ];
  for (const [sent, returned, shouldAccept] of edgeCases) {
    if (stateAccepts(sent, returned) !== shouldAccept) {
      throw new Error(`State: caso límite falla con sent=${JSON.stringify(sent)} returned=${JSON.stringify(returned)}`);
    }
    if (stateAccepts(sent, returned) !== expectedAccept(sent, returned)) {
      throw new Error(`State: no coincide con el oráculo para ${JSON.stringify([sent, returned])}`);
    }
  }

  // 1b) Pares aleatorios, a veces iguales a veces distintos: el bicondicional se cumple
  //     siempre. Cuando son iguales, acepta; cuando difieren, rechaza (no abre Session).
  forAll(300, () => {
    const sent = randomToken();
    // La mitad de las veces el returned es idéntico al sent; la otra mitad, distinto.
    if (Math.random() < 0.5) return { sent, returned: sent, equal: true };
    let returned = randomToken();
    // Garantiza que de verdad difieran (el azar podría repetir por casualidad).
    while (returned === sent) returned = randomToken();
    return { sent, returned, equal: false };
  }, ({ sent, returned, equal }) => {
    const accepted = stateAccepts(sent, returned);
    // Bicondicional: aceptado exactamente cuando son iguales, y acorde al oráculo.
    return accepted === equal && accepted === expectedAccept(sent, returned);
  });

  // --- Parte 2: buildTokenRequest nunca envía secreto y siempre lleva el verifier ---

  // >=100 iteraciones con code y verifier aleatorios: el body cumple el contrato PKCE.
  forAll(200, () => ({ code: randomToken(), verifier: randomToken() }), ({ code, verifier }) => {
    const { url, body } = buildTokenRequest({ code, verifier });

    // Debe devolver un URLSearchParams para el endpoint de token (form-urlencoded).
    if (!(body instanceof URLSearchParams)) return false;
    if (typeof url !== 'string' || !/\/oauth2\/token$/.test(new URL(url).pathname)) return false;

    // NUNCA un secreto: ni la clave client_secret, ni nada con "secret" en el nombre.
    for (const key of body.keys()) {
      if (/secret/i.test(key)) return false;
    }
    if (body.has('client_secret')) return false;
    // Tampoco debe filtrarse en la URL serializada del body.
    if (/client_secret/i.test(body.toString())) return false;

    // SIEMPRE el verifier PKCE, idéntico al recibido (prueba de posesión).
    if (body.get('code_verifier') !== verifier) return false;
    // El code tal cual llegó, y el grant type del flujo de código de autorización.
    if (body.get('code') !== code) return false;
    if (body.get('grant_type') !== 'authorization_code') return false;

    return true;
  });

  console.log('Feature: accounts-auth, Property 4: OK (state bicondicional + buildTokenRequest sin client_secret y con code_verifier)');
} finally {
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir la app (por ejemplo `npx serve exercise` o, dentro de `exercise/`, `python3 -m http.server 8080`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador `location` ya existe, así que el stub no se aplica. La ruta `./src/core/auth.js` del `import()` se resuelve contra la URL de la página.

### En Node (sin navegador)

El script ya trae el arnés `forAll` y el stub de `location`, y usa `await import(...)` de nivel superior (módulo). Desde la carpeta de la app (`exercise/`) se corre el bloque ` ```js ` con:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`. No se crean archivos temporales.

## Resultado esperado

El script termina sin lanzar error y muestra en consola:

```
Feature: accounts-auth, Property 4: OK (state bicondicional + buildTokenRequest sin client_secret y con code_verifier)
```

Un `Error: Falla con: ...` en la parte del state señala que el bicondicional no se cumplió para un par `(sent, returned)` (se reporta el par). Un `Error: Falla con: ...` en la parte de `buildTokenRequest` señala un body que incluyó algo con aspecto de secreto, o que no llevó el `code_verifier`, el `code` o el `grant_type` esperados; se reporta a `coder` con el `{ code, verifier }` que falló.
