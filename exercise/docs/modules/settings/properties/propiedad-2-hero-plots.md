# Propiedad 2: El hero nunca queda vacío y respeta el jardín real

**Feature: landing-and-settings, Property 2: El hero nunca queda vacío y respeta el jardín real**

**Validates: Requirements 2.5, 2.6**

## Qué afirma

Para cualquier estado del store:

1. `heroPlots(state)` nunca devuelve una lista vacía.
2. Si `gardenPlots(state)` tiene plantas, `heroPlots(state)` devuelve exactamente esas parcelas (las mismas que dibuja `3d-world`).
3. Si `gardenPlots(state)` está vacío, `heroPlots(state)` devuelve `LANDING_STARTER_PLOTS`.

Como comprobación independiente, el script calcula cuántas parcelas debe tener el jardín (tareas terminadas con al menos una ronda) sin usar `gardenPlots`, y verifica que `heroPlots` coincida con ese número cuando no es cero.

## Estados aleatorios que genera

Cada estado mezcla, con cantidades al azar (también cero):

- Tareas terminadas con rondas (dan planta).
- Tareas terminadas sin rondas (no dan planta).
- Tareas pendientes, con y sin rondas (no dan planta).
- Rondas huérfanas: su `taskId` no corresponde a ninguna tarea.
- `doneAt` repetidos entre tareas, para ejercitar el desempate por `id`.

Además se prueban a mano cuatro bordes que el azar podría tardar en producir: estado vacío, solo tareas pendientes, solo tareas terminadas sin rondas y solo rondas huérfanas. En los cuatro el resultado debe ser `LANDING_STARTER_PLOTS`.

## Script

Se ejecuta con 300 iteraciones (mínimo exigido: 100). Es autocontenido: incluye su propio arnés `forAll` dentro de un bloque, así que se puede pegar varias veces en la consola sin errores de redeclaración.

