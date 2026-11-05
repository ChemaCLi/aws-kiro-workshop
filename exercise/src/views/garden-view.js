// Vista "Jardín": isla 3D a pantalla completa + tarjeta con la planta tocada.
// Si Three.js no carga, se muestra una cuadrícula de emojis. El cielo y la luz de la escena
// cambian con la franja del día, igual que el hero de la landing (ver hero-garden.js).
import { store } from '../core/store.js';
import { mountView } from '../ui/view.js';
import { PLANTS, TYPE_BY_ID, gardenPlots, relativeDay, timePeriodFor, starField } from '../core/rules.js';
import { GARDEN_LOOKS } from '../three/garden-looks.js';
import { icon } from '../ui/icons.js';
import { esc, navigate } from '../ui/util.js';
import { createGardenScene } from '../three/garden-scene.js';

/** Cada cuánto se revisa si el día cambió de franja mientras la pestaña sigue abierta. */
const PERIOD_CHECK_MS = 60_000;

export function mountGardenView(root) {
  let scene = null;
  let plots = [];
  let selected = null;
  let fallback = false;
  let stage = null;
  let sky = null;
  let period = timePeriodFor(new Date());
  let periodTimer = 0;

  function select(id) {
    selected = id;
    const info = root.querySelector('[data-info]');
    const plot = plots.find((p) => p.id === id);
    if (!plot) { info.innerHTML = ''; return; }
    const type = TYPE_BY_ID[plot.type];
    info.innerHTML = `
      <div class="pop flex items-center gap-3 rounded-2xl bg-paper/95 p-3 shadow-lg backdrop-blur">
        <span class="text-3xl">${plot.plant.emoji}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-extrabold">${esc(plot.title)}</p>
          <p class="text-xs font-medium text-ink/60">${type.emoji} ${esc(type.label)} · 🍅 ${plot.rounds} · ${plot.plant.label} · ${relativeDay(plot.doneAt)}</p>
        </div>
        <button data-act="close" aria-label="Cerrar" class="press grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink/60">${icon('x', 'h-4 w-4')}</button>
      </div>`;
  }

  function renderFallback() {
    stage.innerHTML = `
      <div class="absolute inset-0 overflow-auto px-6 pb-40 pt-28 text-center">
        <p class="mb-4 text-xs font-semibold text-ink/50">No se pudo cargar el 3D (¿sin conexión?). Vista simplificada.</p>
        <div class="grid grid-cols-5 gap-3 text-4xl">${plots.map((p) => `<span title="${esc(p.title)}">${p.plant.emoji}</span>`).join('')}</div>
      </div>`;
  }

  /** Recalcula la franja con la hora local; solo toca el cielo y la luz si realmente cambió. */
  function applyPeriod() {
    const newPeriod = timePeriodFor(new Date());
    if (newPeriod === period) return;
    period = newPeriod;
    sky.dataset.period = period;
    scene?.setLook(GARDEN_LOOKS[period]);
  }

  function setup(root) {
    const legend = PLANTS.map((p) => `
      <span class="flex flex-col items-center leading-tight"><span class="text-lg">${p.emoji}</span>
      <span class="text-[10px] font-bold text-ink/60">${p.rounds}${p.rounds === 6 ? '+' : ''}🍅</span></span>`).join('');

    const stars = starField().map((s) => `
      <i${s.bright ? ' class="is-bright"' : ''} style="--x:${s.x.toFixed(1)}%;--y:${s.y.toFixed(1)}%;--s:${s.size}px;--d:${s.twinkleSeconds.toFixed(1)}s;--delay:${s.delaySeconds.toFixed(1)}s"></i>`).join('');

    root.innerHTML = `
      <div class="garden-sky absolute inset-0 overflow-hidden" data-period="${period}">
        <div class="sky-stars" aria-hidden="true">${stars}</div>
        <div data-stage class="absolute inset-0"></div>
        <header class="pad-top pointer-events-none absolute inset-x-0 top-0 px-5">
          <h1 class="text-[34px] font-extrabold leading-tight tracking-tight">Mi jardín</h1>
          <p data-sub class="text-sm font-semibold"></p>
        </header>
        <div data-empty class="pop absolute inset-x-5 mx-auto hidden max-w-md rounded-3xl bg-paper/90 p-4 text-center shadow-lg backdrop-blur" style="bottom:6.2rem">
          <p class="text-3xl">🏝️</p>
          <p class="mt-1 font-extrabold">Tu isla está vacía</p>
          <p class="mt-0.5 text-sm text-ink/60">Termina una tarea y brotará algo.</p>
          <button data-act="focus" class="press mt-3 rounded-2xl bg-moss px-5 py-2.5 font-bold text-white">Ir a Foco</button>
        </div>
        <div data-info class="absolute inset-x-4 mx-auto max-w-md" style="bottom:5.6rem"></div>
        <div class="pointer-events-none absolute inset-x-4 bottom-4 mx-auto flex max-w-md justify-between rounded-full bg-paper/80 px-4 py-1.5 shadow backdrop-blur" aria-label="Rondas necesarias por planta">${legend}</div>
      </div>`;
    sky = root.querySelector('.garden-sky');
    stage = root.querySelector('[data-stage]');

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'focus') navigate('focus');
      if (act === 'close') scene?.deselect();
    });

    new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      scene?.resize(width, height);
    }).observe(stage);

    createGardenScene(stage, { onSelect: (id) => select(id) })
      .then((createdScene) => {
        scene = createdScene;
        scene.setLook(GARDEN_LOOKS[period]);
        scene.sync(plots);
        const r = stage.getBoundingClientRect();
        scene.resize(r.width, r.height);
      })
      .catch((err) => {
        console.warn('Three.js no disponible, uso la vista 2D', err);
        fallback = true;
        update(root, store.state);
      });

    document.addEventListener('visibilitychange', onVisibility);
    periodTimer = setInterval(applyPeriod, PERIOD_CHECK_MS);
  }

  function onVisibility() {
    if (!document.hidden) applyPeriod();
  }

  function update(root, state) {
    plots = gardenPlots(state);
    const n = plots.length;
    root.querySelector('[data-sub]').textContent =
      n ? `${n} ${n === 1 ? 'planta' : 'plantas'} · 🍅 ${state.rounds.length} rondas` : 'Aún sin plantas';
    root.querySelector('[data-empty]').classList.toggle('hidden', n > 0);
    scene?.sync(plots);
    if (selected && !plots.some((p) => p.id === selected)) select(null);
    if (fallback) renderFallback();
  }

  return mountView(root, {
    setup,
    update,
    teardown() {
      scene?.dispose();
      clearInterval(periodTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  });
}
