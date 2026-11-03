// Vista "Estadísticas": KPIs, distribución por tipo (dona) y tendencia de 7 días (barras apiladas). SVG puro.
import { TASK_TYPES, computeStats, hasLocalData } from '../core/rules.js';
import { mountView } from '../ui/view.js';
import { esc, navigate } from '../ui/util.js';

/** Sin datos locales no hay nada que contar: invita a cargar los de ejemplo, que viven en Ajustes. */
const emptyState = () => `
  <section class="mx-5 mt-4 rounded-3xl border border-line bg-paper p-5 text-center">
    <p class="text-5xl" aria-hidden="true">📊</p>
    <h2 class="mt-2 text-lg font-extrabold">Aún no hay nada que contar</h2>
    <p class="mt-1 text-sm font-medium text-ink/60">Termina una tarea con rondas de enfoque y aquí verás tu avance.</p>
    <button data-act="settings" class="press mt-4 min-h-11 rounded-full border border-line bg-cream px-5 py-2.5 text-[15px] font-bold text-moss">Cargar datos de ejemplo en Ajustes</button>
  </section>`;

const kpi = (emoji, value, label) => `
  <div class="rounded-2xl border border-line bg-paper p-3.5">
    <p class="text-xl">${emoji}</p>
    <p class="mt-1 text-[28px] font-extrabold leading-none tabular-nums">${value}</p>
    <p class="mt-1 text-xs font-semibold text-ink/50">${label}</p>
  </div>`;

function donut(byType, total) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const used = TASK_TYPES.filter((t) => byType[t.id] > 0);
  const gap = used.length > 1 ? 2.5 : 0;
  let acc = 0;
  const segments = used.map((t) => {
    const len = (C * byType[t.id]) / total;
    const seg = Math.max(0, len - gap);
    const svg = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${t.color}" stroke-width="14"
      stroke-dasharray="${seg} ${C - seg}" stroke-dashoffset="${-acc}"/>`;
    acc += len;
    return svg;
  }).join('');
  return `
    <div class="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" class="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r="${R}" fill="none" stroke="#eadfc6" stroke-width="14"/>${segments}
      </svg>
      <div class="absolute inset-0 grid place-content-center text-center">
        <p class="text-[28px] font-extrabold leading-none tabular-nums">${total}</p>
        <p class="text-[11px] font-semibold text-ink/50">tareas</p>
      </div>
    </div>`;
}

function weekChart(days) {
  const W = 320, H = 170, top = 22, bottom = 30, side = 8;
  const plotH = H - top - bottom;
  const max = Math.max(3, ...days.map((d) => d.total));
  const slot = (W - side * 2) / days.length;
  const bw = Math.min(28, slot * 0.62);
  const base = top + plotH;

  const grid = [0, 0.5, 1].map((f) => {
    const y = base - plotH * f;
    return `<line x1="${side}" x2="${W - side}" y1="${y}" y2="${y}" stroke="#eadfc6" stroke-dasharray="3 4"/>`;
  }).join('');

  const bars = days.map((d, i) => {
    const x = side + slot * i + (slot - bw) / 2;
    const cx = x + bw / 2;
    const label = `<text x="${cx}" y="${H - 10}" text-anchor="middle" font-size="11"
      font-weight="${d.isToday ? 800 : 600}" fill="${d.isToday ? '#2f6f4e' : '#8a948d'}">${d.label}</text>`;
    if (!d.total) {
      return `<rect x="${x}" y="${base - 4}" width="${bw}" height="4" rx="2" fill="#eadfc6"/>${label}`;
    }
    const total = (plotH * d.total) / max;
    let y = base;
    const segs = TASK_TYPES.filter((t) => d.byType[t.id] > 0).map((t) => {
      const h = (plotH * d.byType[t.id]) / max;
      y -= h;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${t.color}"/>`;
    }).join('');
    return `
      <clipPath id="bar-${i}"><rect x="${x}" y="${base - total}" width="${bw}" height="${total}" rx="6"/></clipPath>
      <g style="transform-box:fill-box;transform-origin:50% 100%;animation:grow .6s ease-out ${i * 50}ms both">
        <g clip-path="url(#bar-${i})">${segs}</g>
      </g>
      <text x="${cx}" y="${base - total - 6}" text-anchor="middle" font-size="11" font-weight="800" fill="#23312b">${d.total}</text>${label}`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="w-full" role="img" aria-label="Tareas completadas por día">${grid}${bars}</svg>`;
}

function onClick(e) {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'settings') navigate('settings');
}

function update(root, state) {
  const s = computeStats(state);
  const total = s.doneCount;
  const top = TASK_TYPES.slice().sort((a, b) => s.byType[b.id] - s.byType[a.id])[0];
  const prevScroll = root.querySelector('.scroll')?.scrollTop ?? 0;

  const rows = TASK_TYPES.map((t) => {
    const n = s.byType[t.id];
    const pct = total ? Math.round((n / total) * 100) : 0;
    return `<li class="flex items-center gap-2 text-sm">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:${t.color}"></span>
      <span class="flex-1 truncate font-semibold">${t.emoji} ${esc(t.short ?? t.label)}</span>
      <span class="font-bold tabular-nums">${n}</span>
      <span class="w-9 text-right text-xs font-semibold text-ink/40 tabular-nums">${pct}%</span></li>`;
  }).join('');

  root.innerHTML = `
    <div class="scroll page absolute inset-0 pb-8">
      <header class="pad-top px-5">
        <h1 class="text-[34px] font-extrabold leading-tight tracking-tight">Estadísticas</h1>
        <p class="text-sm font-medium text-ink/60">Cómo repartes tu energía.</p>
      </header>

      ${hasLocalData(state) ? '' : emptyState()}

      <div class="mx-5 mt-4 grid grid-cols-2 gap-3">
        ${kpi('✅', s.doneCount, 'Tareas terminadas')}
        ${kpi('🍅', s.rounds, 'Rondas de pomodoro')}
        ${kpi('⏱️', s.focusMinutes, 'Minutos de foco')}
        ${kpi('🔥', s.streak, s.streak === 1 ? 'Día de racha' : 'Días de racha')}
      </div>

      <section class="mx-5 mt-4 rounded-3xl border border-line bg-paper p-4">
        <h2 class="text-base font-extrabold">Por tipo</h2>
        <div class="mt-3 flex items-center gap-4">
          ${donut(s.byType, total)}
          <ul class="min-w-0 flex-1 space-y-2">${rows}</ul>
        </div>
        <p class="mt-3 text-xs font-medium text-ink/50">${total ? `Más activo en ${top.emoji} ${esc(top.label)}.` : 'Aún no hay tareas terminadas.'}</p>
      </section>

      <section class="mx-5 mt-4 rounded-3xl border border-line bg-paper p-4">
        <h2 class="text-base font-extrabold">Últimos 7 días</h2>
        <p class="mb-1 text-xs font-medium text-ink/50">Tareas terminadas por día, por tipo.</p>
        ${weekChart(s.days)}
        <div class="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
          ${TASK_TYPES.map((t) => `<span class="flex items-center gap-1 text-[11px] font-semibold text-ink/60"><i class="h-2 w-2 rounded-full" style="background:${t.color}"></i>${esc(t.label)}</span>`).join('')}
        </div>
      </section>
    </div>`;
  root.querySelector('.scroll').scrollTop = prevScroll;
}

export function mountStatsView(root) {
  return mountView(root, {
    setup: (root) => root.addEventListener('click', onClick),
    update,
  });
}
