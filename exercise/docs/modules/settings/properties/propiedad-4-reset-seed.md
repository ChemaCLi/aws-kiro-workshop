# Propiedad 4: reset y seedDemo conservan los ajustes

**Validates: Requirements 5.8, 9.7**

**Propiedad:** para cualquier combinación de ajustes (`music`, `sound`, `demo` booleanos, `minutes` válido de `DURATIONS`), después de `store.reset()` y de `store.seedDemo()` los valores de `settings.music`, `settings.sound`, `settings.demo` y `settings.minutes` quedan iguales. Además, `reset()` deja `tasks` y `rounds` vacías.

La propiedad se comprueba en el estado en memoria y en lo que `store` guarda en `localStorage['jardin-movil:v1']`, partiendo de tres estados de datos: vacío, con tareas sueltas y con datos de ejemplo.

## Script

Pegar primero el arnés `forAll` de [`../README.md`](../README.md) y después este script en la consola del navegador, con la app abierta. El script usa y modifica el `store` real, por eso **restaura al terminar** (aunque falle) la copia de `localStorage['jardin-movil:v1']` y de `store.state` que guardó al empezar.

```js
// Feature: landing-and-settings, Property 4: reset y seedDemo conservan los ajustes
const { DURATIONS } = await import('./src/core/rules.js');
const { store } = await import('./src/core/store.js');

const STORAGE_KEY = 'jardin-movil:v1';
const SETTING_KEYS = ['music', 'sound', 'demo', 'minutes'];

// Copia de seguridad: el almacenamiento tal cual y el estado en memoria.
const originalRaw = localStorage.getItem(STORAGE_KEY);
const originalState = structuredClone(store.state);

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const randomBoolean = () => Math.random() < 0.5;
const pickSettings = (settings) => Object.fromEntries(SETTING_KEYS.map((key) => [key, settings[key]]));

// Estado de partida con datos: vacío, tareas sueltas o datos de ejemplo.
const populate = (kind) => {
  store.reset();
  if (kind === 'tasks') {
    const count = 1 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) store.addTask({ title: `Tarea ${i}`, type: pick(['trabajo', 'personal', 'salud']) });
  }
  if (kind === 'demo') store.seedDemo();
};

// Deja el store con exactamente estos ajustes. Con el timer en reposo, setDuration siempre se aplica.
const applySettings = (wanted) => {
  store.cancel();
  store.setSetting('music', wanted.music);
  store.setSetting('sound', wanted.sound);
  store.setSetting('demo', wanted.demo);
  if (!store.setDuration(wanted.minutes)) throw new Error(`setDuration rechazó ${wanted.minutes}`);
};

const savedSettings = () => JSON.parse(localStorage.getItem(STORAGE_KEY)).settings;
const sameSettings = (actual, wanted) => JSON.stringify(pickSettings(actual)) === JSON.stringify(wanted);

// Los ajustes quedan iguales tanto en memoria como en lo guardado en localStorage.
const keepsSettings = (wanted) => sameSettings(store.state.settings, wanted) && sameSettings(savedSettings(), wanted);

const check = ({ wanted, startKind }) => {
  populate(startKind);
  applySettings(wanted);
  if (!sameSettings(store.state.settings, wanted)) return false; // precondición: los ajustes se aplicaron

  store.reset();
  if (!keepsSettings(wanted)) return false;
  if (store.state.tasks.length !== 0 || store.state.rounds.length !== 0) return false;

  store.seedDemo();
  if (!keepsSettings(wanted)) return false;
  if (store.state.tasks.length === 0) return false; // seedDemo sí siembra datos

  store.reset(); // reset desde un estado con datos de ejemplo
  return keepsSettings(wanted) && store.state.tasks.length === 0 && store.state.rounds.length === 0;
};

const startKinds = ['empty', 'tasks', 'demo'];

try {
  // 1) Dominio finito de ajustes: se recorren todas las combinaciones, sin azar.
  let combinations = 0;
  for (const music of [false, true]) {
    for (const sound of [false, true]) {
      for (const demo of [false, true]) {
        for (const minutes of DURATIONS) {
          const input = { wanted: { music, sound, demo, minutes }, startKind: pick(startKinds) };
          if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
          combinations++;
        }
      }
    }
  }

  // 2) Variaciones aleatorias: 200 iteraciones, con distinto estado de partida.
  const generate = () => ({
    wanted: {
      music: randomBoolean(),
      sound: randomBoolean(),
      demo: randomBoolean(),
      minutes: pick(DURATIONS),
    },
    startKind: pick(startKinds),
  });
  forAll(200, generate, check);

  console.log('Propiedad 4 OK:', combinations, 'combinaciones + 200 iteraciones aleatorias');
} finally {
  // Restaurar siempre, aunque la propiedad falle: ni localStorage ni el estado en vivo quedan alterados.
  if (originalRaw === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, originalRaw);
  store.state = originalState;
}
```

## Cómo ejecutarlo

1. Servir la app (por ejemplo `http://localhost:8080`) y abrirla en el navegador.
2. Abrir la consola de DevTools y pegar el arnés `forAll` del README del módulo.
3. Pegar el script de arriba y presionar Enter.
4. Recargar la página si se quiere que las vistas ya abiertas vuelvan a pintar el estado restaurado.

### Alternativa en Node (sin navegador)

`store.js` solo necesita `window`, `localStorage` y `queueMicrotask`. Desde la carpeta de la app, ejecutar con `node --input-type=module` un archivo que junte, en este orden, el bloque de abajo, el arnés `forAll` y el script (el `await` de nivel superior requiere módulo).

```js
// Stubs mínimos para correr store.js en Node: window, localStorage en memoria.
globalThis.window = globalThis;
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => { memory.set(key, String(value)); },
  removeItem: (key) => { memory.delete(key); },
};
```

## Resultado esperado

El script termina sin lanzar error y muestra en consola `Propiedad 4 OK: 56 combinaciones + 200 iteraciones aleatorias`. Un `Error: Falla con: ...` indica un contraejemplo (ajustes y estado de partida) y se reporta a `coder`. Al terminar, `localStorage['jardin-movil:v1']` y `store.state` vuelven a tener los valores originales.
