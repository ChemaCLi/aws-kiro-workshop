# Propiedad 1: La ruta de cuenta se decide solo por el hash

**Feature: accounts-auth, Property 1: La ruta de cuenta se decide solo por el hash.**

**Validates: Requirements 1.1**

## Enunciado

Para cualquier cadena de hash, `routeFromHash(hash)` de [`src/components/app-shell.js`](../../../../src/components/app-shell.js) decide la ruta **solo** a partir del hash recibido como argumento, sin leer `location` ni ningún estado global. El valor de retorno es siempre `{ kind: 'route', id: 'account' }` o `{ kind: 'tab', id }`. La propiedad afirma:

1. **Cuenta si y solo si el hash normaliza a `cuenta`.** `routeFromHash(hash)` devuelve `{ kind: 'route', id: 'account' }` exactamente cuando el hash normaliza a la cadena `'cuenta'`. La normalización quita el `#`, una barra inicial opcional y los espacios de los bordes, así que `'#/cuenta'`, `'#cuenta'`, `'cuenta'` y `'  #/cuenta  '` caen todos en la ruta de cuenta.
2. **Pestaña válida si el hash normaliza a un id de `TABS`.** Cuando el hash normaliza a uno de los ids de las pestañas (`tasks`, `focus`, `garden`, `stats`, `settings`), devuelve `{ kind: 'tab', id }` con ese mismo id.
3. **Respaldo a `tasks` en cualquier otro caso.** Cualquier otro hash (basura, vacío, con mayúsculas, con espacios internos, ids desconocidos) devuelve `{ kind: 'tab', id: 'tasks' }`. La app nunca se queda sin pestaña.
4. **Determinista y pura.** El mismo hash siempre produce el mismo resultado. La función no depende de `location` ni de estado global, no lanza y no muta su entrada: se le pasa el hash como argumento y se comprueba que llamarla dos veces con el mismo hash da resultados equivalentes.

La normalización usa `replace(/^#\/?/, '')` seguido de `trim()`: solo recorta **una** barra tras el `#` y los espacios de los bordes, por eso `'cuenta'` con mayúsculas (`'CUENTA'`), con barra extra (`'#//cuenta'`) o con texto alrededor no cae en la ruta de cuenta, sino en el respaldo `tasks`. Estos son casos límite explícitos del barrido.

## Nota sobre Node y el `customElements.define` de `app-shell.js`

`routeFromHash` es una función pura y exportada, pero `app-shell.js` define un custom element al cargarse: la clase `AppShell extends HTMLElement` y la llamada `customElements.define('app-shell', AppShell)` se evalúan al importar el módulo. Además, `app-shell.js` importa `store.js`, que al cargarse lee `localStorage`. En el navegador todo eso ya existe; en Node hay que definir **antes del import** unos stubs mínimos de `HTMLElement`, `customElements`, `localStorage`, `document`, `window` y `location`, y restaurarlos al terminar, igual que otras propiedades definen un `location` mínimo. Como `routeFromHash` es pura, los stubs solo sirven para que el módulo cargue sin lanzar; la función no los usa.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta y los stubs de DOM para Node. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 1: La ruta de cuenta se decide solo por el hash
// Validates: Requirements 1.1

// Arnés mínimo: corre `check` con `runs` entradas aleatorias y falla con la primera que no cumpla.
const forAll = (runs, generate, check) => {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
  }
};

// En Node no hay DOM; `app-shell.js` define un custom element y `store.js` lee localStorage al
// cargarse. Se definen stubs mínimos solo si faltan, y se restauran al terminar. `routeFromHash`
// es pura: estos stubs solo permiten que el módulo se importe sin lanzar.
const needsDomStub = typeof customElements === 'undefined';
const stubbedKeys = [];
if (needsDomStub) {
  const store = new Map();
  const stubs = {
    HTMLElement: class {},
    customElements: { define() {}, get() {} },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    document: { addEventListener() {} },
    window: { addEventListener() {} },
    location: { origin: 'https://focus-garden.example', hash: '' },
  };
  for (const [key, value] of Object.entries(stubs)) {
    if (typeof globalThis[key] === 'undefined') {
      globalThis[key] = value;
      stubbedKeys.push(key);
    }
  }
}

