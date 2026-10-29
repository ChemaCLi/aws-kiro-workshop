// trends-chart.js
// Web Component <trends-chart>: barras por tipo de tarea completada.
// SVG puro, sin librerías de charts, para no agregar dependencias.
import { store, TASK_TYPES } from '../store.js';

class TrendsChart extends HTMLElement {
  connectedCallback() {
    this.render();
    this._onChange = () => this.renderBars();
    store.addEventListener('tasks:changed', this._onChange);
  }

  disconnectedCallback() {
    store.removeEventListener('tasks:changed', this._onChange);
  }

  render() {
    this.innerHTML = `
      <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 shadow-xl backdrop-blur">
        <h2 class="text-lg font-semibold flex items-center gap-2 mb-1">📊 Tendencias</h2>
        <p class="text-xs text-slate-500 mb-4">Tareas completadas por tipo.</p>
        <div id="bars" class="space-y-3"></div>
      </div>
    `;
    this.renderBars();
  }

  renderBars() {
    const wrap = this.querySelector('#bars');
    if (!wrap) return;
    const counts = store.countsByType();
    const max = Math.max(1, ...Object.values(counts));

    wrap.innerHTML = Object.entries(TASK_TYPES).map(([key, meta]) => {
      const n = counts[key] || 0;
      const pct = Math.round((n / max) * 100);
      return `
        <div class="flex items-center gap-3">
          <div class="w-28 shrink-0 text-xs text-slate-300">${meta.emoji} ${meta.label}</div>
          <div class="flex-1 h-5 rounded-full bg-slate-800 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500 ease-out"
                 style="width:${pct}%; background:${meta.color}"></div>
          </div>
          <div class="w-6 text-right text-xs tabular-nums text-slate-400">${n}</div>
        </div>
      `;
    }).join('');

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) {
      wrap.insertAdjacentHTML('beforeend',
        `<p class="text-center text-slate-600 text-xs pt-2">Aún no completas tareas.</p>`);
    }
  }
}

customElements.define('trends-chart', TrendsChart);
