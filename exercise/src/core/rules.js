// Reglas de negocio puras: sin DOM y sin storage. Se leen (y se testean) solas.

export const TASK_TYPES = [
  { id: 'trabajo',  label: 'Trabajo',         emoji: '💼', color: '#4f8ef7' },
  { id: 'personal', label: 'Personal',        emoji: '🏡', color: '#ec6fa8' },
  { id: 'salud',    label: 'Salud',           emoji: '💪', color: '#3fb56b' },
  { id: 'social',   label: 'Social',          emoji: '👥', color: '#f0a52a' },
  { id: 'ocio',     label: 'Entretenimiento', short: 'Ocio', emoji: '🎮', color: '#8b6cf0' },
];
export const TYPE_BY_ID = Object.fromEntries(TASK_TYPES.map((t) => [t.id, t]));

/** Una tarea terminada con N rondas de pomodoro se convierte en esta planta. */
export const PLANTS = [
  { kind: 'grass',     rounds: 1, emoji: '🌱', label: 'Pasto' },
  { kind: 'flower',    rounds: 2, emoji: '🌼', label: 'Flor' },
  { kind: 'bush',      rounds: 3, emoji: '🌿', label: 'Arbusto' },
  { kind: 'tree',      rounds: 4, emoji: '🌳', label: 'Árbol' },
  { kind: 'butterfly', rounds: 5, emoji: '🦋', label: 'Mariposa' },
  { kind: 'sakura',    rounds: 6, emoji: '🌸', label: 'Sakura' },
];

/** Duraciones de ronda disponibles, en minutos. */
export const DURATIONS = [5, 10, 15, 25, 35, 45, 60];
export const DEFAULT_MINUTES = 25;
export const durationLabel = (min) => (min === 60 ? '1 h' : String(min));

export const plantForRounds = (rounds) =>
  rounds >= 1 ? PLANTS[Math.min(rounds, PLANTS.length) - 1] : null;

// ---------- Selectores sobre el estado ----------

export function roundsByTask(state) {
  const map = new Map();
  for (const r of state.rounds) map.set(r.taskId, (map.get(r.taskId) ?? 0) + 1);
  return map;
}

/** El jardín se deriva del estado: una parcela por tarea terminada con al menos 1 ronda. */
export function gardenPlots(state) {
  const rounds = roundsByTask(state);
  return state.tasks
    .filter((t) => t.doneAt && (rounds.get(t.id) ?? 0) > 0)
    .sort((a, b) => a.doneAt - b.doneAt || a.id.localeCompare(b.id))
    .map((t) => {
      const n = rounds.get(t.id);
      return { id: t.id, title: t.title, type: t.type, doneAt: t.doneAt, rounds: n, plant: plantForRounds(n) };
    });
}

// ---------- Fechas ----------

const DAY = 86_400_000;
export const dayStart = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };

export function relativeDay(ts, now = Date.now()) {
  const diff = Math.round((dayStart(now) - dayStart(ts)) / DAY);
  if (diff <= 0) return 'hoy';
  if (diff === 1) return 'ayer';
  return `hace ${diff} días`;
}

export function lastDays(count, now = Date.now()) {
  const today = dayStart(now);
  const fmt = new Intl.DateTimeFormat('es-MX', { weekday: 'narrow' });
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(today, i - (count - 1));
    return { start, end: addDays(start, 1), label: fmt.format(start), isToday: start === today };
  });
}

// ---------- Estadísticas ----------

export function computeStats(state, now = Date.now()) {
  const zero = () => Object.fromEntries(TASK_TYPES.map((t) => [t.id, 0]));
  const done = state.tasks.filter((t) => t.doneAt);
  const byType = zero();
  for (const t of done) byType[t.type] = (byType[t.type] ?? 0) + 1;

  const days = lastDays(7, now).map((d) => ({ ...d, byType: zero(), total: 0 }));
  for (const t of done) {
    const day = days.find((d) => t.doneAt >= d.start && t.doneAt < d.end);
    if (day) { day.byType[t.type] += 1; day.total += 1; }
  }

  const activeDays = new Set(state.rounds.map((r) => dayStart(r.at)));
  let cursor = dayStart(now);
  if (!activeDays.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (activeDays.has(cursor)) { streak += 1; cursor = addDays(cursor, -1); }

  return {
    doneCount: done.length,
    totalCount: state.tasks.length,
    rounds: state.rounds.length,
    roundsToday: state.rounds.filter((r) => r.at >= dayStart(now)).length,
    focusMinutes: Math.round(state.rounds.reduce((sum, r) => sum + r.seconds, 0) / 60),
    streak,
    byType,
    days,
  };
}

// ---------- Geometría del jardín ----------

/** Celdas en espiral desde el centro: 0 -> (0,0), 1..8 -> anillo 1, 9..24 -> anillo 2... */
export function spiralCell(i) {
  if (i === 0) return [0, 0];
  let ring = 1;
  let start = 1;
  while (i >= start + 8 * ring) { start += 8 * ring; ring += 1; }
  const j = i - start;
  const side = 2 * ring;
  if (j < side) return [-ring + j, -ring];
  if (j < 2 * side) return [ring, -ring + (j - side)];
  if (j < 3 * side) return [ring - (j - 2 * side), ring];
  return [-ring, ring - (j - 3 * side)];
}

/** Lado (impar) de la isla: crece con las plantas y siempre deja un anillo de tierra libre. */
export function islandSizeFor(count) {
  const ring = count <= 1 ? 0 : Math.ceil((Math.sqrt(count) - 1) / 2);
  return 2 * Math.max(3, ring + 1) + 1;
}