```js
// Feature: landing-and-settings, Property 2: El hero nunca queda vacío y respeta el jardín real
// Validates: Requirements 2.5, 2.6
{
  const { heroPlots, gardenPlots, LANDING_STARTER_PLOTS, TASK_TYPES } =
    await import(globalThis.RULES_URL ?? './src/core/rules.js');

  // Arnés del README del módulo.
  const forAll = (runs, generate, check) => {
    for (let i = 0; i < runs; i++) {
      const input = generate();
      if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
    }
  };

  const randomInt = (maxExclusive) => Math.floor(Math.random() * maxExclusive);
  const pick = (items) => items[randomInt(items.length)];
  const typeIds = TASK_TYPES.map((type) => type.id);

  // Estado aleatorio con tareas hechas (con y sin rondas), pendientes y rondas huérfanas.
  const generateState = () => {
    const tasks = [];
    const rounds = [];
    const taskCount = randomInt(9);
    const sharedDoneAt = 1_700_000_000_000 + randomInt(3) * 86_400_000; // repetido a propósito

    for (let i = 0; i < taskCount; i++) {
      const isDone = Math.random() < 0.6;
      const task = {
        id: `t${i}-${randomInt(1000)}`,
        title: `Tarea ${i}`,
        type: pick(typeIds),
        createdAt: 1_690_000_000_000 + i,
        doneAt: isDone ? (Math.random() < 0.5 ? sharedDoneAt : sharedDoneAt + randomInt(5) * 1000) : 0,
      };
      tasks.push(task);
      const roundCount = Math.random() < 0.4 ? 0 : 1 + randomInt(8); // 0 rondas o de 1 a 8
      for (let r = 0; r < roundCount; r++) {
        rounds.push({ taskId: task.id, at: sharedDoneAt + r, seconds: 1500 });
      }
    }

    const orphanCount = randomInt(4);
    for (let r = 0; r < orphanCount; r++) {
      rounds.push({ taskId: `huerfana-${randomInt(1000)}`, at: sharedDoneAt + r, seconds: 1500 });
    }
    return { tasks, rounds };
  };

  // Parcelas esperadas calculadas sin gardenPlots: hecha y con al menos una ronda.
  const expectedPlotCount = (state) => {
    const roundsOf = (taskId) => state.rounds.filter((round) => round.taskId === taskId).length;
    return state.tasks.filter((task) => task.doneAt && roundsOf(task.id) > 0).length;
  };

  const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const check = (state) => {
    const hero = heroPlots(state);
    if (!Array.isArray(hero) || hero.length === 0) return false; // nunca vacío (2.6)

    const garden = gardenPlots(state);
    if (garden.length > 0) {
      // Con jardín real se devuelve tal cual y con el conteo esperado (2.5).
      return sameJson(hero, garden) && hero.length === expectedPlotCount(state);
    }
    // Sin jardín real: las plantas de inicio (2.6).
    return expectedPlotCount(state) === 0 && sameJson(hero, LANDING_STARTER_PLOTS);
  };

  // Bordes fijos que deben caer en las plantas de inicio.
  const doneAt = 1_700_000_000_000;
  const edgeStates = [
    { tasks: [], rounds: [] },
    { tasks: [{ id: 'a', title: 'A', type: 'trabajo', doneAt: 0 }], rounds: [] },
    { tasks: [{ id: 'a', title: 'A', type: 'trabajo', doneAt: 0 }], rounds: [{ taskId: 'a', at: doneAt, seconds: 1500 }] },
    { tasks: [{ id: 'a', title: 'A', type: 'salud', doneAt }], rounds: [] },
    { tasks: [], rounds: [{ taskId: 'nadie', at: doneAt, seconds: 1500 }] },
  ];
  for (const state of edgeStates) {
    if (!check(state)) throw new Error(`Falla con el borde: ${JSON.stringify(state)}`);
    if (!sameJson(heroPlots(state), LANDING_STARTER_PLOTS)) {
      throw new Error(`El borde debía dar plantas de inicio: ${JSON.stringify(state)}`);
    }
  }

  // Un jardín real mínimo (una tarea hecha con 1 ronda) no debe mezclarse con las de inicio.
  const oneGarden = {
    tasks: [{ id: 'a', title: 'A', type: 'salud', doneAt }],
    rounds: [{ taskId: 'a', at: doneAt, seconds: 1500 }],
  };
  if (!check(oneGarden) || heroPlots(oneGarden).length !== 1) throw new Error('Falla con un jardín de 1 planta');

  forAll(300, generateState, check);
  console.log('Propiedad 2: OK (300 estados aleatorios + 6 bordes)');
}
```

## Cómo ejecutarlo en la consola

1. Servir `exercise/` con un servidor estático y abrir la app (por ejemplo `http://localhost:8080`).
2. Abrir la consola de DevTools.
3. Pegar el bloque de arriba completo y pulsar Enter. No requiere pegar el arnés antes: ya lo trae dentro.

## Resultado esperado

La consola imprime `Propiedad 2: OK (300 estados aleatorios + 6 bordes)` y no lanza ningún error.

Un `Error: Falla con: {...}` es un contraejemplo: el JSON muestra el estado exacto donde `heroPlots` quedó vacío, no coincidió con `gardenPlots` o no devolvió `LANDING_STARTER_PLOTS`. Se reporta a `coder` con ese estado.

## Ejecución con Node (opcional)

`rules.js` no usa DOM, así que el mismo bloque corre sin navegador. Desde `exercise/`, se extrae el primer bloque `js` a un archivo temporal, se le antepone la ruta de `rules.js` en `RULES_URL` y se ejecuta:

```sh
{
  echo "globalThis.RULES_URL = new URL('./src/core/rules.js', 'file://' + process.cwd() + '/').href;"
  awk '/^```js$/{f=1;next} /^```$/{if(f){exit}} f' docs/modules/settings/properties/propiedad-2-hero-plots.md
} > /tmp/propiedad-2.mjs
node /tmp/propiedad-2.mjs
```

Salida esperada: la misma línea `Propiedad 2: OK (...)` y código de salida 0.
