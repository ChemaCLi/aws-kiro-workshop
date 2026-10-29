// task-list.js
// Web Component <task-list>: crear tareas, elegir tipo, marcar activa para el
// pomodoro, completar y borrar. Usa luz de Tailwind via clases en el markup.
import { store, TASK_TYPES, rewardForRounds, REWARD_META } from '../store.js';

class TaskList extends HTMLElement {
  connectedCallback() {
    this.render();
    this._onChange = () => this.renderList();
    store.addEventListener('tasks:changed', this._onChange);
  }

  disconnectedCallback() {
    store.removeEventListener('tasks:changed', this._onChange);
  }

  render() {
    const typeOptions = Object.entries(TASK_TYPES)
      .map(([k, v]) => `<option value="${k}">${v.emoji} ${v.label}</option>`)
      .join('');

    this.innerHTML = `
      <div class="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 shadow-xl backdrop-blur">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold flex items-center gap-2">📋 Tareas</h2>
          <button id="reset" class="text-xs text-slate-400 hover:text-rose-400 transition">
            Reiniciar todo
          </button>
        </div>

        <form id="add" class="flex flex-col sm:flex-row gap-2 mb-4">
          <input id="title" type="text" required placeholder="¿Qué quieres lograr?"
            class="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm
                   placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60" />
          <select id="type"
            class="bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500/60">
            ${typeOptions}
          </select>
          <button type="submit"
            class="bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition rounded-xl px-4 py-2.5
                   text-sm font-semibold shadow-lg shadow-indigo-900/40">
            Agregar
          </button>
        </form>

        <ul id="list" class="space-y-2"></ul>
      </div>
    `;

    this.querySelector('#add').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = this.querySelector('#title').value;
      const type = this.querySelector('#type').value;
      if (!title.trim()) return;
      store.addTask({ title, type });
      this.querySelector('#title').value = '';
      this.querySelector('#title').focus();
    });

    this.querySelector('#reset').addEventListener('click', () => {
      if (confirm('¿Borrar todas las tareas y el jardín?')) store.reset();
    });

    this.renderList();
  }

  renderList() {
    const list = this.querySelector('#list');
    if (!list) return;
    const tasks = store.tasks;

    if (tasks.length === 0) {
      list.innerHTML = `
        <li class="text-center text-slate-500 text-sm py-8">
          Sin tareas todavía. Agrega una y empieza un pomodoro 🍅
        </li>`;
      return;
    }

    list.innerHTML = tasks.map((t) => {
      const meta = TASK_TYPES[t.type];
      const nextReward = REWARD_META[rewardForRounds(Math.max(t.rounds, 1))];
      return `
        <li class="group flex items-center gap-3 rounded-xl border px-3 py-2.5 animate-fade-in
                   ${t.done ? 'bg-slate-800/30 border-slate-800 opacity-60' : 'bg-slate-800/60 border-slate-700'}">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${meta.color}"></span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate ${t.done ? 'line-through text-slate-400' : ''}">${escapeHtml(t.title)}</p>
            <p class="text-[11px] text-slate-500">
              ${meta.emoji} ${meta.label} · 🍅 ${t.rounds} ${t.rounds === 1 ? 'ronda' : 'rondas'}
              ${t.done ? `· 🌼 dio ${nextReward.emoji} ${nextReward.label}` : `· al completar: ${nextReward.emoji}`}
            </p>
          </div>
          ${t.done ? '' : `
            <button data-act="focus" data-id="${t.id}"
              class="text-xs px-2.5 py-1 rounded-lg bg-slate-700/70 hover:bg-indigo-600 transition">🍅 Enfocar</button>
            <button data-act="done" data-id="${t.id}"
              class="text-xs px-2.5 py-1 rounded-lg bg-slate-700/70 hover:bg-emerald-600 transition">✓</button>
          `}
          <button data-act="del" data-id="${t.id}"
            class="text-xs px-2 py-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-700/50 transition">✕</button>
        </li>
      `;
    }).join('');

    list.querySelectorAll('button[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        if (act === 'del') store.removeTask(id);
        if (act === 'done') store.completeTask(id);
        if (act === 'focus') {
          // Avisar al pomodoro qué tarea enfocar.
          document.dispatchEvent(new CustomEvent('pomodoro:focus', { detail: { id } }));
        }
      });
    });
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

customElements.define('task-list', TaskList);
