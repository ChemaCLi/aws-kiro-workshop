// Vista "Ajustes": preferencias (música, sonido, modo demo), acciones de datos, el
// Account_Slot de la cuenta y un espacio reservado para las sesiones. Es el único lugar
// donde viven estos controles.
import { store } from '../core/store.js';
import { mountView } from '../ui/view.js';
import { haptic, unlockAudio } from '../core/feedback.js';
import { startMusic, stopMusic, isMusicAvailable } from '../core/lofi.js';
import { accountSlotModel, getSession, isAuthAvailable, signOut } from '../core/auth.js';
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

/**
 * Account_Slot real de Ajustes. Pinta una de las tres situaciones que `accountSlotModel`
 * deriva de la sesión y la disponibilidad del SDK:
 *   - `disabled`: sin red/SDK, el bloque se atenúa con el aviso y no ofrece acciones de
 *     cuenta; el resto de Ajustes sigue funcionando (req. 10.1, 10.3).
 *   - `guest`: con SDK y sin sesión, un control que lleva a la Auth_Page (req. 7.3).
 *   - `signed-in`: con sesión, muestra la Display_Name (o el correo) y el botón de cerrar
 *     sesión (req. 7.1, 7.2).
 */
const accountSlot = (model) => {
  if (model.mode === 'disabled') {
    return `
      <section aria-disabled="true" class="mx-5 mt-4 rounded-2xl border border-line bg-paper p-4 text-ink/50">
        <h2 class="text-base font-extrabold">Mi cuenta</h2>
        <p class="mt-1 text-sm font-medium">${esc(model.label)}</p>
      </section>`;
  }

  if (model.mode === 'guest') {
    return `
      <section class="mx-5 mt-4 rounded-2xl border border-line bg-paper p-4">
        <h2 class="text-base font-extrabold">Mi cuenta</h2>
        <p class="mt-1 text-sm font-medium text-ink/60">Guarda tu jardín y entra desde otros dispositivos</p>
        <button data-act="account"
          class="press mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-moss py-3 font-bold text-paper">
          ${icon('user', 'h-5 w-5')} ${esc(model.label)}
        </button>
      </section>`;
  }

  // signed-in: la etiqueta es la Display_Name o el correo que derivó el modelo.
  return `
    <section class="mx-5 mt-4 rounded-2xl border border-line bg-paper p-4">
      <h2 class="text-base font-extrabold">Mi cuenta</h2>
      <p class="mt-1 flex items-center gap-2 text-sm font-bold text-ink/80">
        ${icon('user', 'h-5 w-5')} <span class="min-w-0 truncate">${esc(model.label)}</span>
      </p>
      <button data-act="signout"
        class="press mt-3 min-h-11 w-full rounded-2xl border border-line py-3 text-sm font-bold text-red-600/80">
        Cerrar sesión
      </button>
    </section>`;
};

export function mountSettingsView(root) {
  function toggleSetting(key) {
    store.setSetting(key, !store.state.settings[key]);
    haptic(10);
  }

  /** El modo demo cambia la duración de la ronda: no se toca mientras hay una ronda viva. */
  function toggleDemo() {
    const { status } = store.state.timer;
    if (status === 'running' || status === 'paused') return;
    toggleSetting('demo');
  }

  /** Desbloquea el audio dentro del toque del usuario; sin esto el navegador no deja sonar la música. */
  function toggleMusic() {
    if (!isMusicAvailable()) return;
    unlockAudio();
    const turnOn = !store.state.settings.music;
    store.setSetting('music', turnOn);
    haptic(10);
    if (turnOn) startMusic(); else stopMusic();
  }

  /**
   * Lleva a la Auth_Page. `#/cuenta` es una ruta con barra, no una pestaña, así que
   * `navigate()` (que emite `app:navigate` con el id de pestaña) no la cubre: se fija el hash
   * directamente, que es la señal que el shell lee con `routeFromHash(location.hash)` para
   * mostrar la vista de cuenta. Dejar el hash coherente también hace que entrar por URL funcione.
   */
  function goToAccount() {
    haptic(10);
    location.hash = '#/cuenta';
  }

  /** Cerrar sesión es un efecto local: borra la sesión (sin tocar `jardin-movil:v1`) y avisa. */
  function doSignOut() {
    signOut();
    haptic(10);
    toast('Sesión cerrada');
  }

  /** Reemplazar datos pide confirmación solo si hay tareas que perder. */
  async function seedSampleData() {
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

  async function resetAllData() {
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

  function onClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'music') toggleMusic();
    if (act === 'sound') toggleSetting('sound');
    if (act === 'demo') toggleDemo();
    if (act === 'seed') seedSampleData();
    if (act === 'reset') resetAllData();
    if (act === 'account') goToAccount();
    if (act === 'signout') doSignOut();
  }

  function update(root, state) {
    const { settings, timer } = state;
    const isRoundInProgress = timer.status === 'running' || timer.status === 'paused';
    const musicAvailable = isMusicAvailable();
    const account = accountSlotModel(getSession(), isAuthAvailable());
    const prevScroll = root.querySelector('.scroll')?.scrollTop ?? 0;

    root.innerHTML = `
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

        ${accountSlot(account)}
        ${reservedSlot('Mis sesiones', 'Aquí verás los dispositivos donde tienes abierta tu cuenta')}

        <a href="./index.html" class="press mx-5 mt-6 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-paper font-bold text-ink/70">
          ${icon('logout', 'h-5 w-5')} Salir a la página de inicio
        </a>
      </div>`;
    root.querySelector('.scroll').scrollTop = prevScroll;
  }

  // La sesión vive fuera del store (clave `focus-garden:auth:v1`), así que el repintado por
  // `change` del store no la refleja: escuchamos `app:auth` para repintar el Account_Slot
  // cuando se inicia o cierra sesión, sin acoplar esta vista con la de cuenta.
  const onAuthChange = () => update(root, store.state);

  return mountView(root, {
    setup(root) {
      root.addEventListener('click', onClick);
      document.addEventListener('app:auth', onAuthChange);
    },
    update,
    teardown() { document.removeEventListener('app:auth', onAuthChange); },
  });
}
