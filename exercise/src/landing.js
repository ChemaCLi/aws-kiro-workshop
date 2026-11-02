// Arranque de la landing (index.html). Es una página aparte de la app: aquí solo se pinta el cielo
// según la hora, se muestra el jardín y se pide entrar. La app vive en app.html.
import { PLANTS, TASK_TYPES, heroPlots, timePeriodFor } from './core/rules.js';
import { store } from './core/store.js';
import './components/hero-garden.js';
import { openAccountReminderSheet } from './components/landing-sheets.js';

const APP_URL = './app.html';

/** Cada cuánto se revisa si el día cambió de franja mientras la landing sigue abierta. */
const PERIOD_CHECK_MS = 60_000;

const STAR_COUNT = 70;
const BRIGHT_STAR_EVERY = 7;

const ENTER_LABEL_WITH_DATA = 'Continuar mi jardín';
const ENTER_LABEL_WITHOUT_DATA = 'Empezar mi jardín';

const hero = document.querySelector('#inicio');
const heroGarden = document.querySelector('hero-garden');
let currentPeriod = null;
let isEntering = false; // evita abrir el recordatorio dos veces con toques repetidos

// ---------- cielo y jardín ----------

/** Recalcula la franja con la hora local; solo toca el cielo y la escena si realmente cambió. */
function applyPeriod() {
  const period = timePeriodFor(new Date());
  if (period === currentPeriod) return;
  currentPeriod = period;
  hero.dataset.period = period;
  heroGarden.setPeriod(period);
}

/**
 * Estrellas con posición y parpadeo repartidos de forma determinista (no aleatoria): la landing
 * se ve igual en cada visita y no depende de Math.random. Solo se ven cuando la franja es noche.
 */
function renderStars() {
  const host = document.querySelector('.sky-stars');
  const stars = Array.from({ length: STAR_COUNT }, (_, i) => {
    const x = (i * 37.7) % 100;
    const y = (i * 23.3 + (i % 5) * 7) % 100;
    const size = 1 + (i % 3);
    const twinkleSeconds = 2.5 + (i % 6) * 0.7;
    const delaySeconds = -((i * 0.9) % 6);
    const brightClass = i % BRIGHT_STAR_EVERY === 0 ? ' class="is-bright"' : '';
    return `<i${brightClass} style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--s:${size}px;--d:${twinkleSeconds.toFixed(1)}s;--delay:${delaySeconds.toFixed(1)}s"></i>`;
  });
  host.insertAdjacentHTML('afterbegin', stars.join(''));
}

// ---------- contenido que sale de las reglas del juego ----------

/** La escalera de plantas sale de PLANTS para que la landing nunca contradiga las reglas de la app. */
function renderPlantLadder() {
  const lastIndex = PLANTS.length - 1;
  const tiles = PLANTS.map((plant, index) => {
    const rounds = index === lastIndex ? `${plant.rounds}+` : plant.rounds;
    const isTop = index === lastIndex;
    return `
      <li class="plant-tile rounded-2xl border ${isTop ? 'border-pink-200 bg-pink-50' : 'border-line bg-cream'} p-3 text-center">
        <p class="text-4xl" aria-hidden="true">${plant.emoji}</p>
        <p class="mt-2 text-sm font-extrabold">${plant.label}</p>
        <p class="text-xs font-bold"><span class="text-ink/50">${rounds}</span> 🍅</p>
      </li>`;
  });
  document.querySelector('[data-plants]').innerHTML = tiles.join('');
}

/** Chips con el color de cada tipo de tarea, los mismos que usa la app. */
function renderTaskTypeChips() {
  const chips = TASK_TYPES.map((type) => `
    <span class="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-xs font-bold">
      <span class="h-2 w-2 rounded-full" style="background:${type.color}"></span>${type.short ?? type.label}
    </span>`);
  document.querySelector('[data-types]').innerHTML = chips.join('');
}

function renderHeroStats() {
  document.querySelector('[data-stat="plants"]').textContent = PLANTS.length;
  document.querySelector('[data-stat="types"]').textContent = TASK_TYPES.length;
}

/** "Continuar" si ya hay tareas o rondas; si no, la invitación a empezar y la nota de datos locales. */
function renderEntryState() {
  const hasData = store.hasLocalData();
  for (const label of document.querySelectorAll('[data-enter-label]')) {
    label.textContent = hasData ? ENTER_LABEL_WITH_DATA : ENTER_LABEL_WITHOUT_DATA;
  }
  document.querySelector('[data-local-note]').hidden = hasData;
  heroGarden.setPlots(heroPlots(store.state));
}

// ---------- acciones ----------

/** Entrar siempre pasa por el recordatorio de la cuenta; al cerrarlo se abre la app en otra página. */
function enterApp() {
  if (isEntering) return;
  isEntering = true;
  openAccountReminderSheet({ onDone: () => location.assign(APP_URL) });
}

// El Create_Account_Button (data-act="account") ahora es un enlace directo a app.html#/cuenta, así
// que solo se intercepta "Entrar" para pasar por el recordatorio antes de abrir la app.
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-enter]')) enterApp();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') applyPeriod();
});

// Al volver con "atrás" desde la app el navegador puede restaurar esta página de su caché con datos
// viejos (por ejemplo, sin "Continuar"). Se recarga para leer lo que quedó guardado.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});

renderStars();
renderPlantLadder();
renderTaskTypeChips();
renderHeroStats();
renderEntryState();
applyPeriod();
setInterval(applyPeriod, PERIOD_CHECK_MS);
