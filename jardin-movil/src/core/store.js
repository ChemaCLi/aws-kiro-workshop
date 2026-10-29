// Estado único de la app. Se persiste en localStorage y notifica cambios por evento.
// Guardamos hechos (tareas, rondas terminadas); el jardín y las estadísticas se derivan.
import { DEFAULT_MINUTES, DURATIONS, plantForRounds } from './rules.js';

const KEY = 'jardin-movil:v1';
export const DEMO_MS = 10 * 1000;

/** Duración de una ronda según los ajustes: el modo demo manda sobre los minutos elegidos. */
export const roundMs = (settings) => (settings.demo ? DEMO_MS : settings.minutes * 60_000);

// crypto.randomUUID no existe en http://IP-local (contexto no seguro): hay respaldo.
const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const freshState = (settings = {}) => {
  const s = { demo: false, sound: true, music: false, minutes: DEFAULT_MINUTES, ...settings };
  if (!DURATIONS.includes(s.minutes)) s.minutes = DEFAULT_MINUTES; // datos viejos o corruptos
  const total = roundMs(s);
  return {
    tasks: [],   // { id, title, type, createdAt, doneAt|null }
    rounds: [],  // { id, taskId, at, seconds }
    timer: { taskId: null, status: 'idle', totalMs: total, remainingMs: total, endsAt: null },
    settings: s,
  };
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const p = JSON.parse(raw);
    const base = freshState(p.settings);
    return {
      tasks: Array.isArray(p.tasks) ? p.tasks : [],
      rounds: Array.isArray(p.rounds) ? p.rounds : [],
      settings: base.settings,
      timer: { ...base.timer, ...(p.timer ?? {}) },
    };
  } catch {
    return freshState();
  }
}

class Store extends EventTarget {
  state = load();
  #queued = false;

  constructor() {
    super();
    const t = this.state.timer;
    if (t.taskId && !this.taskById(t.taskId)) this.#resetTimer(false);
  }

  // ----- lectura -----
  subscribe(fn) {
    const handler = () => fn(this.state);
    this.addEventListener('change', handler);
    fn(this.state);
    return () => this.removeEventListener('change', handler);
  }
  taskById(id) { return this.state.tasks.find((t) => t.id === id) ?? null; }
  roundsOf(id) { return this.state.rounds.filter((r) => r.taskId === id).length; }
  remainingMs(now = Date.now()) {
    const t = this.state.timer;
    return t.status === 'running' ? Math.max(0, t.endsAt - now) : t.remainingMs;
  }

  // ----- tareas -----
  addTask({ title, type }) {
    const clean = String(title ?? '').trim().slice(0, 80);
    if (!clean) return null;
    const task = { id: uid(), title: clean, type, createdAt: Date.now(), doneAt: null };
    this.state.tasks.push(task);
    this.#commit();
    return task;
  }

  /** Devuelve una instantánea para poder deshacer. */
  removeTask(id) {
    const task = this.taskById(id);
    if (!task) return null;
    const snapshot = { task, rounds: this.state.rounds.filter((r) => r.taskId === id) };
    this.state.tasks = this.state.tasks.filter((t) => t.id !== id);
    this.state.rounds = this.state.rounds.filter((r) => r.taskId !== id);
    if (this.state.timer.taskId === id) this.#resetTimer(false);
    this.#commit();
    return snapshot;
  }

  restore(snapshot) {
    if (!snapshot || this.taskById(snapshot.task.id)) return;
    this.state.tasks.push(snapshot.task);
    this.state.rounds.push(...snapshot.rounds);
    this.#commit();
  }

  completeTask(id) {
    const task = this.taskById(id);
    if (!task || task.doneAt) return null;
    task.doneAt = Date.now();
    if (this.state.timer.taskId === id) this.#resetTimer(false);
    this.#commit();
    const rounds = this.roundsOf(id);
    return { task, rounds, plant: plantForRounds(rounds) };
  }

  reopenTask(id) {
    const task = this.taskById(id);
    if (!task || !task.doneAt) return;
    task.doneAt = null;
    this.#commit();
  }

  // ----- pomodoro -----
  selectTask(id) {
    const t = this.state.timer;
    if (t.status === 'running' || t.status === 'paused') return t.taskId === id;
    const task = this.taskById(id);
    if (!task || task.doneAt) return false;
    t.taskId = id;
    this.#resetTimer(true);
    this.#commit();
    return true;
  }

  start() {
    const t = this.state.timer;
    const task = this.taskById(t.taskId);
    if (!task || task.doneAt) return false;
    if (t.status === 'running') return true;
    const ms = t.status === 'paused' ? t.remainingMs : t.totalMs;
    t.status = 'running';
    t.remainingMs = ms;
    t.endsAt = Date.now() + ms;
    this.#commit();
    return true;
  }

