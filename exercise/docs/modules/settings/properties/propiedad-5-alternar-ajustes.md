# Propiedad 5: alternar un ajuste dos veces restaura el valor y se persiste

**Validates: Requirements 8.3, 8.4, 8.6, 8.7, 8.9**

**Propiedad:** para cada ajuste booleano (`music`, `sound`, `demo`), cualquier valor inicial y el timer en reposo:

1. `store.setSetting(key, !valor)` cambia el valor en `store.state.settings` y el JSON guardado en `localStorage['jardin-movil:v1']` tiene el mismo valor.
2. `store.setSetting(key, valor)` restaura el valor original, también en memoria y en lo guardado.
3. Los demás ajustes (`music`, `sound`, `demo`, `minutes`) no cambian en ninguno de los dos pasos, ni en memoria ni en lo guardado.
4. Al recargar el valor se conserva: se simula releyendo el JSON guardado y pasando sus `settings` por `freshState`, que es lo que hace `load()` al arrancar.
5. El timer sigue en reposo (`status: 'idle'`) en memoria y en el JSON guardado.

La propiedad se comprueba para el dominio finito completo (3 ajustes × 8 combinaciones de `music`/`sound`/`demo` × las 7 duraciones de `DURATIONS`) y después con 200 iteraciones aleatorias.

## Script

Pegar primero el arnés `forAll` de [`../README.md`](../README.md) y después este script en la consola del navegador, con la app abierta. El script usa y modifica el `store` real, por eso **restaura al terminar** (aunque falle) la copia de `localStorage['jardin-movil:v1']` y de `store.state` que guardó al empezar.

```js
// Feature: landing-and-settings, Property 5: alternar un ajuste dos veces restaura el valor y se persiste
const { DURATIONS } = await import('./src/core/rules.js');
const { store, freshState } = await import('./src/core/store.js');

const STORAGE_KEY = 'jardin-movil:v1';
const SETTING_KEYS = ['music', 'sound', 'demo', 'minutes'];
const TOGGLE_KEYS = ['music', 'sound', 'demo'];

// Copia de seguridad: el almacenamiento tal cual y el estado en memoria.
const originalRaw = localStorage.getItem(STORAGE_KEY);
const originalState = structuredClone(store.state);

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const randomBoolean = () => Math.random() < 0.5;
const pickSettings = (settings) => Object.fromEntries(SETTING_KEYS.map((key) => [key, settings[key]]));

// Deja el store con exactamente estos ajustes y el timer en reposo (reset() conserva los ajustes).
const applySettings = (wanted) => {
  store.reset();
  store.setSetting('music', wanted.music);
  store.setSetting('sound', wanted.sound);
  store.setSetting('demo', wanted.demo);
  if (!store.setDuration(wanted.minutes)) throw new Error(`setDuration rechazó ${wanted.minutes}`);
  store.cancel(); // timer en reposo
};

const savedState = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
// Lo que vería la app al recargar: los ajustes guardados pasan por freshState, como en load().
const reloadedSettings = () => freshState(savedState().settings).settings;
const sameSettings = (actual, wanted) => JSON.stringify(pickSettings(actual)) === JSON.stringify(wanted);
const isIdle = () => store.state.timer.status === 'idle' && savedState().timer.status === 'idle';

// Tras un paso, memoria, JSON guardado y "recarga" coinciden con los ajustes esperados y el timer sigue en reposo.
const holds = (expected) =>
  sameSettings(store.state.settings, expected) &&
  sameSettings(savedState().settings, expected) &&
  sameSettings(reloadedSettings(), expected) &&
  isIdle();

const check = ({ key, initial }) => {
  applySettings(initial);
  if (!sameSettings(store.state.settings, initial) || !isIdle()) return false; // precondición

  const toggled = { ...initial, [key]: !initial[key] };
  store.setSetting(key, !initial[key]);
  if (store.state.settings[key] !== !initial[key]) return false;
  if (savedState().settings[key] !== !initial[key]) return false;
  if (!holds(toggled)) return false; // el valor cambió y los demás ajustes no

  store.setSetting(key, initial[key]);
  if (store.state.settings[key] !== initial[key]) return false;
  if (savedState().settings[key] !== initial[key]) return false;
  return holds(initial); // restaurado en memoria, guardado y tras recargar
};

try {
  // 1) Dominio finito: todas las combinaciones de ajustes y cada ajuste alternable, sin azar.
  let combinations = 0;
  for (const key of TOGGLE_KEYS) {
    for (const music of [false, true]) {
      for (const sound of [false, true]) {
        for (const demo of [false, true]) {
          for (const minutes of DURATIONS) {
            const input = { key, initial: { music, sound, demo, minutes } };
            if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
            combinations++;
          }
        }
      }
    }
  }

  // 2) Variaciones aleatorias: 200 iteraciones.
  const generate = () => ({
    key: pick(TOGGLE_KEYS),
    initial: {
      music: randomBoolean(),
      sound: randomBoolean(),
      demo: randomBoolean(),
      minutes: pick(DURATIONS),
    },
  });
  forAll(200, generate, check);

  console.log('Propiedad 5 OK:', combinations, 'combinaciones + 200 iteraciones aleatorias');
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

El script termina sin lanzar error y muestra en consola `Propiedad 5 OK: 168 combinaciones + 200 iteraciones aleatorias` (3 ajustes × 8 combinaciones de `music`/`sound`/`demo` × 7 duraciones). Un `Error: Falla con: ...` indica un contraejemplo (ajuste alternado y ajustes iniciales) y se reporta a `coder`. Al terminar, `localStorage['jardin-movil:v1']` y `store.state` vuelven a tener los valores originales.
