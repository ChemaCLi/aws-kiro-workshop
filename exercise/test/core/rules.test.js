// Portado de docs/modules/settings/properties/propiedad-1-franja-horaria.md y
// propiedad-2-hero-plots.md (antes scripts para pegar en la consola del navegador).
import { describe, expect, test } from 'vitest';
import { forAll, randomInt } from '../support/forAll.js';
import { timePeriodFor, TIME_PERIODS, heroPlots, gardenPlots, groupTasksByDate, LANDING_STARTER_PLOTS, TASK_TYPES } from '../../src/core/rules.js';

describe('Feature: landing-and-settings, Property 1: La franja depende solo de la hora local y cubre todo el día', () => {
  // Validates: Requirements 2.1, 2.3
  const expectedPeriodForHour = (hour) => {
    if (hour >= 6 && hour <= 11) return 'morning';
    if (hour >= 12 && hour <= 15) return 'midday';
    if (hour >= 16 && hour <= 19) return 'afternoon';
    return 'night'; // 20-23 y 0-5
  };

  const randomDateAtHour = (hour) =>
    new Date(randomInt(1990, 2090), randomInt(0, 11), randomInt(1, 28), hour,
      randomInt(0, 59), randomInt(0, 59), randomInt(0, 999));

  const periodMatchesLocalHour = (date) => {
    const period = timePeriodFor(date);
    return TIME_PERIODS.includes(period) && period === expectedPeriodForHour(date.getHours());
  };

  test('cubre las 24 horas del día (minuto 0 y minuto 59)', () => {
    for (let hour = 0; hour < 24; hour++) {
      const base = new Date(2025, 5, 15, hour, 0, 0, 0);
      const lastMinute = new Date(2025, 5, 15, hour, 59, 59, 999);
      for (const date of [base, lastMinute]) {
        if (date.getHours() !== hour) continue; // hora inexistente por cambio de horario (DST): se omite
        expect(periodMatchesLocalHour(date)).toBe(true);
      }
    }
  });

  test('la misma hora local da siempre la misma franja, sin importar el resto de la fecha', () => {
    for (let hour = 0; hour < 24; hour++) {
      const reference = timePeriodFor(new Date(2025, 5, 15, hour, 30, 0, 0));
      forAll(120, () => randomDateAtHour(hour).getTime(), (timestamp) => {
        const date = new Date(timestamp);
        if (date.getHours() !== hour) return true; // hora inexistente por DST: no aplica
        return periodMatchesLocalHour(date) && timePeriodFor(date) === reference;
      });
    }
  });

  test('fechas completamente aleatorias siempre dan exactamente una franja válida', () => {
    forAll(500, () => randomInt(-2e12, 4e12), (timestamp) => periodMatchesLocalHour(new Date(timestamp)));
  });
});

