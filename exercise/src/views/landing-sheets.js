// Hojas de la landing: la elección entre iniciar sesión o entrar sin cuenta, al tocar "Entrar".
import { openSheet } from '../ui/sheet.js';

/**
 * Pregunta si la persona quiere iniciar sesión o entrar sin cuenta, cada vez que toca "Entrar"
 * en la landing. Cerrar sin elegir (Escape, fondo o arrastre) equivale a "entrar sin cuenta":
 * nunca bloquea la entrada a la app, igual que el resto de las hojas del proyecto.
 */
export function openEnterChoiceSheet({ onSignIn, onGuest }) {
  let choseSignIn = false;
  openSheet({
    title: '¿Cómo quieres entrar?',
    onClose() {
      document.activeElement?.blur(); // el foco no se queda en una hoja que se retira
      if (choseSignIn) onSignIn?.();
      else onGuest?.();
    },
    render(body, close) {
      body.innerHTML = `
        <p class="text-[15px] leading-relaxed text-ink/70">Inicia sesión para llevar tu progreso entre dispositivos, o sigue sin cuenta: tus datos se quedan en este dispositivo y puedes crear una cuenta después desde Ajustes.</p>
        <button type="button" data-act="signIn" class="press mt-5 w-full rounded-2xl bg-moss py-4 text-[17px] font-bold text-white">
          Iniciar sesión</button>
        <button type="button" data-act="guest" class="press mt-2 w-full rounded-2xl border border-line bg-paper py-4 text-[17px] font-bold text-ink">
          Entrar sin cuenta</button>`;

      const signInButton = body.querySelector('[data-act="signIn"]');
      signInButton.onclick = () => { choseSignIn = true; close(); };
      body.querySelector('[data-act="guest"]').onclick = () => close();
      signInButton.focus(); // la hoja ya está en el DOM, el foco inicial puede ser inmediato
    },
  });
}
