import { store } from '../core/store.js';

/**
 * Clase base de las vistas. Usamos light DOM (sin Shadow DOM) para que las clases
 * de Tailwind apliquen directo. Cada vista implementa update(state).
 */
export class StoreView extends HTMLElement {
  connectedCallback() {
    this.classList.add('view');
    this.setup?.();
    this.unsubscribe = store.subscribe((state) => this.update(state));
  }
  disconnectedCallback() {
    this.unsubscribe?.();
    this.teardown?.();
  }
}
