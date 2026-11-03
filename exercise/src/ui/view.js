// Reemplaza la antigua clase base StoreView de los Web Components: monta una vista plana de
// JS sobre un contenedor ya presente en el DOM (renderizado por un .astro), con el mismo
// ciclo de vida de siempre: setup() una vez, update(state) en cada cambio del store,
// teardown() al desmontar.
import { store } from '../core/store.js';

/**
 * @param {HTMLElement} root contenedor donde la vista pinta su contenido.
 * @param {{ setup?: (root: HTMLElement) => void, update?: (root: HTMLElement, state: object) => void, teardown?: (root: HTMLElement) => void }} handlers
 * @returns {() => void} función para desmontar la vista (desuscribe y llama teardown()).
 */
export function mountView(root, { setup, update, teardown } = {}) {
  root.classList.add('view');
  setup?.(root);
  const unsubscribe = store.subscribe((state) => update?.(root, state));
  return () => {
    unsubscribe();
    teardown?.(root);
  };
}
