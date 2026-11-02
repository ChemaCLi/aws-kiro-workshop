# Propiedad 7: El destino tras iniciar sesión depende solo de la Display_Name

**Feature: accounts-auth, Property 7: El destino tras iniciar sesión depende solo de la Display_Name.**

**Validates: Requirements 3.5, 4.7, 6.1, 6.5**

## Enunciado

Para cualquier sesión recién abierta, `postSignInRoute(session)` de [`src/core/auth.js`](../../../../src/core/auth.js) decide a dónde llevar al usuario **solo** a partir de la Display_Name (`session.displayName`), ignorando por completo los demás campos (`email`, tokens, expiraciones, etc.). La propiedad afirma el bicondicional:

1. **`'tasks'` si y solo si hay Display_Name.** `postSignInRoute(session) === 'tasks'` exactamente cuando `session.displayName` es un valor presente (una cadena no vacía). En cualquier otro caso el destino es `'name-prompt'`.
2. **Falta de Display_Name.** Cuando `displayName` es `undefined`, `null` o la cadena vacía `''`, el valor es "falsy" y el destino es `'name-prompt'`: hay que pedir el nombre con el Name_Prompt antes de entrar.
3. **Dependencia única.** Dos sesiones con la misma Display_Name (presente o ausente) producen el mismo destino aunque todos sus demás campos difieran. Variar `email`, `accessToken`, `refreshToken` o las expiraciones nunca cambia la ruta: solo `displayName` manda.

El código decide con `Boolean(session && session.displayName)`, **sin recortar espacios**. Por eso una Display_Name formada solo por espacios (`' '`) es un valor presente ("truthy") y lleva a `'tasks'`; este es un caso límite explícito del barrido. La ausencia de sesión (`null`/`undefined`) se trata como sin Display_Name y lleva a `'name-prompt'`.

`postSignInRoute` es pura y no depende de `location`, pero `auth.js` importa `auth-config.js`, que deriva `redirectUri` de `location.origin`. Para que el script corra igual en el navegador y en Node, se define un `location` mínimo y limpio **antes** de importar el módulo y se restaura al terminar, igual que en la Propiedad 5.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta y el stub de `location`. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 7: El destino tras iniciar sesión depende solo de la Display_Name
// Validates: Requirements 3.5, 4.7, 6.1, 6.5

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

// Iteraciones aleatorias: muy por encima del mínimo de 100 pedido para la propiedad.
const RANDOM_RUNS = 500;

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const randomBoolean = () => Math.random() < 0.5;

// Una Display_Name presente ("truthy") es cualquier cadena no vacía; el código NO recorta
// espacios, así que ' ' cuenta como presente. Estos son los valores de displayName que se
// combinan con campos irrelevantes para demostrar que el destino depende solo de este campo.
const PRESENT_NAMES = ['Ana', 'José', '  nombre con espacios  ', ' ', 'x', 'María Fernanda', '🌱'];
// Ausencia de Display_Name: los tres valores "falsy" que caen a 'name-prompt'.
const ABSENT_NAMES = [undefined, null, ''];

// Campos irrelevantes para la ruta: se varían a propósito para probar que no influyen.
const buildNoise = () => ({
  email: pick(['a@b.com', 'user@example.org', '', undefined]),
  accessToken: pick(['tok-abc', 'tok-xyz', '', undefined]),
  refreshToken: pick(['ref-123', 'ref-456', '', undefined]),
  accessExpiresAt: pick([0, Date.now(), Date.now() + 3600_000]),
  refreshExpiresAt: pick([0, Date.now() + 86_400_000]),
});

