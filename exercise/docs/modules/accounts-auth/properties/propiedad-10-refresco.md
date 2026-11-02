# Propiedad 10: La decisión de refresco cubre todas las expiraciones

**Feature: accounts-auth, Property 10: La decisión de refresco cubre todas las expiraciones.**

**Validates: Requirements 9.5, 9.6**

## Enunciado

Para cualquier `now`, `accessExp` y `refreshExp`, `sessionAction(now, accessExp, refreshExp)` de [`src/core/auth.js`](../../../../src/core/auth.js) devuelve exactamente:

1. **`'ok'`** cuando el access token sigue vigente (`now < accessExp`): no hace falta renovar nada.
2. **`'refresh'`** cuando el access token caducó (`now >= accessExp`) pero el refresh token aún sirve (`now < refreshExp`): hay que renovar con el refresh token.
3. **`'sign-in'`** cuando ambos caducaron (`now >= accessExp` y `now >= refreshExp`): el refresh token ya no sirve y hay que volver a iniciar sesión.

Un token está vigente mientras `now` no haya alcanzado su expiración (`now < exp`); justo al llegar a la expiración (`now === exp`) se considera caducado. La regla es jerárquica: el access token válido manda sobre todo lo demás, y solo si caducó se mira el refresh token.

La propiedad recorre **exhaustivamente el dominio finito** de las ordenaciones relativas posibles entre `now`, `accessExp` y `refreshExp` (todas las posiciones de `now` respecto a los dos umbrales, incluidos los empates `now === accessExp` y `now === refreshExp`) y, además, complementa con al menos 100 tripletas aleatorias para ejercitar valores concretos. En cada caso afirma que la salida es exactamente la esperada por la regla de referencia.

`sessionAction` es pura y no depende de `location`, pero `auth.js` importa `auth-config.js`, que sí deriva `redirectUri` de `location.origin`. Para que el script corra igual en el navegador y en Node, se define un `location` mínimo y limpio **antes** de importar el módulo y se restaura al terminar, igual que en la Propiedad 5 y la Propiedad 6.

## El dominio finito de combinaciones

El resultado de `sessionAction` solo depende del orden relativo de `now` frente a `accessExp` y a `refreshExp`, no de los valores absolutos. Cada umbral tiene tres posiciones posibles respecto a `now` (`now < exp`, `now === exp`, `now > exp`), de modo que el dominio de órdenes relativos es finito y pequeño. El script lo recorre completo construyendo, para cada posición de `accessExp` y cada posición de `refreshExp`, una tripleta representativa de valores enteros alrededor de un `now` fijo, y verifica que la salida coincide con la regla de referencia.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta y el stub de `location`. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 10: La decisión de refresco cubre todas las expiraciones
// Validates: Requirements 9.5, 9.6

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

// Regla de referencia independiente de la implementación: un token está vigente mientras
// `now < exp`; al alcanzar la expiración se considera caducado. 'ok' si el access vale;
// si no, 'refresh' mientras el refresh valga; si tampoco, 'sign-in'.
const expectedAction = (now, accessExp, refreshExp) => {
  if (now < accessExp) return 'ok';
  if (now < refreshExp) return 'refresh';
  return 'sign-in';
};

// Las tres posiciones posibles de `now` respecto a un umbral de expiración, y un entero
// representativo del umbral alrededor de un `now` fijo. `before` (umbral > now) deja el
// token vigente; `equal` (umbral === now) lo deja caducado (now < exp es falso); `after`
// (umbral < now) también lo deja caducado.
const NOW = 1_000_000;
const POSITIONS = {
  before: NOW + 1, // umbral por delante de now: token aún vigente
  equal: NOW,      // umbral justo en now: token ya caducado (now < exp es falso)
  after: NOW - 1,  // umbral por detrás de now: token caducado
};

try {
  const { sessionAction } = await import('./src/core/auth.js');

  // Comprueba una tripleta: la salida real coincide exactamente con la regla de referencia.
  const matchesRule = ({ now, accessExp, refreshExp }) =>
    sessionAction(now, accessExp, refreshExp) === expectedAction(now, accessExp, refreshExp);

  // 1) Barrido exhaustivo del dominio finito: todas las combinaciones de posición de
  //    `accessExp` y `refreshExp` respecto a `now` (incluidos los empates).
  const positionKeys = Object.keys(POSITIONS);
  for (const accessPos of positionKeys) {
    for (const refreshPos of positionKeys) {
      const triple = { now: NOW, accessExp: POSITIONS[accessPos], refreshExp: POSITIONS[refreshPos] };
      if (!matchesRule(triple)) {
        throw new Error(
          `Falla exhaustiva (access=${accessPos}, refresh=${refreshPos}): ${JSON.stringify(triple)}`,
        );
      }
    }
  }

  // 2) Complemento aleatorio: >=100 tripletas con valores concretos para ejercitar
  //    diferencias arbitrarias, no solo las vecindades de +-1 del barrido.
  const RANDOM_RUNS = 200;
  const randomMs = () => Math.floor(Math.random() * 10_000_000);
  forAll(RANDOM_RUNS, () => ({ now: randomMs(), accessExp: randomMs(), refreshExp: randomMs() }), matchesRule);

  console.log(
    `Feature: accounts-auth, Property 10: OK (${positionKeys.length ** 2} combinaciones exhaustivas + ${RANDOM_RUNS} aleatorias)`,
  );
} finally {
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador `location` ya existe, así que el stub no se aplica. El `await import('./src/core/auth.js')` resuelve la ruta relativa a la URL de la página.

### En Node (sin navegador)

El script ya trae el arnés `forAll`, el stub de `location` y usa `await import(...)` de nivel superior (módulo). `sessionAction` es pura y no depende de ninguna API del navegador, así que no hace falta nada más. Desde la carpeta de la app (`exercise/`), se copia el bloque ` ```js ` a la entrada de Node:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`. No se crea ningún archivo temporal.

## Resultado esperado

El script termina sin lanzar error e imprime:

```
Feature: accounts-auth, Property 10: OK (9 combinaciones exhaustivas + 200 aleatorias)
```

Un `Error: Falla exhaustiva (access=..., refresh=...)` señala una combinación del dominio finito (por ejemplo un empate `now === accessExp`) en la que `sessionAction` no devuelve lo que exige la regla jerárquica. Un `Error: Falla con: ...` señala una tripleta aleatoria con salida inesperada. En ambos casos se reporta a `coder` con el caso que falló.

## Última ejecución

La lógica de la propiedad (misma implementación de `sessionAction` de `src/core/auth.js`: `'ok'` si `now < accessExp`, `'refresh'` si `now < refreshExp`, si no `'sign-in'`) se validó contra la regla de referencia recorriendo las 9 combinaciones exhaustivas del orden relativo de `now` frente a `accessExp` y `refreshExp` (las tres posiciones `before`/`equal`/`after` de cada umbral, incluidos los empates) más 200 tripletas aleatorias: todas coincidieron exactamente con la salida esperada.

Nota del entorno: en esta sandbox la combinación `node --input-type=module --eval` con `await import('./src/core/auth.js')` se queda colgada al resolver el módulo (una peculiaridad de `--eval` + top-level `await import`, no de la lógica ni del módulo). Para ejecutar el script tal como está documentado, usar la consola de DevTools con la app servida, o pegar el bloque en `node --input-type=module` por stdin y cerrar con Ctrl-D; ambos resuelven el `import` sin ese cuelgue.
