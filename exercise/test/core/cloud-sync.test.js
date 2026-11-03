// Pruebas de decideSync: la función pura de core/cloud-sync.js que decide si pushear, pullear
// o no hacer nada al conciliar el estado local con el de la nube. No toca red ni el store.
import { describe, expect, test } from 'vitest';
import { decideSync } from '../../src/core/cloud-sync.js';
import { forAll, randomInt } from '../support/forAll.js';

const emptyState = (updatedAt = 0) => ({ tasks: [], rounds: [], updatedAt });
const withData = (updatedAt) => ({ tasks: [{ id: 't1' }], rounds: [], updatedAt });

describe('Feature: cloud-sync, decideSync decide push/pull/noop al conciliar', () => {
  test('sin copia en la nube (null): push solo si hay datos locales', () => {
    expect(decideSync(emptyState(), null)).toBe('noop');
    expect(decideSync(withData(100), null)).toBe('push');
  });

  test('ambos vacíos: noop sin importar updatedAt', () => {
    expect(decideSync(emptyState(500), emptyState(10))).toBe('noop');
    expect(decideSync(emptyState(10), emptyState(500))).toBe('noop');
  });

  test('solo uno tiene datos: gana el que tiene datos, sin importar updatedAt', () => {
    expect(decideSync(withData(10), emptyState(99999))).toBe('push');
    expect(decideSync(emptyState(99999), withData(10))).toBe('pull');
  });

  test('ambos con datos: gana el updatedAt más reciente; empate gana local (push)', () => {
    expect(decideSync(withData(100), withData(50))).toBe('push');
    expect(decideSync(withData(50), withData(100))).toBe('pull');
    expect(decideSync(withData(100), withData(100))).toBe('push');
  });

  test('200 combinaciones aleatorias: el resultado siempre es consistente con hasLocalData/updatedAt', () => {
    const randomState = (updatedAt) => ({
      tasks: Array.from({ length: randomInt(0, 3) }, (_, i) => ({ id: `t${i}` })),
      rounds: Array.from({ length: randomInt(0, 3) }, (_, i) => ({ id: `r${i}` })),
      updatedAt,
    });
    const generate = () => ({
      local: randomState(randomInt(0, 1_000_000)),
      cloud: Math.random() < 0.3 ? null : randomState(randomInt(0, 1_000_000)),
    });
    forAll(200, generate, ({ local, cloud }) => {
      const result = decideSync(local, cloud);
      const localHas = local.tasks.length + local.rounds.length > 0;
      const cloudHas = Boolean(cloud) && cloud.tasks.length + cloud.rounds.length > 0;
      if (!localHas && !cloudHas) return result === 'noop';
      if (!localHas) return result === 'pull';
      if (!cloudHas) return result === 'push';
      return result === ((cloud.updatedAt ?? 0) > (local.updatedAt ?? 0) ? 'pull' : 'push');
    });
  });
});
