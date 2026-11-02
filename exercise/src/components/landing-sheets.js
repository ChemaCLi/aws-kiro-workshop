// Hojas de la landing: el recordatorio de la cuenta que se muestra al entrar a la app.
import { openSheet } from '../ui/sheet.js';

/**
 * Recordatorio que se muestra cada vez que alguien entra a la app desde la landing.
 * Es informativo: cualquier forma de cerrarlo (botón, Escape, fondo o arrastre) continúa
 * a la app, así nunca bloquea la entrada.
 */
export function openAccountReminderSheet({ onDone }) {
  openSheet({
    title: 'Antes de empezar',
    onClose() {
      document.activeElement?.blur(); // el foco no se queda en una hoja que se retira
      onDone?.();
    },
    render(body, close) {
      body.innerHTML = `
        <p class="text-[15px] leading-relaxed text-ink/70">Puedes crear una cuenta desde los ajustes si así lo deseas</p>
        <button type="button" data-ok class="press mt-5 w-full rounded-2xl bg-moss py-4 text-[17px] font-bold text-white">Entendido</button>`;

      const okButton = body.querySelector('[data-ok]');
      okButton.onclick = () => close();
      okButton.focus(); // la hoja ya está en el DOM, el foco inicial puede ser inmediato
    },
  });
}
