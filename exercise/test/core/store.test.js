// Portado de docs/modules/settings/properties/propiedad-3-has-local-data.md,
// propiedad-4-reset-seed.md y propiedad-5-alternar-ajustes.md.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { forAll } from '../support/forAll.js';
import { hasLocalData, DURATIONS, DEFAULT_MINUTES } from '../../src/core/rules.js';
import { store, freshState } from '../../src/core/store.js';

const STORAGE_KEY = 'jardin-movil:v1';
let originalRaw;
let originalState;

beforeEach(() => {
  originalRaw = localStorage.getItem(STORAGE_KEY);
  originalState = structuredClone(store.state);
});

afterEach(() => {
  if (originalRaw === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, originalRaw);
  store.state = originalState;
});

describe('Feature: landing-and-settings, Property 3: hasLocalData es exacto y no muta', () => {
  // Validates: Requirements 4.1, 4.2, 4.3, 12.4
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

  const expectedHasData = (state) => state.tasks.length + state.rounds.length > 0;

  const deepFreeze = (value) => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value);
      Object.values(value).forEach(deepFreeze);
    }
    return value;
  };

  const checkPure = (state) => {
    const before = JSON.stringify(state);
    const result = hasLocalData(state);
    const after = JSON.stringify(state);
    if (before !== after) return false;
    return result === expectedHasData(state);
  };

  const checkFrozen = (state) => {
    const frozen = deepFreeze(JSON.parse(JSON.stringify(state)));
    return hasLocalData(frozen) === expectedHasData(state);
  };

  const edges = [
    { name: 'vacío', state: makeState(0, 0), expected: false },
    { name: 'solo tareas', state: makeState(2, 0), expected: true },
    { name: 'solo rondas', state: makeState(0, 3), expected: true },
    { name: 'tareas y rondas', state: makeState(2, 3), expected: true },
    { name: 'una sola tarea', state: makeState(1, 0), expected: true },
    { name: 'una sola ronda', state: makeState(0, 1), expected: true },
  ];

  test('bordes: exacto, puro y a prueba de congelado', () => {
    for (const { name, state, expected } of edges) {
      expect(hasLocalData(state), `borde "${name}"`).toBe(expected);
      expect(checkPure(state), `borde "${name}" (puro)`).toBe(true);
      expect(checkFrozen(state), `borde "${name}" (congelado)`).toBe(true);
    }
  });

  test('300 estados aleatorios: exacto y no muta', () => {
    const randomState = () => makeState(Math.random() < 0.25 ? 0 : randomInt(0, 5), Math.random() < 0.25 ? 0 : randomInt(0, 5));
    forAll(300, randomState, (state) => checkPure(state) && checkFrozen(state));
  });

  test('store.hasLocalData() coincide con la función pura sobre store.state', () => {
    const checkStore = (state) => {
      store.state = state; // asignación directa: no guarda ni emite `change`
      const before = JSON.stringify(store.state);
      const fromStore = store.hasLocalData();
      const after = JSON.stringify(store.state);
      return before === after && fromStore === hasLocalData(store.state) && fromStore === expectedHasData(state);
    };
    for (const { state } of edges) expect(checkStore(state)).toBe(true);
    const randomState = () => makeState(Math.random() < 0.25 ? 0 : randomInt(0, 5), Math.random() < 0.25 ? 0 : randomInt(0, 5));
    forAll(300, randomState, checkStore);
  });
});

describe('Feature: landing-and-settings, Property 4: reset y seedDemo conservan los ajustes', () => {
  // Validates: Requirements 5.8, 9.7
  const SETTING_KEYS = ['music', 'sound', 'demo', 'minutes'];
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const randomBoolean = () => Math.random() < 0.5;
  const pickSettings = (settings) => Object.fromEntries(SETTING_KEYS.map((key) => [key, settings[key]]));

  const populate = (kind) => {
    store.reset();
    if (kind === 'tasks') {
      const count = 1 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) store.addTask({ title: `Tarea ${i}`, type: pick(['trabajo', 'personal', 'salud']) });
    }
    if (kind === 'demo') store.seedDemo();
  };

  const applySettings = (wanted) => {
    store.cancel();
    store.setSetting('music', wanted.music);
    store.setSetting('sound', wanted.sound);
    store.setSetting('demo', wanted.demo);
    if (!store.setDuration(wanted.minutes)) throw new Error(`setDuration rechazó ${wanted.minutes}`);
  };

  const savedSettings = () => JSON.parse(localStorage.getItem(STORAGE_KEY)).settings;
  const sameSettings = (actual, wanted) => JSON.stringify(pickSettings(actual)) === JSON.stringify(wanted);
  const keepsSettings = (wanted) => sameSettings(store.state.settings, wanted) && sameSettings(savedSettings(), wanted);

  const check = ({ wanted, startKind }) => {
    populate(startKind);
    applySettings(wanted);
    if (!sameSettings(store.state.settings, wanted)) return false;

    store.reset();
    if (!keepsSettings(wanted)) return false;
    if (store.state.tasks.length !== 0 || store.state.rounds.length !== 0) return false;

    store.seedDemo();
    if (!keepsSettings(wanted)) return false;
    if (store.state.tasks.length === 0) return false;

    store.reset();
    return keepsSettings(wanted) && store.state.tasks.length === 0 && store.state.rounds.length === 0;
  };

  const startKinds = ['empty', 'tasks', 'demo'];

  test('dominio finito de combinaciones de ajustes', () => {
    for (const music of [false, true]) {
      for (const sound of [false, true]) {
        for (const demo of [false, true]) {
          for (const minutes of DURATIONS) {
            const input = { wanted: { music, sound, demo, minutes }, startKind: pick(startKinds) };
            expect(check(input), JSON.stringify(input)).toBe(true);
          }
        }
      }
    }
  });

  test('200 variaciones aleatorias', () => {
    const generate = () => ({
      wanted: { music: randomBoolean(), sound: randomBoolean(), demo: randomBoolean(), minutes: pick(DURATIONS) },
      startKind: pick(startKinds),
    });
    forAll(200, generate, check);
  });
});

