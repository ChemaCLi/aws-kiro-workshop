// pomodoro-timer.js
// Web Component <pomodoro-timer>: cuenta regresiva enfocada en una tarea.
// Al terminar una ronda suma al store (brota pasto) y ofrece completar la tarea.
// Para el workshop la ronda dura 25 min pero hay un botón "modo demo" de 10s.
import { store, TASK_TYPES } from '../store.js';

const FULL_ROUND = 25 * 60; // segundos
const DEMO_ROUND = 10;      // segundos, para mostrar en vivo

class PomodoroTimer extends HTMLElement {
  connectedCallback() {
    this.duration = FULL_ROUND;
    this.remaining = this.duration;
    this.running = false;
    this.focusId = null;
    this.tickHandle = null;

    this.render();

    this._onFocus = (e) => this.setFocus(e.detail.id);
    document.addEventListener('pomodoro:focus', this._onFocus);

    this._onTasks = () => this.renderFocusLabel();
    store.addEventListener('tasks:changed', this._onTasks);
  }

  disconnectedCallback() {
    document.removeEventListener('pomodoro:focus', this._onFocus);
    store.removeEventListener('tasks:changed', this._onTasks);
    clearInterval(this.tickHandle);
  }

  setFocus(id) {
    this.focusId = id;
    this.reset();
    this.renderFocusLabel();
  }

  render() {
    this.innerHTML = `
      <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 shadow-xl backdrop-blur">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold flex items-center gap-2">🍅 Pomodoro</h2>
          <label class="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer">
            <input id="demo" type="checkbox" class="accent-indigo-500" />
            modo demo (10s)
          </label>
        </div>

        <p id="focus-label" class="text-sm text-slate-400 mb-3">Sin tarea enfocada.</p>

        <div class="flex flex-col items-center gap-4">
          <div class="relative w-44 h-44">
            <svg viewBox="0 0 120 120" class="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.15)" stroke-width="10" />
              <circle id="ring" cx="60" cy="60" r="52" fill="none" stroke="#6366f1" stroke-width="10"
                      stroke-linecap="round" stroke-dasharray="326.7" stroke-dashoffset="0" />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span id="time" class="text-3xl font-extrabold tabular-nums">25:00</span>
              <span class="text-[11px] text-slate-500">enfoque</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button id="start"
              class="bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition rounded-xl px-5 py-2.5 text-sm font-semibold">
              Iniciar
            </button>
            <button id="reset-timer"
              class="bg-slate-700/70 hover:bg-slate-600 transition rounded-xl px-4 py-2.5 text-sm font-medium">
              Reiniciar
            </button>
          </div>
        </div>
      </div>
    `;

    this.timeEl = this.querySelector('#time');
    this.ringEl = this.querySelector('#ring');
    this.startBtn = this.querySelector('#start');

    this.startBtn.addEventListener('click', () => this.toggle());
    this.querySelector('#reset-timer').addEventListener('click', () => this.reset());
    this.querySelector('#demo').addEventListener('change', (e) => {
      this.duration = e.target.checked ? DEMO_ROUND : FULL_ROUND;
      this.reset();
    });

    this.renderClock();
  }

  renderFocusLabel() {
    const label = this.querySelector('#focus-label');
    if (!label) return;
    const task = this.focusId ? store.getTask(this.focusId) : null;
    if (!task) {
      this.focusId = null;
      label.innerHTML = 'Sin tarea enfocada. Pulsa <span class="text-slate-300">🍅 Enfocar</span> en una tarea.';
      return;
    }
    const meta = TASK_TYPES[task.type];
    label.innerHTML = `Enfocando: <span class="font-medium text-slate-200">${meta.emoji} ${escapeHtml(task.title)}</span>`;
  }

  toggle() {
    if (!this.focusId || !store.getTask(this.focusId)) {
      this.flashFocusHint();
      return;
    }
    this.running ? this.pause() : this.start();
  }

  start() {
    this.running = true;
    this.startBtn.textContent = 'Pausar';
    this.startBtn.classList.replace('bg-indigo-600', 'bg-amber-600');
    this.startBtn.classList.replace('hover:bg-indigo-500', 'hover:bg-amber-500');
    const started = Date.now();
    const base = this.remaining;
    this.tickHandle = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      this.remaining = Math.max(0, base - elapsed);
      this.renderClock();
      if (this.remaining <= 0) this.finishRound();
    }, 200);
  }

  pause() {
    this.running = false;
    clearInterval(this.tickHandle);
    this.startBtn.textContent = 'Iniciar';
    this.startBtn.classList.replace('bg-amber-600', 'bg-indigo-600');
    this.startBtn.classList.replace('hover:bg-amber-500', 'hover:bg-indigo-500');
  }

  reset() {
    this.pause();
    this.remaining = this.duration;
    this.renderClock();
  }

  finishRound() {
    this.pause();
    if (this.focusId) {
      store.addRound(this.focusId);
      this.celebrate();
      const task = store.getTask(this.focusId);
      if (task && confirm(`¡Ronda completa! 🍅\n\n¿Marcar "${task.title}" como terminada?`)) {
        store.completeTask(this.focusId);
        this.focusId = null;
        this.renderFocusLabel();
      }
    }
    this.remaining = this.duration;
    this.renderClock();
  }

  celebrate() {
    this.ringEl.animate(
      [{ stroke: '#22c55e' }, { stroke: '#6366f1' }],
      { duration: 900, easing: 'ease-out' }
    );
  }

  flashFocusHint() {
    const label = this.querySelector('#focus-label');
    label.animate(
      [{ color: '#f43f5e' }, { color: '' }],
      { duration: 700 }
    );
  }

  renderClock() {
    const m = String(Math.floor(this.remaining / 60)).padStart(2, '0');
    const s = String(this.remaining % 60).padStart(2, '0');
    this.timeEl.textContent = `${m}:${s}`;
    const pct = this.duration > 0 ? this.remaining / this.duration : 0;
    const circumference = 2 * Math.PI * 52; // ≈ 326.7
    this.ringEl.style.strokeDashoffset = String(circumference * (1 - pct));
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

customElements.define('pomodoro-timer', PomodoroTimer);