describe('Feature: landing-and-settings, Property 2: El hero nunca queda vacío y respeta el jardín real', () => {
  // Validates: Requirements 2.5, 2.6
  const typeIds = TASK_TYPES.map((type) => type.id);
  const pick = (items) => items[Math.floor(Math.random() * items.length)];

  const generateState = () => {
    const tasks = [];
    const rounds = [];
    const taskCount = Math.floor(Math.random() * 9);
    const sharedDoneAt = 1_700_000_000_000 + Math.floor(Math.random() * 3) * 86_400_000; // repetido a propósito

    for (let i = 0; i < taskCount; i++) {
      const isDone = Math.random() < 0.6;
      const task = {
        id: `t${i}-${Math.floor(Math.random() * 1000)}`,
        title: `Tarea ${i}`,
        type: pick(typeIds),
        createdAt: 1_690_000_000_000 + i,
        doneAt: isDone ? (Math.random() < 0.5 ? sharedDoneAt : sharedDoneAt + Math.floor(Math.random() * 5) * 1000) : 0,
      };
      tasks.push(task);
      const roundCount = Math.random() < 0.4 ? 0 : 1 + Math.floor(Math.random() * 8);
      for (let r = 0; r < roundCount; r++) {
        rounds.push({ taskId: task.id, at: sharedDoneAt + r, seconds: 1500 });
      }
    }

    const orphanCount = Math.floor(Math.random() * 4);
    for (let r = 0; r < orphanCount; r++) {
      rounds.push({ taskId: `huerfana-${Math.floor(Math.random() * 1000)}`, at: sharedDoneAt + r, seconds: 1500 });
    }
    return { tasks, rounds };
  };

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
      return sameJson(hero, garden) && hero.length === expectedPlotCount(state);
    }
    return expectedPlotCount(state) === 0 && sameJson(hero, LANDING_STARTER_PLOTS);
  };

  test('bordes fijos caen en las plantas de inicio', () => {
    const doneAt = 1_700_000_000_000;
    const edgeStates = [
      { tasks: [], rounds: [] },
      { tasks: [{ id: 'a', title: 'A', type: 'trabajo', doneAt: 0 }], rounds: [] },
      { tasks: [{ id: 'a', title: 'A', type: 'trabajo', doneAt: 0 }], rounds: [{ taskId: 'a', at: doneAt, seconds: 1500 }] },
      { tasks: [{ id: 'a', title: 'A', type: 'salud', doneAt }], rounds: [] },
      { tasks: [], rounds: [{ taskId: 'nadie', at: doneAt, seconds: 1500 }] },
    ];
    for (const state of edgeStates) {
      expect(check(state)).toBe(true);
      expect(sameJson(heroPlots(state), LANDING_STARTER_PLOTS)).toBe(true);
    }
  });

  test('un jardín real mínimo no se mezcla con las plantas de inicio', () => {
    const doneAt = 1_700_000_000_000;
    const oneGarden = {
      tasks: [{ id: 'a', title: 'A', type: 'salud', doneAt }],
      rounds: [{ taskId: 'a', at: doneAt, seconds: 1500 }],
    };
    expect(check(oneGarden)).toBe(true);
    expect(heroPlots(oneGarden).length).toBe(1);
  });

  test('300 estados aleatorios cumplen la propiedad', () => {
    forAll(300, generateState, check);
  });
});

describe('Feature: todo-list, groupTasksByDate agrupa por día y ordena', () => {
  const DAY = 86_400_000;
  const now = 1_700_000_000_000;

  test('agrupa por día descendente y ordena cada grupo por el campo elegido', () => {
    const tasks = [
      { id: 'a', doneAt: now, createdAt: now - 5 * DAY },
      { id: 'b', doneAt: now - 10_000, createdAt: now - 5 * DAY }, // mismo día que 'a', más viejo
      { id: 'c', doneAt: now - DAY, createdAt: now - DAY },
      { id: 'd', doneAt: now - 2 * DAY, createdAt: now - 2 * DAY },
    ];
    const groups = groupTasksByDate(tasks, 'doneAt', now);
    expect(groups.map((g) => g.label)).toEqual(['hoy', 'ayer', 'hace 2 días']);
    expect(groups[0].items.map((t) => t.id)).toEqual(['a', 'b']); // más reciente primero dentro del día
  });

  test('omite tareas sin la fecha pedida (p. ej. doneAt null) y no muta la lista de entrada', () => {
    const tasks = [
      { id: 'a', doneAt: now, createdAt: now },
      { id: 'b', doneAt: null, createdAt: now },
    ];
    const before = JSON.stringify(tasks);
    const groups = groupTasksByDate(tasks, 'doneAt', now);
    expect(groups.flatMap((g) => g.items.map((t) => t.id))).toEqual(['a']);
    expect(JSON.stringify(tasks)).toBe(before);
  });

  test('agrupar por createdAt en vez de doneAt cambia el día de cada tarea', () => {
    const tasks = [{ id: 'a', doneAt: now, createdAt: now - 3 * DAY }];
    expect(groupTasksByDate(tasks, 'doneAt', now)[0].label).toBe('hoy');
    expect(groupTasksByDate(tasks, 'createdAt', now)[0].label).toBe('hace 3 días');
  });

  test('sin tareas con esa fecha, no hay grupos', () => {
    expect(groupTasksByDate([], 'doneAt', now)).toEqual([]);
  });
});
