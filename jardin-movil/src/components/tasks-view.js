// <tasks-view>: lista de tareas. Toca el círculo para completar, ▶ para enfocar,
// desliza a la izquierda para eliminar (con deshacer).
import { store } from '../core/store.js';
import { StoreView } from '../ui/base.js';
import { TASK_TYPES, TYPE_BY_ID, computeStats, plantForRounds, roundsByTask } from '../core/rules.js';
import { icon } from '../ui/icons.js';
import { announceCompletion, esc, navigate, toast } from '../ui/util.js';
import { haptic } from '../core/feedback.js';
import { openAddTask } from './add-sheet.js';

const SWIPE_DELETE_PX = 90;

class TasksView extends StoreView {
  #filter = 'all';
  #seen = new Set();
  #drag = null;
  #swipedAt = 0;

  setup() {
    this.addEventListener('click', (e) => this.#onClick(e));
    this.addEventListener('pointerdown', (e) => this.#onDown(e));
    this.addEventListener('pointermove', (e) => this.#onMove(e));
    this.addEventListener('pointerup', (e) => this.#onUp(e));
    this.addEventListener('pointercancel', () => this.#cancelDrag());
  }

  update(state) {
    const prevScroll = this.querySelector('.scroll')?.scrollTop ?? 0;
    const rounds = roundsByTask(state);
    const stats = computeStats(state);
    const match = (t) => this.#filter === 'all' || t.type === this.#filter;
    const pending = state.tasks.filter((t) => !t.doneAt && match(t)).sort((a, b) => b.createdAt - a.createdAt);
    const done = state.tasks.filter((t) => t.doneAt && match(t)).sort((a, b) => b.doneAt - a.doneAt);
    const pct = stats.totalCount ? Math.round((stats.doneCount / stats.totalCount) * 100) : 0;
    const todayRaw = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

    const filters = [{ id: 'all', label: 'Todas', emoji: '✨', color: '#2f6f4e' }, ...TASK_TYPES].map((t) => `
      <button data-filter="${t.id}" data-on="${this.#filter === t.id}" style="--c:${t.color}"
        class="chip shrink-0 rounded-full px-3.5 py-2 text-sm font-bold">${t.emoji} ${esc(t.label)}</button>`).join('');

    const section = (title, list) => list.length ? `
      <h2 class="mb-2 mt-5 px-5 text-xs font-bold uppercase tracking-wide text-ink/50">${title} · ${list.length}</h2>
      <ul class="space-y-2 px-5">${list.map((t) => this.#row(t, rounds.get(t.id) ?? 0)).join('')}</ul>` : '';

    const empty = !pending.length && !done.length ? `
      <div class="mx-5 mt-10 text-center">
        <p class="text-5xl">🌱</p>
        <p class="mt-3 text-lg font-extrabold">${state.tasks.length ? 'Nada en este filtro' : 'Tu jardín empieza aquí'}</p>
        <p class="mt-1 text-sm text-ink/60">${state.tasks.length ? 'Prueba con otro tipo.' : 'Toca + para sembrar tu primera tarea.'}</p>
      </div>` : '';

    this.innerHTML = `
      <div class="scroll absolute inset-0 pb-32">
        <header class="pad-top px-5">
          <p class="text-sm font-semibold text-moss/70">${today}</p>
          <h1 class="text-[34px] font-extrabold leading-tight tracking-tight">Mis tareas</h1>
        </header>
        <section class="mx-5 mt-3 rounded-3xl bg-moss p-4 text-white">
          <div class="flex items-end justify-between">
            <div>
              <p class="text-sm font-semibold text-white/70">Progreso</p>
              <p class="text-[26px] font-extrabold leading-tight">${stats.doneCount} de ${stats.totalCount}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold text-white/70">Rondas hoy</p>
              <p class="text-[22px] font-extrabold leading-tight">🍅 ${stats.roundsToday}</p>
            </div>
          </div>
          <div class="mt-3 h-2 rounded-full bg-white/20"><div class="h-2 rounded-full bg-white transition-all duration-500" style="width:${pct}%"></div></div>
        </section>
        <div class="scroll mt-4 flex gap-2 px-5">${filters}</div>
        ${section('Pendientes', pending)}
        ${section('Completadas', done)}
        ${empty}
        ${pending.length ? '<p class="mt-6 text-center text-xs text-ink/40">Desliza a la izquierda para eliminar</p>' : ''}
      </div>
      <button data-act="add" aria-label="Nueva tarea"
        class="press absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full bg-moss text-white shadow-lg shadow-moss/30">
        ${icon('plus', 'h-7 w-7')}
      </button>`;

    this.querySelector('.scroll').scrollTop = prevScroll;
    for (const t of state.tasks) this.#seen.add(t.id);
  }

  #row(task, n) {
    const type = TYPE_BY_ID[task.type] ?? TASK_TYPES[0];
    const done = Boolean(task.doneAt);
    const plant = plantForRounds(n);
    return `
      <li class="swipe ${this.#seen.has(task.id) ? '' : 'pop'}" data-id="${task.id}">
        <div class="swipe-bg" aria-hidden="true">${icon('trash', 'h-6 w-6')}</div>
        <div class="swipe-fg flex items-center gap-1 rounded-[18px] border border-line bg-paper py-1.5 pl-1 pr-2">
          <button data-act="toggle" aria-label="${done ? 'Reabrir' : 'Completar'}" class="press grid h-11 w-11 shrink-0 place-items-center">
            <span class="grid h-[26px] w-[26px] place-items-center rounded-full border-2 text-white"
              style="border-color:${type.color};background:${done ? type.color : 'transparent'}">${done ? icon('check', 'h-4 w-4') : ''}</span>
          </button>
          <div class="min-w-0 flex-1 px-1">
            <p class="truncate text-[16px] font-bold ${done ? 'text-ink/40 line-through' : ''}">${esc(task.title)}</p>
            <p class="mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-ink/50">
              <span class="inline-block h-2 w-2 shrink-0 rounded-full" style="background:${type.color}"></span>${esc(type.label)}
              <span>·</span><span>🍅 ${n}</span>${done && plant ? `<span>· ${plant.emoji} ${plant.label}</span>` : ''}
            </p>
          </div>
          ${done ? '' : `<button data-act="focus" aria-label="Enfocar" class="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-moss/10 text-moss">${icon('play', 'h-4 w-4')}</button>`}
        </div>
      </li>`;
  }

  // ----- acciones -----
  #onClick(e) {
    if (performance.now() - this.#swipedAt < 350) return; // el tap viene de un swipe
    const filter = e.target.closest('[data-filter]');
    if (filter) { this.#filter = filter.dataset.filter; this.update(store.state); return; }

    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-id]')?.dataset.id;

    if (btn.dataset.act === 'add') return openAddTask();
    if (btn.dataset.act === 'toggle') {
      const task = store.taskById(id);
      if (task?.doneAt) { store.reopenTask(id); haptic(8); }
      else announceCompletion(store.completeTask(id));
    }
    if (btn.dataset.act === 'focus') {
      if (store.selectTask(id)) navigate('focus');
      else toast('Termina o reinicia la ronda actual para cambiar de tarea');
    }
  }

  // ----- swipe para eliminar -----
  #onDown(e) {
    const fg = e.target.closest('.swipe-fg');
    if (!fg || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.#drag = { fg, id: fg.closest('[data-id]').dataset.id, x0: e.clientX, y0: e.clientY, dx: 0, active: false, pid: e.pointerId };
  }

  #onMove(e) {
    const d = this.#drag;
    if (!d || e.pointerId !== d.pid) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        d.active = true;
        d.fg.setPointerCapture(d.pid);
        d.fg.style.transition = 'none';
        d.fg.parentElement.querySelector('.swipe-bg').style.opacity = '1';
      } else if (Math.abs(dy) > 10) { this.#drag = null; return; }
    }
    if (d.active) {
      d.dx = Math.min(0, dx);
      d.fg.style.transform = `translateX(${d.dx}px)`;
    }
  }

  #onUp(e) {
    const d = this.#drag;
    if (!d || e.pointerId !== d.pid) return;
    this.#drag = null;
    if (!d.active) return;
    this.#swipedAt = performance.now();
    d.fg.style.transition = 'transform .2s ease';
    if (d.dx < -SWIPE_DELETE_PX) {
      d.fg.style.transform = 'translateX(-110%)';
      haptic(15);
      setTimeout(() => {
        const snapshot = store.removeTask(d.id);
        toast('Tarea eliminada', { action: { label: 'Deshacer', run: () => store.restore(snapshot) }, duration: 4200 });
      }, 180);
    } else {
      d.fg.style.transform = '';
      d.fg.parentElement.querySelector('.swipe-bg').style.opacity = '0';
    }
  }

  #cancelDrag() {
    const d = this.#drag;
    this.#drag = null;
    if (d?.active) {
      d.fg.style.transition = 'transform .2s ease';
      d.fg.style.transform = '';
      d.fg.parentElement.querySelector('.swipe-bg').style.opacity = '0';
    }
  }
}

customElements.define('tasks-view', TasksView);
