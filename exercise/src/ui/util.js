import { haptic } from '../core/feedback.js';

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Comunicación entre componentes sin acoplarlos: eventos en document. */
export const navigate = (tab) => document.dispatchEvent(new CustomEvent('app:navigate', { detail: { tab } }));
export const toast = (message, options = {}) =>
  document.dispatchEvent(new CustomEvent('app:toast', { detail: { message, ...options } }));

export function formatClock(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Mensaje común al terminar una tarea (desde la lista o desde Foco). */
export function announceCompletion(result) {
  if (!result) return;
  haptic(20);
  if (result.plant) {
    toast(`${result.plant.emoji} ¡Creció ${result.plant.label.toLowerCase()} en tu jardín!`, {
      action: { label: 'Ver', run: () => navigate('garden') },
      duration: 4200,
    });
  } else {
    toast('Terminada sin pomodoros: no brota nada. Prueba ▶ la próxima 🌱');
  }
}