describe('Feature: landing-and-settings, Property 5: alternar un ajuste dos veces restaura el valor y se persiste', () => {
  // Validates: Requirements 8.3, 8.4, 8.6, 8.7, 8.9
  const SETTING_KEYS = ['music', 'sound', 'demo', 'minutes'];
  const TOGGLE_KEYS = ['music', 'sound', 'demo'];
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const randomBoolean = () => Math.random() < 0.5;
  const pickSettings = (settings) => Object.fromEntries(SETTING_KEYS.map((key) => [key, settings[key]]));

  const applySettings = (wanted) => {
    store.reset();
    store.setSetting('music', wanted.music);
    store.setSetting('sound', wanted.sound);
    store.setSetting('demo', wanted.demo);
    if (!store.setDuration(wanted.minutes)) throw new Error(`setDuration rechazó ${wanted.minutes}`);
    store.cancel();
  };

  const savedState = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
  const reloadedSettings = () => freshState(savedState().settings).settings;
  const sameSettings = (actual, wanted) => JSON.stringify(pickSettings(actual)) === JSON.stringify(wanted);
  const isIdle = () => store.state.timer.status === 'idle' && savedState().timer.status === 'idle';

  const holds = (expected) =>
    sameSettings(store.state.settings, expected) &&
    sameSettings(savedState().settings, expected) &&
    sameSettings(reloadedSettings(), expected) &&
    isIdle();

  const check = ({ key, initial }) => {
    applySettings(initial);
    if (!sameSettings(store.state.settings, initial) || !isIdle()) return false;

    const toggled = { ...initial, [key]: !initial[key] };
    store.setSetting(key, !initial[key]);
    if (store.state.settings[key] !== !initial[key]) return false;
    if (savedState().settings[key] !== !initial[key]) return false;
    if (!holds(toggled)) return false;

    store.setSetting(key, initial[key]);
    if (store.state.settings[key] !== initial[key]) return false;
    if (savedState().settings[key] !== initial[key]) return false;
    return holds(initial);
  };

  test('dominio finito: cada ajuste alternable x todas las combinaciones', () => {
    for (const key of TOGGLE_KEYS) {
      for (const music of [false, true]) {
        for (const sound of [false, true]) {
          for (const demo of [false, true]) {
            for (const minutes of DURATIONS) {
              const input = { key, initial: { music, sound, demo, minutes } };
              expect(check(input), JSON.stringify(input)).toBe(true);
            }
          }
        }
      }
    }
  });

  test('200 variaciones aleatorias', () => {
    const generate = () => ({
      key: pick(TOGGLE_KEYS),
      initial: { music: randomBoolean(), sound: randomBoolean(), demo: randomBoolean(), minutes: pick(DURATIONS) },
    });
    forAll(200, generate, check);
  });
});

describe('Feature: cloud-sync, Store.replaceState persiste y notifica', () => {
  const makeCloudState = (overrides = {}) => ({
    tasks: [{ id: 't-1', title: 'Desde la nube', type: 'trabajo', createdAt: Date.now() - 1000, doneAt: null }],
    rounds: [],
    timer: { taskId: null, status: 'idle', totalMs: 1500000, remainingMs: 1500000, endsAt: null },
    settings: { demo: false, sound: true, music: false, minutes: 25 },
    updatedAt: Date.now() - 1000,
    ...overrides,
  });

  test('refleja tasks/rounds/settings exactos y los persiste en localStorage', () => {
    const cloud = makeCloudState();
    store.replaceState(cloud);
    expect(store.state.tasks).toEqual(cloud.tasks);
    expect(store.state.rounds).toEqual(cloud.rounds);
    expect(store.state.settings).toEqual(cloud.settings);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(saved.tasks).toEqual(cloud.tasks);
  });

  test('dispara exactamente un evento change (coalescido, igual que cualquier otra mutación)', async () => {
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls += 1; });
    calls = 0; // ignorar la llamada inmediata que hace subscribe() al suscribirse
    store.replaceState(makeCloudState());
    await Promise.resolve(); // #commit dispara 'change' en un microtask
    expect(calls).toBe(1);
    unsubscribe();
  });

  test('un timer con taskId que no existe en tasks se reinicia, igual que al cargar', () => {
    const cloud = makeCloudState({
      timer: { taskId: 'inexistente', status: 'running', totalMs: 1500000, remainingMs: 1500000, endsAt: Date.now() + 1500000 },
    });
    store.replaceState(cloud);
    expect(store.state.timer.status).toBe('idle');
    expect(store.state.timer.taskId).toBeNull();
  });

  test('normaliza datos incompletos igual que load(): minutos inválidos, timer parcial, arrays ausentes', () => {
    store.replaceState({ settings: { minutes: 999 }, timer: { status: 'paused' } });
    expect(store.state.tasks).toEqual([]);
    expect(store.state.rounds).toEqual([]);
    expect(store.state.settings.minutes).toBe(DEFAULT_MINUTES);
    expect(store.state.timer.status).toBe('paused');
    expect(store.state.timer.taskId).toBeNull();
  });

  test('updatedAt queda en "ahora" (lo pone #commit, no el valor recibido)', () => {
    const before = Date.now();
    store.replaceState(makeCloudState({ updatedAt: before - 1_000_000 }));
    expect(store.state.updatedAt).toBeGreaterThanOrEqual(before);
  });
});
