# Propiedad 9: Guardar y cargar la sesión es un round-trip

**Feature: accounts-auth, Property 9: Guardar y cargar la sesión es un round-trip.**

**Validates: Requirements 9.4**

## Enunciado

Para muchas sesiones válidas aleatorias (aquí ≥ 100), `saveSession(s)` seguido de `loadSession()` de [`src/core/auth.js`](../../../../src/core/auth.js) devuelve una sesión equivalente a `s`: mismos tokens, mismas expiraciones, mismo correo y misma Display_Name.

Una sesión es **válida** (utilizable) cuando ni el access token ni el refresh token han expirado, es decir `accessExpiresAt` y `refreshExpiresAt` están en el futuro respecto a `Date.now()`. En ese caso `sessionAction` devuelve `'ok'` o `'refresh'`, nunca `'sign-in'`, así que `loadSession()` no la descarta. (El caso en que ambos expiran y `loadSession()` devuelve `null` lo documenta la Propiedad 10 sobre `sessionAction`; aquí se fija solo el round-trip de ida y vuelta.)

Casos que cubre:

1. **Round-trip exacto.** Para cada sesión válida generada, `saveSession(s)` seguido de `loadSession()` devuelve un objeto con exactamente los mismos campos y valores que `s` (comparación por JSON serializado). Lo que entra es lo que vuelve.
2. **No interferencia con el jardín.** La clave `jardin-movil:v1` (tareas, rondas y ajustes) NO cambia tras todas las operaciones de sesión: `saveSession`/`loadSession` solo tocan su clave dedicada `focus-garden:auth:v1`. Lo fija también la Propiedad 8; aquí se comprueba como invariante de la muestra.

`saveSession`/`loadSession` escriben y leen la clave `focus-garden:auth:v1` de `localStorage`. El script guarda el valor original de esa clave y de `jardin-movil:v1` **antes** de empezar y los restaura en un `finally`, igual que la Propiedad 3 de Ajustes, para no dejar datos de prueba ni alterar la app.

`auth.js` importa `auth-config.js`, que deriva `redirectUri` de `location.origin`. Para que el script corra igual en el navegador y en Node se define un `location` mínimo y limpio **antes** de importar el módulo y se restaura al terminar, igual que en la Propiedad 5.

## Nota sobre Node y `localStorage`

En el navegador `localStorage` ya existe. En Node no, así que el script define un stub mínimo y limpio (un objeto con `getItem`/`setItem`/`removeItem` sobre un `Map`) **antes** de importar el módulo, y lo restaura al terminar. El stub se instala solo si `localStorage` falta, para no pisar el del navegador.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta y los stubs de `location` y `localStorage`. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 9: Guardar y cargar la sesión es un round-trip
// Validates: Requirements 9.4

// Arnés mínimo: corre `check` con `runs` entradas aleatorias y falla con la primera que no cumpla.
const forAll = (runs, generate, check) => {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
  }
};

// En Node no hay `location`; se define un stub limpio solo si falta y se restaura al terminar.
const needsLocationStub = typeof location === 'undefined';
if (needsLocationStub) {
  globalThis.location = { origin: 'https://focus-garden.example' };
}

// En Node no hay `localStorage`; se define un stub mínimo sobre un Map solo si falta.
const needsStorageStub = typeof localStorage === 'undefined';
if (needsStorageStub) {
  const backing = new Map();
  globalThis.localStorage = {
    getItem: (key) => (backing.has(key) ? backing.get(key) : null),
    setItem: (key, value) => void backing.set(key, String(value)),
    removeItem: (key) => void backing.delete(key),
  };
}

// Claves reales: la sesión vive aparte del jardín, nunca deben pisarse entre sí.
const SESSION_KEY = 'focus-garden:auth:v1';
const GARDEN_KEY = 'jardin-movil:v1';

