---
name: unit-tests
description: Cómo escribir y correr unit tests de Focus Garden con Vitest, tanto de funciones JS puras (core/rules.js, core/auth.js, ui/util.js, store) como de vistas (src/views/) con jsdom. Actívala al crear o arreglar tests, al convertir un script de propiedad (docs/modules/*/properties/) en un test real, o al cubrir una funcionalidad core después de una spec.
---

# Unit tests con Vitest

## Qué estamos probando y qué no

Esto son **unit tests**: funciones y vistas en aislamiento, corriendo con Vitest + jsdom. No reemplazan a `qa-tester`, que verifica el comportamiento real en un navegador. Repartición:

| Capa | Qué se prueba aquí (Vitest) | Qué queda para qa-tester |
|------|---------------------------|--------------------------|
| `core/rules.js`, `core/auth.js` | Toda la lógica pura: plantas, estadísticas, fechas, geometría, landing, OAuth/PKCE | — |
| `core/store.js` | Acciones y selectores sobre un `localStorage` real de jsdom | — |
| `ui/util.js` | `esc`, `formatClock`, eventos despachados | — |
| `src/views/*` | Funciones puras exportadas (p. ej. `routeFromHash` de `app-shell.js`); pintado y clics de una vista montada con `mountX(root)` | Gestos táctiles reales, 3D, audio, responsive |
| `three/`, `lofi`, `feedback` | Nada o muy poco (dependen de WebGL/Audio) | Todo su comportamiento visible |

Regla de oro: **si una función no toca el DOM, se prueba primero y es la prioridad.** La lógica de `core/` es barata de cubrir y donde más valen los tests.

## Dónde viven y cómo correrlos

Todo esto vive en `exercise/` (donde están `package.json` y `astro.config.mjs`).

- `vitest.config.js`: `environment: 'jsdom'` (da `window`, `document`, `location`, `localStorage` reales, que `core/store.js` y `core/auth.js` tocan al cargarse) y `test.server.deps.inline: ['tone']` (Tone.js trae algún import interno sin extensión que Node ESM puro no resuelve, pero el transform de Vite sí; sin esto, cualquier test que importe en cadena una vista que use audio falla al cargar el módulo).
- `test/support/forAll.js`: el arnés de pruebas por propiedades (`forAll(runs, generate, check)`) que usan las pruebas portadas de `docs/modules/*/properties/`.
- `test/core/`, `test/views/`: un archivo de test por módulo, con la misma forma de carpetas que `src/`.

```bash
npm test            # todo (vitest run)
npm run test:watch  # modo watch
npx vitest run test/core/rules.test.js   # un archivo
```

## Probar funciones puras (`core/rules.js`, `core/auth.js`)

Son las más fáciles y las más valiosas. Casos normales, límites y vacíos, con `now`/`date` inyectado en vez de depender del reloj real.

```js
import { describe, expect, test } from 'vitest';
import { plantForRounds, computeStats, timePeriodFor } from '../../src/core/rules.js';

describe('plantForRounds', () => {
  test('0 rondas no siembra nada', () => {
    expect(plantForRounds(0)).toBeNull();
  });
  test('1 ronda da pasto y 6+ da sakura', () => {
    expect(plantForRounds(1).kind).toBe('grass');
    expect(plantForRounds(6).kind).toBe('sakura');
    expect(plantForRounds(99).kind).toBe('sakura'); // tope en la última planta
  });
});

test('timePeriodFor clasifica la mañana', () => {
  expect(timePeriodFor(new Date('2026-01-01T08:00:00'))).toBe('morning');
});
```

## Probar pruebas por propiedades (lo que antes era un script de consola)

`docs/modules/settings/properties/` y `docs/modules/accounts-auth/properties/` documentaban propiedades como scripts para pegar en DevTools, porque el proyecto no tenía Node ni bundler. Eso ya no aplica: cada propiedad nueva se escribe directo como un test real con `forAll`, no como un `.md` con un script.

```js
import { describe, test } from 'vitest';
import { forAll } from '../support/forAll.js';
import { passwordUnmetRules } from '../../src/core/auth.js';

describe('Feature: accounts-auth, Property 13: ...', () => {
  test('500 pares aleatorios cumplen el biconditional', () => {
    forAll(500, generatePair, matchesOracle);
  });
});
```

Ver `test/core/auth.test.js` y `test/core/store.test.js` para ejemplos completos ya portados (incluye dos casos donde convertir el script de consola a un test real **encontró errores en los ejemplos del `.md` original**, nunca ejecutado de verdad: documentarlo en el test, como un comentario, si vuelve a pasar).

## Probar el store (`core/store.js`)

El store es un singleton (`export const store = new Store()`) que lee/escribe `localStorage` de verdad bajo jsdom. Cada test que lo usa debe guardar y restaurar `store.state` y la clave de `localStorage` en `beforeEach`/`afterEach`, para no contaminar otros tests del mismo archivo:

```js
import { afterEach, beforeEach, test, expect } from 'vitest';
import { store } from '../../src/core/store.js';

const STORAGE_KEY = 'jardin-movil:v1';
let originalRaw, originalState;
beforeEach(() => {
  originalRaw = localStorage.getItem(STORAGE_KEY);
  originalState = structuredClone(store.state);
});
afterEach(() => {
  if (originalRaw === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, originalRaw);
  store.state = originalState;
});

test('completeTask sin rondas no genera planta', () => {
  const task = store.addTask({ title: 'Prueba', type: 'trabajo' });
  const result = store.completeTask(task.id);
  expect(result.plant).toBeNull();
});
```

## Probar una vista (`src/views/*`)

Las vistas ya no son Web Components: son funciones `mountX(root)` que reciben un contenedor del DOM y lo gobiernan con `setup()`/`update(root, state)`/`teardown()` (ver `src/ui/view.js`). Para probarlas, crea el contenedor a mano, móntalo y lee su `innerHTML`:

```js
import { test, expect } from 'vitest';
import { mountTasksView } from '../../src/views/tasks-view.js';
import { store } from '../../src/core/store.js';

test('tasks-view muestra el estado vacío', () => {
  const root = document.createElement('div');
  document.body.append(root);
  mountTasksView(root);
  expect(root.textContent).toContain('Tu jardín empieza aquí');
});
```

`mountView` suscribe `update` al store con `store.subscribe`, que llama a `fn(state)` de inmediato al suscribirse: no hace falta esperar un microtask para el primer pintado. Para una acción posterior, el store sigue agrupando el evento `change` con `queueMicrotask`, así que si el test depende de ese evento (no de releer el DOM directamente, que ya refleja el estado síncronamente a través de `update`), espera un tick.

Si el módulo expone una función pura y exportada que no depende de DOM (como `routeFromHash` en `app-shell.js`), pruébala directo sin montar nada — es más barato y es la prioridad, igual que con `core/`.

### Reglas al probar vistas

- **Escapado:** prueba que el texto del usuario se escapa. Mete un título con `<img src=x>` y verifica que el `innerHTML` no contiene la etiqueta cruda.
- **Delegación por `data-act`:** dispara `.click()` sobre el botón con `data-act` y comprueba el efecto en el store, no variables internas del cierre léxico.
- **No pruebes gestos táctiles ni animaciones** aquí: `pointer*` y `setPointerCapture` no se comportan igual en jsdom. Eso es de `qa-tester`.
- **Recursos opcionales:** si una vista importa en cadena `lofi.js`/`garden-scene.js` (Tone.js, Three.js), confirma que `test.server.deps.inline` en `vitest.config.js` sigue cubriendo lo que haga falta.

## Qué cubrir siempre (funcionalidad core)

Según `docs-and-qa.md`, después de una spec las funciones **core** deben quedar cubiertas. Prioridad:

1. **`rules.js` y `auth.js` completos**: cada función exportada con su caso normal, su límite y su vacío.
2. **Acciones del `store`** que cambian datos (añadir, completar, reabrir, eliminar, rondas, ajustes) y la **persistencia/normalización** del `load`.
3. **`ui/util.js`**: `esc` (todas las entidades), `formatClock`, y que `navigate`/`toast` despachan el evento correcto.
4. **Al menos el camino feliz y el estado vacío** de cada vista.

No persigas el 100 %. Persigue que cada regla de producto comprobable tenga un test que falle si alguien la rompe.

## Errores comunes

- **`Cannot find module '.../tone/build/esm/...'`**: falta `tone` en `test.server.deps.inline` de `vitest.config.js`, o se agregó una vista nueva que importa audio en cadena y no se actualizó esa lista.
- **Un test contamina a otro**: el store es singleton; guarda y restaura `store.state` y `localStorage` en `beforeEach`/`afterEach` (ver arriba).
- **El DOM no refleja el cambio**: si el test llama a una acción del store y lee `root.innerHTML` sin que `mountView` haya vuelto a correr `update`, puede que haga falta releer tras el evento `change` (agrupado con `queueMicrotask`).
- **Verifica siempre el ejemplo contra la implementación real** antes de confiar en una lista de casos límite escrita a mano: al portar las propiedades existentes se encontraron ejemplos de `docs/modules/accounts-auth/properties/propiedad-1-ruta-hash.md` que no coincidían con la función real (nunca se habían ejecutado). Un `node -e` rápido contra la función, probando el caso dudoso, vale más que la intuición sobre una expresión regular.
