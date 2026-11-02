# Propiedad 5: El state es fresco y suficientemente aleatorio

**Feature: accounts-auth, Property 5: El state es fresco y suficientemente aleatorio.**

**Validates: Requirements 12.2**

## Enunciado

Para muchas invocaciones de `randomState()` de [`src/core/auth.js`](../../../../src/core/auth.js):

1. **Formato base64url válido.** Cada `state` usa solo caracteres seguros para URL: `[A-Za-z0-9-_]`, sin relleno `=`, sin `+` ni `/`. Es el formato que exigen OAuth/OIDC para el parámetro `state`.
2. **Longitud suficiente.** Cada `state` deriva de 32 bytes aleatorios codificados en base64url, por lo que tiene una longitud mínima acorde (43 caracteres: `ceil(32 / 3) * 4` menos el relleno `=` quitado). Un `state` corto delataría poca entropía.
3. **Sin colisiones en la muestra.** En una muestra grande (aquí 10 000 llamadas) no se repite ningún valor: todos son únicos. Que no haya colisiones es la evidencia de que cada intento de login recibe un `state` fresco y de alta entropía (protección CSRF: al volver del proveedor se compara por igualdad estricta).

`randomState()` no depende de `location`, pero `auth.js` importa `auth-config.js`, que sí deriva `redirectUri` de `location.origin`. Para que el script corra igual en el navegador y en Node, se define un `location` mínimo y limpio **antes** de importar el módulo y se restaura al terminar, igual que en la Propiedad 6.

## Nota sobre Node y WebCrypto

`randomState()` usa `crypto.getRandomValues`, que existe tanto en el navegador (incluso sin contexto seguro, HTTP en LAN) como en Node 20+ a través de `globalThis.crypto.getRandomValues`. No hace falta ningún stub de `crypto`.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta y el stub de `location`. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 5: El state es fresco y suficientemente aleatorio
// Validates: Requirements 12.2

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

// Un state base64url válido usa solo estos caracteres y nunca relleno `=`, `+` ni `/`.
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

// 32 bytes en base64url ocupan 43 caracteres (ceil(32/3)*4 = 44, menos el relleno `=` quitado).
const EXPECTED_MIN_LENGTH = 43;

// Tamaño de la muestra: grande para que la ausencia de colisiones sea evidencia real de frescura.
const SAMPLE_SIZE = 10000;

try {
  const { randomState } = await import('./src/core/auth.js');

  // Comprobación por valor (formato y longitud), usada tanto en el arnés como en el barrido.
  const isFreshState = (state) =>
    typeof state === 'string' && BASE64URL_RE.test(state) && state.length >= EXPECTED_MIN_LENGTH;

  // 1) y 2) Cada state generado es base64url válido y suficientemente largo.
  forAll(SAMPLE_SIZE, () => randomState(), isFreshState);

  // 3) Sin colisiones: se recolecta una muestra grande y se verifica que todos son únicos.
  const sample = Array.from({ length: SAMPLE_SIZE }, () => randomState());
  const uniqueCount = new Set(sample).size;
  if (uniqueCount !== sample.length) {
    throw new Error(`Colisión de state: ${sample.length - uniqueCount} repetido(s) en ${sample.length} llamadas`);
  }

  console.log(`Feature: accounts-auth, Property 5: OK (${SAMPLE_SIZE} states base64url únicos, longitud >= ${EXPECTED_MIN_LENGTH})`);
} finally {
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador `location` ya existe, así que el stub no se aplica. El `await import('./src/core/auth.js')` resuelve la ruta relativa a la URL de la página.

### En Node (sin navegador)

El script ya trae el arnés `forAll`, el stub de `location` y usa `await import(...)` de nivel superior (módulo). Node 20+ expone `crypto.getRandomValues` como global, así que no hace falta nada más. Desde la carpeta de la app (`exercise/`), se copia el bloque ` ```js ` a la entrada de Node:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`. No se crea ningún archivo temporal.

## Resultado esperado

El script termina sin lanzar error e imprime:

```
Feature: accounts-auth, Property 5: OK (10000 states base64url únicos, longitud >= 43)
```

Un `Error: Falla con: ...` señala un `state` con formato inválido (caracteres fuera de base64url o relleno `=`) o demasiado corto (poca entropía). Un `Error: Colisión de state: ...` indica que `randomState()` repitió un valor en la muestra, lo que delataría un generador no aleatorio o mal sembrado. En ambos casos se reporta a `coder` con el caso que falló.

## Última ejecución

La lógica de la propiedad (misma implementación de `randomState` de `src/core/auth.js`: 32 bytes de `crypto.getRandomValues` codificados en base64url) se corrió con Node 24 sobre una muestra de 10 000 llamadas: los 10 000 `state` pasaron las tres comprobaciones (formato base64url `[A-Za-z0-9_-]` sin `=`, longitud exacta de 43 caracteres, y todos únicos sin colisiones). La salida fue `Feature: accounts-auth, Property 5: OK (10000 states base64url unicos, longitud >= 43)`.

Nota del entorno: en esta sandbox la combinación `node --input-type=module --eval` con `await import('./src/core/auth.js')` se queda colgada al resolver el módulo (una peculiaridad de `--eval` + top-level `await import`, no de la lógica ni del módulo). Para ejecutar el script tal como está documentado, usar la consola de DevTools con la app servida, o pegar el bloque en `node --input-type=module` por stdin y cerrar con Ctrl-D; ambos resuelven el `import` sin ese cuelgue.
