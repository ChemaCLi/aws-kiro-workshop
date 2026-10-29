// store.js
// Estado central de la app con persistencia en localStorage y un bus de eventos
// sencillo basado en EventTarget. Todos los componentes leen y escriben aquí.

const STORAGE_KEY = 'jardin-tareas:v1';

/** Catálogo de tipos de tarea. El color se usa en UI y en el jardín 3D. */
export const TASK_TYPES = {
  work:     { label: 'Trabajo',       emoji: '💼', color: '#6366f1' },
  personal: { label: 'Personal',      emoji: '🏠', color: '#ec4899' },
  health:   { label: 'Salud',         emoji: '💪', color: '#22c55e' },
  social:   { label: 'Social',        emoji: '🫂', color: '#f59e0b' },
  fun:      { label: 'Entretenimiento', emoji: '🎮', color: '#06b6d4' },
};

/**
 * Recompensa del jardín según cuántas rondas de pomodoro llevó la tarea.
 * 1=pasto, 2=flor, 3=arbusto, 4=árbol, 5=mariposa, 6+=sakura.
 */
export const REWARD_BY_ROUNDS = {
  1: 'grass',
  2: 'flower',
  3: 'bush',
  4: 'tree',
  5: 'butterfly',
  6: 'sakura',
};

export function rewardForRounds(rounds) {
  if (rounds >= 6) return 'sakura';
  return REWARD_BY_ROUNDS[rounds] || 'grass';
}

export const REWARD_META = {
  grass:     { emoji: '🌱', label: 'Pasto' },
  flower:    { emoji: '🌸', label: 'Flor' },
  bush:      { emoji: '🌿', label: 'Arbusto' },
  tree:      { emoji: '🌳', label: 'Árbol' },
  butterfly: { emoji: '🦋', label: 'Mariposa' },
  sakura:    { emoji: '🌸', label: 'Sakura' },
};

const DEFAULT_STATE = {
  tasks: [],
  // Cada entrada del jardín: { id, type, reward, rounds, createdAt }
  garden: [],
  totalRounds: 0,
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

class Store extends EventTarget {
  constructor() {
    super();
    this.state = load();
  }

  _persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // ---- Lectura ----
  get tasks() { return this.state.tasks; }
  get garden() { return this.state.garden; }
  get totalRounds() { return this.state.totalRounds; }

  get completedCount() {
    return this.state.tasks.filter((t) => t.done).length;
  }

  /** Conteo de tareas completadas por tipo, para el gráfico de tendencias. */
  countsByType() {
    const counts = Object.fromEntries(Object.keys(TASK_TYPES).map((k) => [k, 0]));
    for (const t of this.state.tasks) {
      if (t.done) counts[t.type] = (counts[t.type] || 0) + 1;
    }
    return counts;
  }

  // ---- Escritura ----
  addTask({ title, type }) {
    const task = {
      id: crypto.randomUUID(),
      title: title.trim(),
      type,
      done: false,
      rounds: 0,
      createdAt: Date.now(),
    };
    this.state.tasks.unshift(task);
    this._persist();
    this._emit('tasks:changed', { tasks: this.tasks });
    return task;
  }

  removeTask(id) {
    this.state.tasks = this.state.tasks.filter((t) => t.id !== id);
    this._persist();
    this._emit('tasks:changed', { tasks: this.tasks });
  }

  getTask(id) {
    return this.state.tasks.find((t) => t.id === id) || null;
  }

  /** Suma una ronda de pomodoro a una tarea y hace brotar pasto en el jardín. */
  addRound(id) {
    const task = this.getTask(id);
    if (!task || task.done) return;
    task.rounds += 1;
    this.state.totalRounds += 1;

    // Cada ronda individual brota un cuadrito de pasto.
    this._plant({ type: task.type, reward: 'grass', rounds: 1 });

    this._persist();
    this._emit('tasks:changed', { tasks: this.tasks });
    this._emit('rounds:changed', { totalRounds: this.totalRounds });
  }

  /**
   * Completa una tarea. La recompensa final depende del total de rondas:
   * se planta el elemento mayor correspondiente (flor, arbusto, árbol...).
   */
  completeTask(id) {
    const task = this.getTask(id);
    if (!task || task.done) return;
    task.done = true;
    task.completedAt = Date.now();

    const reward = rewardForRounds(Math.max(task.rounds, 1));
    this._plant({ type: task.type, reward, rounds: task.rounds });

    this._persist();
    this._emit('tasks:changed', { tasks: this.tasks });
  }

  _plant({ type, reward, rounds }) {
    const entry = { id: crypto.randomUUID(), type, reward, rounds, createdAt: Date.now() };
    this.state.garden.push(entry);
    this._emit('garden:planted', entry);
  }

  reset() {
    this.state = structuredClone(DEFAULT_STATE);
    this._persist();
    this._emit('tasks:changed', { tasks: this.tasks });
    this._emit('rounds:changed', { totalRounds: this.totalRounds });
    this._emit('garden:reset', {});
  }
}

export const store = new Store();

// Exponer para depurar en vivo durante el workshop.
window.__store = store;

// Mantener las estadísticas del encabezado sincronizadas.
function updateHeaderStats() {
  const r = document.getElementById('stat-rounds');
  const d = document.getElementById('stat-done');
  if (r) r.textContent = `🍅 ${store.totalRounds} rondas`;
  if (d) d.textContent = `✅ ${store.completedCount} tareas`;
}
store.addEventListener('rounds:changed', updateHeaderStats);
store.addEventListener('tasks:changed', updateHeaderStats);
document.addEventListener('DOMContentLoaded', updateHeaderStats);
