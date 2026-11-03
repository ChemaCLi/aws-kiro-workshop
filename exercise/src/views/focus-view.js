// Vista "Foco": pomodoro de la tarea elegida. El reloj se calcula con `endsAt`,
// así sobrevive a cambiar de pestaña o recargar la página. Música, sonido y modo demo
// se ajustan en la vista de ajustes; aquí solo se avisa si el modo demo está activo.
import { store } from '../core/store.js';
import { mountView } from '../ui/view.js';
import { DURATIONS, PLANTS, TYPE_BY_ID, durationLabel, plantForRounds } from '../core/rules.js';
import { haptic, unlockAudio } from '../core/feedback.js';
import { icon } from '../ui/icons.js';
import { openSheet } from '../ui/sheet.js';
import { announceCompletion, esc, formatClock, navigate, toast } from '../ui/util.js';
import { openAddTask } from './add-sheet.js';

const RADIUS = 88;
const CIRC = 2 * Math.PI * RADIUS;
const PHASE = { idle: 'Listo para empezar', running: 'Enfocado', paused: 'En pausa', done: '¡Ronda completa!' };

function openPicker() {
  openSheet({
    title: 'Elige una tarea',
    render(body, close) {
      const pending = store.state.tasks.filter((x) => !x.doneAt).sort((a, b) => b.createdAt - a.createdAt);
      if (!pending.length) {
        body.innerHTML = `
          <p class="text-[15px] text-ink/60">No tienes tareas pendientes.</p>
          <button data-new class="press mt-4 w-full rounded-2xl bg-moss py-3.5 font-bold text-white">Crear una tarea</button>`;
        body.querySelector('[data-new]').onclick = () => { close(); setTimeout(openAddTask, 260); };
        return;
      }
      body.innerHTML = `<ul class="space-y-2">${pending.map((x) => {
        const ty = TYPE_BY_ID[x.type];
        return `<li><button data-id="${x.id}" class="press flex w-full items-center gap-3 rounded-2xl border border-line bg-cream p-3 text-left">
          <span class="grid h-10 w-10 place-items-center rounded-xl text-lg" style="background:${ty.color}26">${ty.emoji}</span>
          <span class="min-w-0 flex-1"><span class="block truncate font-bold">${esc(x.title)}</span>
          <span class="block text-xs font-medium text-ink/50">${esc(ty.label)} · 🍅 ${store.roundsOf(x.id)}</span></span></button></li>`;
      }).join('')}</ul>`;
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-id]');
        if (!b) return;
        store.selectTask(b.dataset.id);
        haptic(10);
        close();
      });
    },
  });
}