// Cuántas sesiones válidas aleatorias se prueban (el enunciado pide al menos 100).
const SAMPLE_SIZE = 200;

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const randomToken = (prefix) => `${prefix}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Genera una sesión VÁLIDA: ambas expiraciones en el futuro respecto a now, para que
// sessionAction sea 'ok' o 'refresh' y loadSession no la descarte. displayName puede
// faltar (string vacío) para cubrir tanto la cuenta con nombre como la que debe pedirlo.
const makeValidSession = () => {
  const now = Date.now();
  // El refresh dura más que el access, como en Cognito; ambos en el futuro.
  const accessExpiresAt = now + randomInt(1, 3600) * 1000;
  const refreshExpiresAt = now + randomInt(3600, 30 * 24 * 3600) * 1000;
  return {
    accessToken: randomToken('access'),
    idToken: randomToken('id'),
    refreshToken: randomToken('refresh'),
    accessExpiresAt,
    refreshExpiresAt,
    email: `${randomToken('user')}@focus-garden.example`,
    displayName: pick(['', 'Ana', 'Benito', 'Chavela', 'Diego']),
  };
};

// Un dato de jardín arbitrario para comprobar que las operaciones de sesión no lo tocan.
const gardenFixture = JSON.stringify({ v: 1, tasks: [{ id: 't1' }], rounds: [] });

// Se guardan los valores originales de AMBAS claves y se restauran siempre al final.
const originalSession = localStorage.getItem(SESSION_KEY);
const originalGarden = localStorage.getItem(GARDEN_KEY);

try {
  const { saveSession, loadSession } = await import('./src/core/auth.js');

  // Sembramos el jardín con un valor conocido para medir no interferencia de verdad.
  localStorage.setItem(GARDEN_KEY, gardenFixture);

  // 1) Round-trip: lo que se guarda es lo que vuelve, campo por campo.
  const isRoundTrip = (session) => {
    saveSession(session);
    const loaded = loadSession();
    if (loaded === null) return false; // una sesión válida nunca debe descartarse
    return JSON.stringify(loaded) === JSON.stringify(session);
  };
  forAll(SAMPLE_SIZE, makeValidSession, isRoundTrip);

  // 2) No interferencia: tras todas las operaciones, el jardín sigue byte a byte igual.
  if (localStorage.getItem(GARDEN_KEY) !== gardenFixture) {
    throw new Error('saveSession/loadSession alteraron jardin-movil:v1: no hay separación de claves');
  }

  console.log(`Feature: accounts-auth, Property 9: OK (${SAMPLE_SIZE} sesiones con round-trip exacto; jardin-movil:v1 intacto)`);
} finally {
  // Restaurar AMBAS claves a su valor original (o borrarlas si no existían antes).
  if (originalSession === null) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, originalSession);
  if (originalGarden === null) localStorage.removeItem(GARDEN_KEY);
  else localStorage.setItem(GARDEN_KEY, originalGarden);

  // Retirar los stubs instalados por este script para no filtrarlos al entorno.
  if (needsStorageStub) delete globalThis.localStorage;
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador `location` y `localStorage` ya existen, así que los stubs no se aplican; el script guarda y restaura el valor real de ambas claves. El `await import('./src/core/auth.js')` resuelve la ruta relativa a la URL de la página.

### En Node (sin navegador)

El script ya trae el arnés `forAll`, los stubs de `location` y `localStorage` y usa `await import(...)` de nivel superior (módulo). Desde la carpeta de la app (`exercise/`), se copia el bloque ` ```js ` a la entrada de Node:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`. No se crea ningún archivo temporal.

## Resultado esperado

El script termina sin lanzar error e imprime:

```
Feature: accounts-auth, Property 9: OK (200 sesiones con round-trip exacto; jardin-movil:v1 intacto)
```

Un `Error: Falla con: ...` señala una sesión válida que no sobrevivió el round-trip (campos distintos tras `saveSession`/`loadSession`, o `loadSession()` devolvió `null` pese a ser válida) y se reporta a `coder` con el caso. Un `Error: saveSession/loadSession alteraron jardin-movil:v1 ...` indica que la sesión invadió la clave del jardín (fallaría también la Propiedad 8). En ambos casos, al terminar la app sigue con sus datos originales porque el `finally` restaura las dos claves.

## Última ejecución

Pendiente de correr en este entorno. El script está completo y listo para ejecutarse en la consola de DevTools con la app servida, o en Node 20+ por stdin (`node --input-type=module`, pegar el bloque y cerrar con Ctrl-D) desde la carpeta `exercise/`.

Nota del entorno: igual que en la Propiedad 5, en esta sandbox la combinación `node --input-type=module --eval` con `await import('./src/core/auth.js')` se cuelga al resolver el módulo (peculiaridad de `--eval` + top-level `await import`, no de la lógica). Usar la consola de DevTools o `node --input-type=module` por stdin, que resuelven el `import` sin ese cuelgue.