  pause() {
    const t = this.state.timer;
    if (t.status !== 'running') return;
    t.remainingMs = Math.max(0, t.endsAt - Date.now());
    t.endsAt = null;
    t.status = 'paused';
    this.#commit();
  }

  cancel() {
    this.#resetTimer(true);
    this.#commit();
  }

  tick(now = Date.now()) {
    const t = this.state.timer;
    if (t.status === 'running' && now >= t.endsAt) this.#finishRound();
  }

  #finishRound() {
    const t = this.state.timer;
    const task = this.taskById(t.taskId);
    if (!task) { this.#resetTimer(false); this.#commit(); return; }
    this.state.rounds.push({ id: uid(), taskId: task.id, at: Date.now(), seconds: Math.round(t.totalMs / 1000) });
    t.status = 'done';
    t.endsAt = null;
    t.remainingMs = 0;
    this.#commit();
    this.dispatchEvent(new CustomEvent('round', { detail: { taskId: task.id, count: this.roundsOf(task.id) } }));
  }

  #resetTimer(keepTask) {
    const t = this.state.timer;
    t.status = 'idle';
    t.endsAt = null;
    t.totalMs = roundMs(this.state.settings);
    t.remainingMs = t.totalMs;
    if (!keepTask) t.taskId = null;
  }

  // ----- ajustes y datos -----
  setSetting(key, value) {
    this.state.settings[key] = value;
    if (key === 'demo') {
      const t = this.state.timer;
      if (t.status === 'idle') this.#resetTimer(true);
      else if (t.status === 'done') t.totalMs = roundMs(this.state.settings);
    }
    this.#commit();
  }

  /** Cambia la duración de la ronda. No se permite con una ronda en curso o en pausa. */
  setDuration(minutes) {
    const t = this.state.timer;
    if (!DURATIONS.includes(minutes) || t.status === 'running' || t.status === 'paused') return false;
    this.state.settings.minutes = minutes;
    if (t.status === 'idle') this.#resetTimer(true);
    else t.totalMs = roundMs(this.state.settings); // 'done': aplica a la siguiente ronda
    this.#commit();
    return true;
  }

  reset() {
    this.state = freshState(this.state.settings);
    this.#commit();
  }

  /** Datos de ejemplo para enseñar las gráficas y el jardín sin esperar. */
  seedDemo() {
    const now = Date.now();
    const DAY = 86_400_000;
    const MIN = 60_000;
    const s = freshState(this.state.settings);
    // [título, tipo, rondas, hace cuántos días]
    const done = [
      ['Terminar slides del workshop', 'trabajo', 4, 0],
      ['Revisar pull requests', 'trabajo', 2, 0],
      ['Correr 5 km', 'salud', 3, 0],
      ['Leer 20 páginas', 'personal', 1, 1],
      ['Cena con amigos', 'social', 1, 1],
      ['Sesión de yoga', 'salud', 5, 2],
      ['Escribir documentación', 'trabajo', 6, 2],
      ['Jugar una partida', 'ocio', 2, 3],
      ['Ordenar el escritorio', 'personal', 2, 3],
      ['Llamar a mamá', 'social', 1, 4],
      ['Preparar demo en vivo', 'trabajo', 7, 5],
      ['Cocinar para la semana', 'personal', 3, 5],
      ['Serie con calma', 'ocio', 1, 6],
      ['Caminata en el parque', 'salud', 4, 6],
    ];
    done.forEach(([title, type, rounds, ago], i) => {
      const id = uid();
      const doneAt = now - ago * DAY - (i % 4) * 25 * MIN - 5 * MIN;
      s.tasks.push({ id, title, type, createdAt: doneAt - 180 * MIN, doneAt });
      for (let k = 0; k < rounds; k++) {
        s.rounds.push({ id: uid(), taskId: id, at: doneAt - (rounds - 1 - k) * 30 * MIN - 2 * MIN, seconds: 1500 });
      }
    });
    const pendingId = uid();
    s.tasks.push({ id: uid(), title: 'Preparar café para la meet', type: 'personal', createdAt: now - 60 * MIN, doneAt: null });
    s.tasks.push({ id: pendingId, title: 'Ensayar la presentación', type: 'trabajo', createdAt: now - 120 * MIN, doneAt: null });
    s.rounds.push({ id: uid(), taskId: pendingId, at: now - 40 * MIN, seconds: 1500 });
    s.rounds.push({ id: uid(), taskId: pendingId, at: now - 10 * MIN, seconds: 1500 });
    this.state = s;
    this.#commit();
  }

  #commit() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* modo privado */ }
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => { this.#queued = false; this.dispatchEvent(new Event('change')); });
  }
}

export const store = new Store();
window.__store = store; // para depurar en vivo durante el workshop