// Iteraciones aleatorias para la rama de respaldo: muy por encima del mínimo de 100 pedido.
const RANDOM_RUNS = 300;

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Ids de pestañas válidas; deben coincidir con `TABS` de `app-shell.js`.
const TAB_IDS = ['tasks', 'focus', 'garden', 'stats', 'settings'];

// Variantes de hash que, al normalizar (quitar '#', una barra inicial y espacios de borde),
// dan la cadena 'cuenta' y por tanto deben llevar a la ruta de cuenta.
const ACCOUNT_HASHES = ['#/cuenta', '#cuenta', 'cuenta', '/cuenta', '  #/cuenta  ', '#/cuenta '];

// Hashes que normalizan a un id de pestaña válido, en sus tres formas equivalentes.
const tabHashVariants = (id) => [`#/${id}`, `#${id}`, id, `  #/${id}  `];

// Piezas para construir hashes basura que deben caer en el respaldo 'tasks'.
const JUNK_PARTS = ['', ' ', '#', '#/', '///', 'CUENTA', '#/CUENTA', '#//cuenta', 'cuenta extra',
  'tasks-x', 'unknown', '#/404', '123', '#/@!$', '  ', '#/ cuenta', 'account', 'focus ', ' garden'];

try {
  const { routeFromHash } = await import('./src/components/app-shell.js');

  // Comprueba que una entrada cumple las cuatro condiciones de la propiedad.
  const check = (hash) => {
    const route = routeFromHash(hash);

    // Forma del retorno: siempre un objeto con kind 'route'|'tab' e id cadena.
    if (!route || (route.kind !== 'route' && route.kind !== 'tab') || typeof route.id !== 'string') {
      return false;
    }

    // Contrato de referencia: la misma normalización que documenta la propiedad.
    const normalized = String(hash ?? '').replace(/^#\/?/, '').trim();
    const expected = normalized === 'cuenta'
      ? { kind: 'route', id: 'account' }
      : { kind: 'tab', id: TAB_IDS.includes(normalized) ? normalized : 'tasks' };
    if (route.kind !== expected.kind || route.id !== expected.id) return false;

    // Determinista y pura: el mismo hash vuelve a dar lo mismo, sin tocar `location`.
    const again = routeFromHash(hash);
    return again.kind === route.kind && again.id === route.id;
  };

  // 1) Casos límite dirigidos de 'cuenta': todas las formas que normalizan a la ruta de cuenta.
  for (const hash of ACCOUNT_HASHES) {
    const route = routeFromHash(hash);
    if (route.kind !== 'route' || route.id !== 'account') {
      throw new Error(`Esperaba route/account para ${JSON.stringify(hash)}, obtuve ${JSON.stringify(route)}`);
    }
    if (!check(hash)) throw new Error(`Falla con: ${JSON.stringify(hash)}`);
  }

  // 2) Casos límite dirigidos de cada pestaña: las tres formas equivalentes de los 5 ids.
  for (const id of TAB_IDS) {
    for (const hash of tabHashVariants(id)) {
      const route = routeFromHash(hash);
      if (route.kind !== 'tab' || route.id !== id) {
        throw new Error(`Esperaba tab/${id} para ${JSON.stringify(hash)}, obtuve ${JSON.stringify(route)}`);
      }
      if (!check(hash)) throw new Error(`Falla con: ${JSON.stringify(hash)}`);
    }
  }

  // 3) Casos límite de respaldo: basura, vacío, mayúsculas y barras extra caen a 'tasks'.
  for (const hash of JUNK_PARTS) {
    const route = routeFromHash(hash);
    if (route.kind !== 'tab' || route.id !== 'tasks') {
      throw new Error(`Esperaba tab/tasks para ${JSON.stringify(hash)}, obtuve ${JSON.stringify(route)}`);
    }
    if (!check(hash)) throw new Error(`Falla con: ${JSON.stringify(hash)}`);
  }

  // 4) Variaciones aleatorias: >= 100 iteraciones (aquí 300) mezclando cuenta, pestañas y basura.
  const generate = () => {
    const bucket = Math.random();
    if (bucket < 0.2) return pick(ACCOUNT_HASHES);
    if (bucket < 0.5) return pick(tabHashVariants(pick(TAB_IDS)));
    // Basura compuesta: concatena piezas y, a veces, ruido aleatorio, para la rama de respaldo.
    const noise = Math.random().toString(36).slice(2, 2 + Math.floor(Math.random() * 6));
    return pick(JUNK_PARTS) + (Math.random() < 0.5 ? noise : '');
  };
  forAll(RANDOM_RUNS, generate, check);

  console.log(`Feature: accounts-auth, Property 1: OK (casos límite cuenta + 5 pestañas + respaldo, y ${RANDOM_RUNS} hashes aleatorios; la ruta depende solo del hash)`);
} finally {
  for (const key of stubbedKeys) delete globalThis[key];
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador el DOM ya existe, así que los stubs no se aplican. El `await import('./src/components/app-shell.js')` resuelve la ruta relativa a la URL de la página. Importar `app-shell.js` registra el custom element `app-shell` si no estaba, pero `routeFromHash` se usa como función pura sin montar ningún elemento.

### En Node (sin navegador)

El script ya trae el arnés `forAll` y los stubs de DOM (`HTMLElement`, `customElements`, `localStorage`, `document`, `window`, `location`) que `app-shell.js` y su cadena de imports necesitan al cargarse. Usa `await import(...)` de nivel superior (módulo). Desde la carpeta de la app (`exercise/`), se copia el bloque ` ```js ` a la entrada de Node:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/components/app-shell.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`. No se crea ningún archivo temporal.

## Resultado esperado

El script termina sin lanzar error e imprime:

```
Feature: accounts-auth, Property 1: OK (casos límite cuenta + 5 pestañas + respaldo, y 300 hashes aleatorios; la ruta depende solo del hash)
```

Un `Error: Falla con: ...` (o un `Error: Esperaba ...`) señala un hash cuya ruta no cumple el contrato: por ejemplo un hash de cuenta que no devuelve `route/account`, un id de pestaña que no se respeta, basura que no cae a `tasks`, o una llamada que no fue determinista. En cualquier caso se reporta a `coder` con el hash que falló.

## Última ejecución

Pendiente de ejecución registrada en esta sesión. La lógica de la propiedad (misma normalización `replace(/^#\/?/, '').trim()` y las ramas `cuenta → route/account`, id de `TABS → tab/id`, resto `→ tab/tasks` que implementa `routeFromHash` en `src/components/app-shell.js`) cubre los casos límite dirigidos (las seis formas de `cuenta`, las tres formas de cada una de las cinco pestañas, y una lista de basura con vacíos, espacios, mayúsculas y barras extra) más 300 hashes aleatorios.

Nota del entorno: igual que en las Propiedades 5 y 7, en esta sandbox Node no termina (tanto `node --input-type=module --eval` con `await import(...)` de nivel superior como un `node -e` puro sin imports se quedan colgados y agotan el tiempo). Es una limitación del entorno de ejecución, no de la lógica ni del módulo. Para ejecutar el script tal como se documenta, usar la consola de DevTools con la app servida, o pegar el bloque en `node --input-type=module` por stdin y cerrar con Ctrl-D. A diferencia de las propiedades de `src/core/auth.js`, aquí el import es de `src/components/app-shell.js`, que define un custom element y lee `localStorage` al cargarse, por lo que el bloque incluye los stubs de DOM necesarios para que el módulo cargue en Node. El contrato de referencia del script (la normalización `replace(/^#\/?/, '').trim()` y las tres ramas) es una transcripción directa del `routeFromHash` real, por lo que coincide con la implementación por construcción.
```