export function mountFocusView(root) {
  let paintTimer = 0;

  function paint() {
    if (root.hidden) return;
    const time = root.querySelector('[data-time]');
    const ring = root.querySelector('[data-ring]');
    if (!time || !ring) return;
    const { status, totalMs } = store.state.timer;
    const ms = store.remainingMs();
    time.textContent = formatClock(status === 'done' ? 0 : ms);
    const fraction = status === 'done' ? 0 : ms / totalMs;
    ring.style.strokeDashoffset = String(CIRC * (1 - fraction));
  }

  function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const t = store.state.timer;
    const task = store.taskById(t.taskId);

    switch (btn.dataset.act) {
      case 'pick':
        if (t.status === 'running' || t.status === 'paused') toast('Termina o reinicia la ronda para cambiar de tarea');
        else openPicker();
        break;
      case 'toggle':
        if (!task) { openPicker(); break; }
        unlockAudio();
        haptic(12);
        if (t.status === 'running') store.pause(); else store.start();
        break;
      case 'again':
        unlockAudio();
        store.start();
        break;
      case 'cancel': store.cancel(); break;
      case 'complete': if (task) announceCompletion(store.completeTask(task.id)); break;
      case 'duration':
        if (store.setDuration(Number(btn.dataset.min))) haptic(8);
        break;
      case 'settings': navigate('settings'); break;
    }
  }

  function update(root, state) {
    const t = state.timer;
    const task = store.taskById(t.taskId);
    const type = task ? TYPE_BY_ID[task.type] : null;
    const n = task ? store.roundsOf(task.id) : 0;
    const color = type?.color ?? '#9aa79f';
    const locked = t.status === 'running' || t.status === 'paused';
    const plant = plantForRounds(n);
    const next = plantForRounds(Math.min(n + 1, PLANTS.length));

    const strip = PLANTS.map((p) => {
      const reached = n >= p.rounds && !(p.rounds === 6 && n < 6);
      const current = plant?.kind === p.kind;
      const cls = current ? 'bg-moss/10 ring-2 ring-moss' : reached ? 'bg-moss/10' : 'opacity-40 grayscale';
      return `<div class="flex flex-col items-center gap-1">
        <span class="grid h-10 w-10 place-items-center rounded-full text-lg ${cls}">${p.emoji}</span>
        <span class="text-[10px] font-bold text-ink/50">${p.rounds}${p.rounds === 6 ? '+' : ''}</span></div>`;
    }).join('');

    const hint = !task ? 'Elige una tarea y cada ronda la hará crecer.'
      : n === 0 ? 'Completa una ronda para sembrar 🌱'
      : n >= PLANTS.length ? `Ahora mismo: ${plant.emoji} ${plant.label}. ¡Nivel máximo!`
      : `Ahora mismo: ${plant.emoji} ${plant.label} · una ronda más: ${next.emoji} ${next.label}`;

    const controls = t.status === 'done' && task ? `
      <div class="pop mx-5 mt-6 rounded-3xl bg-moss p-5 text-white">
        <p class="text-lg font-extrabold">🎉 ¡Ronda completa!</p>
        <p class="mt-1 text-sm text-white/80">«${esc(task.title)}» lleva ${n} ${n === 1 ? 'ronda' : 'rondas'} → ${plant.emoji} ${plant.label}</p>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <button data-act="again" class="press rounded-2xl bg-white/20 py-3 font-bold">Otra ronda</button>
          <button data-act="complete" class="press rounded-2xl bg-white py-3 font-bold text-moss">Terminar ${plant.emoji}</button>
        </div>
      </div>` : `
      <div class="mt-6 flex items-center justify-center gap-7">
        <button data-act="cancel" aria-label="Reiniciar ronda" ${locked ? '' : 'disabled'}
          class="press grid h-14 w-14 place-items-center rounded-full border border-line bg-paper text-ink/70">${icon('reset', 'h-6 w-6')}</button>
        <button data-act="toggle" aria-label="${t.status === 'running' ? 'Pausar' : 'Iniciar'}"
          class="press grid h-20 w-20 place-items-center rounded-full text-white shadow-lg" style="background:${color}">
          ${icon(t.status === 'running' ? 'pause' : 'play', 'h-8 w-8')}</button>
        <button data-act="complete" aria-label="Terminar tarea" ${task ? '' : 'disabled'}
          class="press grid h-14 w-14 place-items-center rounded-full border border-line bg-paper text-moss">${icon('check', 'h-6 w-6')}</button>
      </div>`;

    const durationsLocked = locked || state.settings.demo;
    const durations = DURATIONS.map((min) => {
      const on = !state.settings.demo && state.settings.minutes === min;
      return `<button role="radio" aria-checked="${on}" data-act="duration" data-min="${min}" data-on="${on}"
        ${durationsLocked ? 'disabled' : ''} style="--c:${color}" aria-label="${min} ${min === 1 ? 'minuto' : 'minutos'}"
        class="chip press min-w-0 flex-1 rounded-full py-2 text-sm font-bold">${durationLabel(min)}</button>`;
    }).join('');

    const prevScroll = root.querySelector('.scroll')?.scrollTop ?? 0;
    root.innerHTML = `
      <div class="scroll page absolute inset-0 pb-8">
        <header class="pad-top px-5">
          <h1 class="text-[34px] font-extrabold leading-tight tracking-tight">Foco</h1>
          <p class="text-sm font-medium text-ink/60">Una tarea, una ronda a la vez.</p>
        </header>

        <div class="mx-5 mt-4">
          <button data-act="pick" class="press flex w-full items-center gap-3 rounded-2xl border border-line bg-paper p-3 text-left">
            <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl" style="background:${color}26">${type?.emoji ?? '🎯'}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-bold">${task ? esc(task.title) : 'Elige una tarea'}</span>
              <span class="block text-xs font-medium text-ink/50">${task ? `${esc(type.label)} · 🍅 ${n} ${n === 1 ? 'ronda' : 'rondas'}` : 'Toca para seleccionar'}</span>
            </span>
            <span class="text-ink/30">${icon('chevron', 'h-5 w-5')}</span>
          </button>
        </div>

        <div class="mx-5 mt-4">
          <div class="mb-1.5 flex items-center justify-between px-1">
            <p class="text-xs font-bold uppercase tracking-wide text-ink/50">Duración · minutos</p>
            ${state.settings.demo ? `<p class="flex items-center gap-2 text-xs font-semibold text-moss">Modo demo
              <button data-act="settings" class="press min-h-11 px-1 font-bold underline underline-offset-2">Cambiar en Ajustes</button></p>` : ''}
          </div>
          <div class="flex gap-1.5" role="radiogroup" aria-label="Duración de la ronda">${durations}</div>
        </div>

        <div class="relative mx-auto mt-5 grid place-items-center" style="width:min(68vw,270px);aspect-ratio:1/1">
          <svg viewBox="0 0 200 200" class="h-full w-full -rotate-90">
            <circle cx="100" cy="100" r="${RADIUS}" fill="none" stroke="#eadfc6" stroke-width="12"/>
            <circle data-ring cx="100" cy="100" r="${RADIUS}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
              stroke-dasharray="${CIRC}" stroke-dashoffset="0" style="transition: stroke-dashoffset .25s linear, stroke .3s"/>
          </svg>
          <div class="absolute inset-0 grid place-content-center text-center">
            <p data-time class="text-[52px] font-extrabold leading-none tabular-nums">${formatClock(t.totalMs)}</p>
            <p class="mt-2 text-sm font-semibold text-ink/50">${PHASE[t.status]}</p>
          </div>
        </div>

        ${controls}

        <div class="mx-5 mt-6 rounded-2xl border border-line bg-paper p-3">
          <div class="flex items-center justify-between px-1">${strip}</div>
          <p class="mt-2 text-center text-xs font-medium text-ink/60">${hint}</p>
        </div>
      </div>`;
    root.querySelector('.scroll').scrollTop = prevScroll;
    paint();
  }

  return mountView(root, {
    setup(root) {
      root.addEventListener('click', onClick);
      paintTimer = setInterval(paint, 250);
    },
    update,
    teardown() { clearInterval(paintTimer); },
  });
}
