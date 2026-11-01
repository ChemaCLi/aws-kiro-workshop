# Propiedad 3: `hasLocalData` es exacto y no muta

**Validates: Requirements 4.1, 4.2, 4.3, 12.4**

**Propiedad:** para cualquier estado, `hasLocalData(state)` es `true` si y solo si hay al menos una tarea o al menos una ronda. Llamarla deja el estado idéntico (mismo contenido serializado antes y después, y sin lanzar error si el estado está congelado). Además, `store.hasLocalData()` devuelve lo mismo que la función pura aplicada a `store.state`.

Casos que cubre:

- Bordes: estado vacío (`false`), solo tareas (`true`), solo rondas (`true`) y ambos (`true`).
- Estados aleatorios (300 iteraciones) con tareas y rondas de 0 a 5 elementos, más ajustes y timer arbitrarios que no deben influir en el resultado.
- El método del `Store` contra la función pura, sobre los mismos estados.

## Script

Pegar primero el arnés `forAll` de [`../README.md`](../README.md) y después este script en la consola del navegador, con la app abierta. La parte del `Store` reemplaza `store.state` por cada estado de prueba y lo restaura al terminar (también si algo falla), sin guardar nada: no llama a ninguna acción que escriba en `localStorage`. Aun así, el script compara `localStorage` antes y después para comprobar que no quedan datos de prueba.

```js
// Feature: landing-and-settings, Property 3: hasLocalData es exacto y no muta
const { hasLocalData } = await import('./src/core/rules.js');
const { store, freshState } = await import('./src/core/store.js');

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const taskTypes = ['trabajo', 'personal', 'salud', 'social', 'ocio'];

const makeTask = () => ({
  id: `t-${Math.random().toString(36).slice(2, 8)}`,
  title: `Tarea ${randomInt(0, 999)}`,
  type: pick(taskTypes),
  createdAt: Date.now() - randomInt(0, 1e9),
  doneAt: Math.random() < 0.5 ? null : Date.now() - randomInt(0, 1e6),
});
const makeRound = () => ({
  id: `r-${Math.random().toString(36).slice(2, 8)}`,
  taskId: `t-${Math.random().toString(36).slice(2, 8)}`,
  at: Date.now() - randomInt(0, 1e9),
  seconds: pick([10, 900, 1500, 3000]),
});

// Estado con la forma real (freshState) y un número dado de tareas y rondas.
const makeState = (taskCount, roundCount) => {
  const state = freshState({
    demo: Math.random() < 0.5,
    sound: Math.random() < 0.5,
    music: Math.random() < 0.5,
  });
  state.tasks = Array.from({ length: taskCount }, makeTask);
  state.rounds = Array.from({ length: roundCount }, makeRound);
  return state;
};

// Oráculo con la definición escrita aparte: al menos una tarea o una ronda.
const expectedHasData = (state) => state.tasks.length + state.rounds.length > 0;

// Congela el estado a fondo: si hasLocalData intentara mutar algo, lanzaría un TypeError (los módulos son estrictos).
const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

// Chequeo puro: resultado exacto y estado idéntico antes y después.
const checkPure = (state) => {
  const before = JSON.stringify(state);
  const result = hasLocalData(state);
  const after = JSON.stringify(state);
  if (before !== after) return false;
  return result === expectedHasData(state);
};

// Chequeo con el estado congelado: una mutación escondida lanzaría error.
const checkFrozen = (state) => {
  const frozen = deepFreeze(JSON.parse(JSON.stringify(state)));
  return hasLocalData(frozen) === expectedHasData(state);
};

// Bordes con el resultado esperado escrito a mano (no depende del oráculo).
const edges = [
  { name: 'vacío', state: makeState(0, 0), expected: false },
  { name: 'solo tareas', state: makeState(2, 0), expected: true },
  { name: 'solo rondas', state: makeState(0, 3), expected: true },
  { name: 'tareas y rondas', state: makeState(2, 3), expected: true },
  { name: 'una sola tarea', state: makeState(1, 0), expected: true },
  { name: 'una sola ronda', state: makeState(0, 1), expected: true },
];
for (const { name, state, expected } of edges) {
  if (hasLocalData(state) !== expected) throw new Error(`Falla en el borde "${name}": se esperaba ${expected}`);
  if (!checkPure(state) || !checkFrozen(state)) throw new Error(`Falla en el borde "${name}": ${JSON.stringify(state)}`);
}

// 1) Parte pura: 300 estados aleatorios, 25 % de ellos sin tareas y 25 % sin rondas.
const randomState = () => makeState(Math.random() < 0.25 ? 0 : randomInt(0, 5), Math.random() < 0.25 ? 0 : randomInt(0, 5));
forAll(300, randomState, (state) => checkPure(state) && checkFrozen(state));

// 2) Parte del Store: store.hasLocalData() coincide con la función pura sobre store.state.
//    Se guarda el estado y el localStorage originales y se restauran al terminar.
const STORAGE_KEY = 'jardin-movil:v1';
const originalState = store.state;
const originalStorage = localStorage.getItem(STORAGE_KEY);
try {
  const checkStore = (state) => {
    store.state = state; // asignación directa: no guarda ni emite `change`
    const before = JSON.stringify(store.state);
    const fromStore = store.hasLocalData();
    const after = JSON.stringify(store.state);
    return before === after && fromStore === hasLocalData(store.state) && fromStore === expectedHasData(state);
  };
  for (const { name, state } of edges) {
    if (!checkStore(state)) throw new Error(`store.hasLocalData() falla en el borde "${name}"`);
  }
  forAll(300, randomState, checkStore);
} finally {
  store.state = originalState;
}
if (localStorage.getItem(STORAGE_KEY) !== originalStorage) {
  throw new Error('El script modificó el localStorage: revisar que no se llamó a una acción que guarda');
}
if (store.state !== originalState) throw new Error('No se restauró el estado original del store');

console.log('Propiedad 3 OK:', edges.length, 'bordes + 300 estados puros + 300 estados en el Store; localStorage intacto');
```

## Cómo ejecutarlo

1. Servir la app (por ejemplo `http://localhost:8080`) y abrirla en el navegador.
2. Abrir la consola de DevTools y pegar el arnés `forAll` del README del módulo.
3. Pegar el script de arriba y presionar Enter.

`import('./src/core/store.js')` devuelve el mismo módulo que usa la app, así que `store` es el mismo objeto que `__store`.

## Resultado esperado

El script termina sin lanzar error y muestra en consola `Propiedad 3 OK: 6 bordes + 300 estados puros + 300 estados en el Store; localStorage intacto`. Un `Error: Falla con: ...` indica un contraejemplo (el estado que falló en JSON) y se reporta a `coder`. Al terminar, la app sigue con sus datos originales.
