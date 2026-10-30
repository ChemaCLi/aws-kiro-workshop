// <garden-view>: isla 3D a pantalla completa + tarjeta con la planta tocada.
// Si Three.js no carga (sin red), se muestra una cuadrícula de emojis.
import { store } from '../core/store.js';
import { StoreView } from '../ui/base.js';
import { PLANTS, TYPE_BY_ID, gardenPlots, relativeDay } from '../core/rules.js';
import { icon } from '../ui/icons.js';
import { esc, navigate } from '../ui/util.js';
import { createGardenScene } from '../three/garden-scene.js';

class GardenView extends StoreView {
  #scene = null;
  #plots = [];
  #selected = null;
  #fallback = false;

  setup() {
    const legend = PLANTS.map((p) => `
      <span class="flex flex-col items-center leading-tight"><span class="text-lg">${p.emoji}</span>
      <span class="text-[10px] font-bold text-ink/60">${p.rounds}${p.rounds === 6 ? '+' : ''}🍅</span></span>`).join('');

    this.innerHTML = `
      <div class="garden-sky absolute inset-0 overflow-hidden">
        <div data-stage class="absolute inset-0"></div>
        <header class="pad-top pointer-events-none absolute inset-x-0 top-0 px-5">
          <h1 class="text-[34px] font-extrabold leading-tight tracking-tight text-ink">Mi jardín</h1>
          <p data-sub class="text-sm font-semibold text-ink/60"></p>
        </header>
        <div data-empty class="pop absolute inset-x-5 mx-auto hidden max-w-md rounded-3xl bg-paper/90 p-4 text-center shadow-lg backdrop-blur" style="bottom:6.2rem">
          <p class="text-3xl">🏝️</p>
          <p class="mt-1 font-extrabold">Tu isla está vacía</p>
          <p class="mt-0.5 text-sm text-ink/60">Termina una tarea con al menos una ronda 🍅 y brotará algo.</p>
          <button data-act="focus" class="press mt-3 rounded-2xl bg-moss px-5 py-2.5 font-bold text-white">Ir a Foco</button>
        </div>
        <div data-info class="absolute inset-x-4 mx-auto max-w-md" style="bottom:5.6rem"></div>
        <div class="pointer-events-none absolute inset-x-4 bottom-4 mx-auto flex max-w-md justify-between rounded-full bg-paper/80 px-4 py-1.5 shadow backdrop-blur" aria-label="Rondas necesarias por planta">${legend}</div>
      </div>`;
    this.stage = this.querySelector('[data-stage]');

    this.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'focus') navigate('focus');
      if (act === 'close') this.#scene?.deselect();
    });

    new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      this.#scene?.resize(width, height);
    }).observe(this.stage);

    createGardenScene(this.stage, { onSelect: (id) => this.#select(id) })
      .then((scene) => {
        this.#scene = scene;
        scene.sync(this.#plots);
        const r = this.stage.getBoundingClientRect();
        scene.resize(r.width, r.height);
      })
      .catch((err) => {
        console.warn('Three.js no disponible, uso la vista 2D', err);
        this.#fallback = true;
        this.update(store.state);
      });
  }

  teardown() { this.#scene?.dispose(); }

  update(state) {
    this.#plots = gardenPlots(state);
    const n = this.#plots.length;
    this.querySelector('[data-sub]').textContent =
      n ? `${n} ${n === 1 ? 'planta' : 'plantas'} · 🍅 ${state.rounds.length} rondas` : 'Aún sin plantas';
    this.querySelector('[data-empty]').classList.toggle('hidden', n > 0);
    this.#scene?.sync(this.#plots);
    if (this.#selected && !this.#plots.some((p) => p.id === this.#selected)) this.#select(null);
    if (this.#fallback) this.#renderFallback();
  }

  #select(id) {
    this.#selected = id;
    const info = this.querySelector('[data-info]');
    const plot = this.#plots.find((p) => p.id === id);
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

  #renderFallback() {
    this.stage.innerHTML = `
      <div class="absolute inset-0 overflow-auto px-6 pb-40 pt-28 text-center">
        <p class="mb-4 text-xs font-semibold text-ink/50">No se pudo cargar el 3D (¿sin conexión?). Vista simplificada.</p>
        <div class="grid grid-cols-5 gap-3 text-4xl">${this.#plots.map((p) => `<span title="${esc(p.title)}">${p.plant.emoji}</span>`).join('')}</div>
      </div>`;
  }
}

customElements.define('garden-view', GardenView);
