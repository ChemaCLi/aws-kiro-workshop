// <app-shell>: contenedor de la app. Barra de pestañas, navegación, toasts y wake lock.
import { store } from '../core/store.js';
import { chime, haptic, keepAwake } from '../core/feedback.js';
import { startMusic, duckMusic } from '../core/lofi.js';
import { icon } from '../ui/icons.js';
import { esc, formatClock } from '../ui/util.js';

const TABS = [
  { id: 'tasks', label: 'Tareas', icon: 'list' },
  { id: 'focus', label: 'Foco', icon: 'timer' },
  { id: 'garden', label: 'Jardín', icon: 'leaf' },
  { id: 'stats', label: 'Stats', icon: 'chart' },
];
const TITLE = 'Jardín · tareas, foco y bosque';

class AppShell extends HTMLElement {
  #tab = 'tasks';
  #wasRunning = false;

  connectedCallback() {
    const buttons = TABS.map((t) => `
      <button data-tab="${t.id}" aria-label="${t.label}"
        class="press relative flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-bold text-ink/50">
        <span data-pill class="grid h-8 w-16 place-items-center rounded-full transition-colors">${icon(t.icon, 'h-[22px] w-[22px]')}</span>
        <span>${t.label}</span>
        ${t.id === 'focus' ? '<i data-dot class="absolute right-[22%] top-0.5 hidden h-2.5 w-2.5 animate-pulse rounded-full bg-leaf"></i>' : ''}
      </button>`).join('');

    this.innerHTML = `
      <main class="relative min-h-0 flex-1">
        <tasks-view data-tab="tasks"></tasks-view>
        <focus-view data-tab="focus" hidden></focus-view>
        <garden-view data-tab="garden" hidden></garden-view>
        <stats-view data-tab="stats" hidden></stats-view>
      </main>
      <nav class="relative z-10 flex shrink-0 border-t border-line bg-paper px-2 pt-2" style="padding-bottom: calc(8px + var(--safe-b))">${buttons}</nav>
      <div id="toasts" aria-live="polite"></div>
      <div id="sheet-host"></div>`;

    this.nav = this.querySelector('nav');
    this.nav.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (b) { haptic(8); this.go(b.dataset.tab); }
    });
    document.addEventListener('app:navigate', (e) => this.go(e.detail.tab));
    window.addEventListener('hashchange', () => {
      const tab = location.hash.replace('#/', '');
      if (tab !== this.#tab) this.go(tab);
    });
    document.addEventListener('app:toast', (e) => this.#toast(e.detail));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) keepAwake(store.state.timer.status === 'running');
    });
    store.addEventListener('round', (e) => this.#onRound(e.detail));
    store.subscribe((state) => this.#onState(state));
    setInterval(() => this.#syncTitle(), 1000);

    // Si la música quedó encendida, el navegador no deja sonar hasta que haya un gesto:
    // la arrancamos en el primer tap real sobre la app.
    if (store.state.settings.music) {
      const resume = () => { startMusic(); };
      window.addEventListener('pointerdown', resume, { once: true });
    }

    const initial = location.hash.replace('#/', '');
    this.go(TABS.some((t) => t.id === initial) ? initial : 'tasks');
  }

  go(tab) {
    if (!TABS.some((t) => t.id === tab)) return;
    this.#tab = tab;
    for (const view of this.querySelectorAll('main > [data-tab]')) {
      const on = view.dataset.tab === tab;
      if (on && view.hidden) {
        view.hidden = false;
        view.classList.remove('view-in');
        void view.offsetWidth; // reinicia la animación
        view.classList.add('view-in');
      } else if (!on) {
        view.hidden = true;
      }
    }
    for (const b of this.nav.querySelectorAll('button[data-tab]')) {
      const on = b.dataset.tab === tab;
      b.classList.toggle('text-moss', on);
      b.classList.toggle('text-ink/50', !on);
      b.querySelector('[data-pill]').classList.toggle('bg-moss/10', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    }
    history.replaceState(null, '', `#/${tab}`);
  }

  #onState(state) {
    const running = state.timer.status === 'running';
    this.querySelector('[data-dot]')?.classList.toggle('hidden', !running);
    if (running !== this.#wasRunning) {
      this.#wasRunning = running;
      keepAwake(running);
      if (!running) document.title = TITLE;
    }
  }

  #syncTitle() {
    if (store.state.timer.status === 'running') {
      document.title = `${formatClock(store.remainingMs())} · Foco`;
    }
  }

  #onRound({ taskId, count }) {
    const task = store.taskById(taskId);
    if (store.state.settings.sound) { chime(); duckMusic(); } // baja la música para que se oiga la campana
    haptic([140, 70, 140]);
    const action = this.#tab === 'focus' ? undefined : { label: 'Ver', run: () => this.go('focus') };
    this.#toast({ message: `🍅 Ronda ${count} lista${task ? ` · ${task.title}` : ''}`, action, duration: 4500 });
  }

  #toast({ message, action, duration = 2800 }) {
    const host = this.querySelector('#toasts');
    while (host.children.length >= 2) host.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="flex-1">${esc(message)}</span>${
      action ? `<button data-a class="rounded-lg bg-white/15 px-2.5 py-1 text-[13px] font-bold">${esc(action.label)}</button>` : ''}`;
    host.append(el);
    const remove = () => { el.style.transition = 'opacity .2s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 200); };
    const timer = setTimeout(remove, duration);
    el.querySelector('[data-a]')?.addEventListener('click', () => { clearTimeout(timer); action.run(); remove(); });
  }
}

customElements.define('app-shell', AppShell);
