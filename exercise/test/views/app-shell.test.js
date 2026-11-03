// Portado de docs/modules/accounts-auth/properties/propiedad-1-ruta-hash.md. La función vivía
// en src/components/app-shell.js (Web Component); ahora está en src/views/app-shell.js, ya sin
// customElements.define, así que no hace falta ningún stub de DOM para importarla.
import { describe, expect, test } from 'vitest';
import { forAll } from '../support/forAll.js';
import { routeFromHash } from '../../src/views/app-shell.js';

describe('Feature: accounts-auth, Property 1: La ruta de cuenta se decide solo por el hash', () => {
  // Validates: Requirements 1.1
  //
  // La normalización real es `hash.replace(/^#\/?/, '').trim()`: el replace solo actúa si el
  // string empieza EXACTAMENTE con '#' (la `^` lo ancla); recién después se recorta con trim().
  // Al convertir el script de consola de
  // docs/modules/accounts-auth/properties/propiedad-1-ruta-hash.md a esta prueba real (ese
  // script nunca se había corrido de verdad, según su propia nota de "última ejecución"), se
  // encontraron ejemplos del documento que no coinciden con esa regla, verificados aquí contra
  // la función real antes de corregir las listas:
  //   - '/cuenta' y '  #/cuenta  ' (espacio ANTES del '#') no normalizan a 'cuenta': sin un '#'
  //     justo al inicio, el replace no actúa y el trim() de después no alcanza a quitarlo. Caen
  //     al respaldo 'tasks'.
  //   - '#/ cuenta' y '#/cuenta ' (espacio DESPUÉS de el '#/' o al final) sí normalizan a
  //     'cuenta': el replace ya quitó el '#/', y el trim() limpia el resto.
  //   - Lo mismo aplica a una pestaña: '  #/focus  ' (espacio antes del '#') cae a 'tasks', pero
  //     'focus ' o ' focus' (sin '#', solo espacios alrededor del id) sí resuelven a esa pestaña.
  const TAB_IDS = ['tasks', 'focus', 'garden', 'stats', 'settings'];
  const ACCOUNT_HASHES = ['#/cuenta', '#cuenta', 'cuenta', '#/cuenta ', '#/ cuenta'];
  const tabHashVariants = (id) => [`#/${id}`, `#${id}`, id, `${id} `, ` ${id}`];
  const JUNK_PARTS = ['', ' ', '#', '#/', '///', 'CUENTA', '#/CUENTA', '#//cuenta', 'cuenta extra',
    'tasks-x', 'unknown', '#/404', '123', '#/@!$', '  ', '/cuenta', '  #/cuenta  ', 'account'];
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const check = (hash) => {
    const route = routeFromHash(hash);
    if (!route || (route.kind !== 'route' && route.kind !== 'tab') || typeof route.id !== 'string') return false;

    const normalized = String(hash ?? '').replace(/^#\/?/, '').trim();
    const expected = normalized === 'cuenta'
      ? { kind: 'route', id: 'account' }
      : { kind: 'tab', id: TAB_IDS.includes(normalized) ? normalized : 'tasks' };
    if (route.kind !== expected.kind || route.id !== expected.id) return false;

    const again = routeFromHash(hash);
    return again.kind === route.kind && again.id === route.id;
  };

  test('variantes de "cuenta" llevan a la ruta de cuenta', () => {
    for (const hash of ACCOUNT_HASHES) {
      const route = routeFromHash(hash);
      expect(route, hash).toEqual({ kind: 'route', id: 'account' });
      expect(check(hash)).toBe(true);
    }
  });

  test('las tres formas equivalentes de cada pestaña llevan a esa pestaña', () => {
    for (const id of TAB_IDS) {
      for (const hash of tabHashVariants(id)) {
        const route = routeFromHash(hash);
        expect(route, hash).toEqual({ kind: 'tab', id });
        expect(check(hash)).toBe(true);
      }
    }
  });

  test('basura, vacío, mayúsculas y barras extra caen al respaldo "tasks"', () => {
    for (const hash of JUNK_PARTS) {
      const route = routeFromHash(hash);
      expect(route, JSON.stringify(hash)).toEqual({ kind: 'tab', id: 'tasks' });
      expect(check(hash)).toBe(true);
    }
  });

  test('300 hashes aleatorios cumplen el contrato completo', () => {
    forAll(300, () => {
      const bucket = Math.random();
      if (bucket < 0.2) return pick(ACCOUNT_HASHES);
      if (bucket < 0.5) return pick(tabHashVariants(pick(TAB_IDS)));
      const noise = Math.random().toString(36).slice(2, 2 + Math.floor(Math.random() * 6));
      return pick(JUNK_PARTS) + (Math.random() < 0.5 ? noise : '');
    }, check);
  });
});
