// <settings-view>: preferencias (música, sonido, modo demo), acciones de datos y espacios
// reservados para las cuentas. Es el único lugar donde viven estos controles.
import { store } from '../core/store.js';
import { StoreView } from '../ui/base.js';
import { haptic, unlockAudio } from '../core/feedback.js';
import { startMusic, stopMusic, isMusicAvailable } from '../core/lofi.js';
import { icon } from '../ui/icons.js';
import { confirmSheet } from '../ui/sheet.js';
import { esc, toast } from '../ui/util.js';

/** Fila con un interruptor. Se pinta como botón `role="switch"` para teclado y lectores de pantalla. */
const switchRow = ({ act, title, support, isOn, isDisabled = false }) => `
  <div class="flex min-h-14 items-center justify-between gap-3 p-3.5">
    <div class="min-w-0">
      <p class="text-[15px] font-bold">${esc(title)}</p>
      <p class="text-xs font-medium text-ink/50">${esc(support)}</p>
    </div>
    <button role="switch" aria-checked="${isOn}" aria-label="${esc(title)}" data-act="${act}" ${isDisabled ? 'disabled' : ''}
      class="switch before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']"></button>
  </div>`;

/** Bloque reservado para una función futura: visible, atenuado y sin acciones. */
const reservedSlot = (title, description) => `
  <section aria-disabled="true" class="mx-5 mt-4 rounded-2xl border border-line bg-paper p-4 text-ink/50">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-base font-extrabold">${esc(title)}</h2>
      <span class="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">Próximamente</span>
    </div>
    <p class="mt-1 text-sm font-medium">${esc(description)}</p>
  </section>`;

class SettingsView extends StoreView {
  setup() { this.addEventListener('click', (e) => this.#onClick(e)); }

  update(state) {
    const { settings, timer } = state;
    const isRoundInProgress = timer.status === 'running' || timer.status === 'paused';
    const musicAvailable = isMusicAvailable();
    const prevScroll = this.querySelector('.scroll')?.scrollTop ?? 0;

    this.innerHTML = `
      <div class="scroll page absolute inset-0 pb-8">
        <header class="pad-top px-5">
          <h1 class="text-[34px] font-extrabold leading-tight tracking-tight">Ajustes</h1>
          <p class="text-sm font-medium text-ink/60">Tu app, a tu manera.</p>
        </header>

        <div class="mx-5 mt-4 divide-y divide-line rounded-2xl border border-line bg-paper">
          ${switchRow({
            act: 'music',
            title: 'Música de fondo',
            support: musicAvailable ? 'Lofi para concentrarte' : 'No disponible sin conexión',
            isOn: settings.music && musicAvailable,
            isDisabled: !musicAvailable,
          })}
          ${switchRow({
            act: 'sound',
            title: 'Sonido de la campanita',
            support: 'Campanita al terminar la ronda',
            isOn: settings.sound,
          })}
          ${switchRow({
            act: 'demo',
            title: 'Modo demo',
            support: isRoundInProgress ? 'Termina o reinicia la ronda para cambiarlo' : 'Rondas de 10 segundos para mostrar la app',
            isOn: settings.demo,
            isDisabled: isRoundInProgress,
          })}
        </div>

        <section class="mx-5 mt-6">
          <h2 class="px-1 text-xs font-bold uppercase tracking-wide text-ink/50">Datos</h2>
          <div class="mt-1.5 grid gap-2">
            <button data-act="seed" class="press min-h-11 rounded-2xl border border-line bg-paper py-3.5 font-bold">✨ Cargar datos de ejemplo</button>
            <button data-act="reset" class="press min-h-11 rounded-2xl py-3 text-sm font-bold text-red-600/80">Borrar todos los datos</button>
          </div>
        </section>

        ${reservedSlot('Mi cuenta', 'Aquí podrás crear tu cuenta e iniciar sesión')}
        ${reservedSlot('Mis sesiones', 'Aquí verás los dispositivos donde tienes abierta tu cuenta')}

        <a href="./index.html" class="press mx-5 mt-6 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-paper font-bold text-ink/70">
          ${icon('logout', 'h-5 w-5')} Salir a la página de inicio
        </a>
      </div>`;
    this.querySelector('.scroll').scrollTop = prevScroll;
  }

  #onClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'music') this.#toggleMusic();
    if (act === 'sound') this.#toggleSetting('sound');
    if (act === 'demo') this.#toggleDemo();
    if (act === 'seed') this.#seedSampleData();
    if (act === 'reset') this.#resetAllData();
  }

  #toggleSetting(key) {
    store.setSetting(key, !store.state.settings[key]);
    haptic(10);
  }

  /** El modo demo cambia la duración de la ronda: no se toca mientras hay una ronda viva. */
  #toggleDemo() {
    const { status } = store.state.timer;
    if (status === 'running' || status === 'paused') return;
    this.#toggleSetting('demo');
  }

  /** Desbloquea el audio dentro del toque del usuario; sin esto el navegador no deja sonar la música. */
  #toggleMusic() {
    if (!isMusicAvailable()) return;
    unlockAudio();
    const turnOn = !store.state.settings.music;
    store.setSetting('music', turnOn);
    haptic(10);
    if (turnOn) startMusic(); else stopMusic();
  }

  /** Reemplazar datos pide confirmación solo si hay tareas que perder. */
  async #seedSampleData() {
    if (store.state.tasks.length) {
      const confirmed = await confirmSheet({
        title: '¿Cargar datos de ejemplo?',
        message: 'Esto reemplaza tus tareas y rondas actuales por datos de demostración.',
        confirmLabel: 'Cargar',
      });
      if (!confirmed) return;
    }
    store.seedDemo();
    toast('Datos de ejemplo cargados ✨');
  }

  async #resetAllData() {
    const confirmed = await confirmSheet({
      title: '¿Borrar todo?',
      message: 'Se eliminan tareas, rondas y el jardín. No se puede deshacer.',
      confirmLabel: 'Borrar todo',
      danger: true,
    });
    if (!confirmed) return;
    store.reset();
    toast('Todo limpio 🌱');
  }
}

customElements.define('settings-view', SettingsView);