try {
  const { postSignInRoute } = await import('./src/core/auth.js');

  // El contrato esperado: 'tasks' si y solo si hay una Display_Name presente, 'name-prompt' si no.
  const expectedRoute = (session) =>
    Boolean(session && session.displayName) ? 'tasks' : 'name-prompt';

  // Para una sesión dada, el destino coincide con el contrato Y es uno de los dos valores válidos.
  const routeMatches = (session) => {
    const route = postSignInRoute(session);
    if (route !== 'name-prompt' && route !== 'tasks') return false;
    return route === expectedRoute(session);
  };

  // Genera una sesión aleatoria con o sin Display_Name, siempre con campos irrelevantes variando.
  const generate = () => {
    const present = randomBoolean();
    const displayName = present ? pick(PRESENT_NAMES) : pick(ABSENT_NAMES);
    return { displayName, ...buildNoise() };
  };

  // Caso límite de la sesión vacía/ausente: null y undefined también llevan a 'name-prompt'.
  const check = (session) => {
    if (!routeMatches(session)) return false;

    // Dependencia única: cambiar los campos irrelevantes, dejando la misma Display_Name, no
    // cambia el destino. Se compara contra otra sesión con el mismo displayName y distinto ruido.
    const twin = { displayName: session.displayName, ...buildNoise() };
    return postSignInRoute(twin) === postSignInRoute(session);
  };

  // 1) Dominio dirigido: cada combinación de nombre (presente/ausente) con y sin ruido, y las
  //    sesiones nula/indefinida, para fijar los casos límite antes del azar.
  for (const displayName of [...PRESENT_NAMES, ...ABSENT_NAMES]) {
    if (!check({ displayName })) throw new Error(`Falla con: ${JSON.stringify({ displayName })}`);
    if (!check({ displayName, ...buildNoise() })) throw new Error(`Falla con displayName=${JSON.stringify(displayName)} + ruido`);
  }
  if (postSignInRoute(null) !== 'name-prompt') throw new Error('postSignInRoute(null) debería ser name-prompt');
  if (postSignInRoute(undefined) !== 'name-prompt') throw new Error('postSignInRoute(undefined) debería ser name-prompt');

  // 2) Variaciones aleatorias: >= 100 iteraciones (aquí 500) de sesiones con y sin Display_Name.
  forAll(RANDOM_RUNS, generate, check);

  console.log(`Feature: accounts-auth, Property 7: OK (casos límite + ${RANDOM_RUNS} sesiones aleatorias; ruta depende solo de displayName)`);
} finally {
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador `location` ya existe, así que el stub no se aplica. El `await import('./src/core/auth.js')` resuelve la ruta relativa a la URL de la página.

### En Node (sin navegador)

El script ya trae el arnés `forAll`, el stub de `location` y usa `await import(...)` de nivel superior (módulo). `postSignInRoute` es pura y no necesita ningún otro stub. Desde la carpeta de la app (`exercise/`), se copia el bloque ` ```js ` a la entrada de Node:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`. No se crea ningún archivo temporal.

## Resultado esperado

El script termina sin lanzar error e imprime:

```
Feature: accounts-auth, Property 7: OK (casos límite + 500 sesiones aleatorias; ruta depende solo de displayName)
```

Un `Error: Falla con: ...` señala una sesión cuya ruta no cumple el bicondicional (por ejemplo, llevar a `'tasks'` sin Display_Name, o a `'name-prompt'` teniéndola) o un caso en que variar los campos irrelevantes cambió el destino, lo que rompería la "dependencia única". En cualquier caso se reporta a `coder` con el caso que falló.

## Última ejecución

El script se corrió con Node 24 pasando el bloque ` ```js ` por stdin (`node --input-type=module`, cerrando con Ctrl-D), que resuelve `await import('./src/core/auth.js')` sin el cuelgue conocido de `--eval` + top-level `await import`. Importó `postSignInRoute` del `auth.js` real y pasó los casos límite dirigidos (nombres presentes, incluidos `' '` solo-espacios y `'🌱'`; ausentes `undefined`, `null`, `''`; sesiones `null`/`undefined`) más 500 sesiones aleatorias combinando Display_Name presente/ausente con `email`, tokens y expiraciones variables. La salida fue `Feature: accounts-auth, Property 7: OK (casos limite + 500 sesiones aleatorias; ruta depende solo de displayName)`, confirmando el bicondicional y que la ruta depende solo de `displayName`.

Nota del entorno: igual que en la Propiedad 5, en esta sandbox `node --input-type=module --eval` con `await import('./src/core/auth.js')` se queda colgado al resolver el módulo (peculiaridad de `--eval` + top-level `await import`, no de la lógica). Para ejecutarlo tal como se documenta, usar la consola de DevTools con la app servida, o pegar el bloque en `node --input-type=module` por stdin y cerrar con Ctrl-D.
