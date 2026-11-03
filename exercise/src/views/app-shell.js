// Orquestador de la app (antes <app-shell>): navegación, toasts y wake lock.
// El marcado de la barra y los contenedores de cada vista ya están en app.astro;
// aquí solo se monta cada vista sobre su contenedor y se gobierna la navegación.
import { store } from '../core/store.js';
import { chime, haptic, keepAwake } from '../core/feedback.js';
import { startMusic, duckMusic } from '../core/lofi.js';
import { refreshIfNeeded } from '../core/auth.js';
import { startCloudSync, stopCloudSync } from '../core/cloud-sync.js';
import { startLiveSync, stopLiveSync } from '../core/live-sync.js';
import { esc, formatClock } from '../ui/util.js';
import { TABS } from '../ui/tabs.js';
import { mountTasksView } from './tasks-view.js';
import { mountFocusView } from './focus-view.js';
import { mountGardenView } from './garden-view.js';
import { mountStatsView } from './stats-view.js';
import { mountSettingsView } from './settings-view.js';
import { mountAccountView } from './account-view.js';

const TITLE = 'Focus Garden';

/**
 * Decide, SOLO a partir del hash, si se muestra la Auth_Page o una pestaña. Es pura:
 * recibe el hash como argumento (no lee `location`), no lanza y no muta nada, para que la
 * propiedad 1 pueda recorrer cientos de hashes sin efectos secundarios.
 *
 * `#/cuenta` es una ruta con barra, no una pestaña de `TABS`: devuelve
 * `{ kind: 'route', id: 'account' }`. Cualquier otro hash es una pestaña: devuelve
 * `{ kind: 'tab', id }`, con `id` el tab si existe en `TABS` o `'tasks'` como respaldo.
 *
 * @param {string} hash el valor de `location.hash` (p.ej. `'#/cuenta'`, `'#/focus'`, `''`).
 * @returns {{ kind: 'route', id: 'account' } | { kind: 'tab', id: string }}
 */
export function routeFromHash(hash) {
  const normalized = String(hash ?? '').replace(/^#\/?/, '').trim();
  if (normalized === 'cuenta') return { kind: 'route', id: 'account' };
  const id = TABS.some((t) => t.id === normalized) ? normalized : 'tasks';
  return { kind: 'tab', id };
}

/** Monta la app sobre el marcado ya presente en app.astro (barra, contenedores, toasts, sheet host). */
export function mountAppShell() {
  const shell = document.querySelector('.app-shell');
  const main = shell.querySelector('main');
  const nav = shell.querySelector('nav');
  const accountView = shell.querySelector('[data-view="account"]');
  let tab = 'tasks';
  let wasRunning = false;

  mountTasksView(main.querySelector('[data-tab="tasks"]'));
  mountFocusView(main.querySelector('[data-tab="focus"]'));
  mountGardenView(main.querySelector('[data-tab="garden"]'));
  mountStatsView(main.querySelector('[data-tab="stats"]'));
  mountSettingsView(main.querySelector('[data-tab="settings"]'));
  mountAccountView(accountView);

  /**
   * Aplica la ruta que dicta el hash actual. Es el único punto que lee `location.hash`:
   * delega la decisión a `routeFromHash` (pura) y traduce el resultado a DOM. En la ruta
   * `account` muestra la Auth_Page a pantalla completa ocultando la barra; en una pestaña,
   * oculta la cuenta, restaura la barra y reusa `go(id)` tal como funcionaba antes.
   */
  function applyRoute() {
    const route = routeFromHash(location.hash);
    if (route.kind === 'route' && route.id === 'account') {
      for (const view of main.querySelectorAll('[data-tab]')) view.hidden = true;
      nav.hidden = true;
      accountView.hidden = false;
      return;
    }
    go(route.id);
  }

  function go(tabId) {
    if (!TABS.some((t) => t.id === tabId)) return;
    tab = tabId;
    // Mostrar una pestaña siempre implica salir de la cuenta: aseguramos que la Auth_Page
    // quede oculta y la barra visible, venga `go` del hash, de un botón o de `app:navigate`.
    accountView.hidden = true;
    nav.hidden = false;
    for (const view of main.querySelectorAll('[data-tab]')) {
      const on = view.dataset.tab === tabId;
      if (on && view.hidden) {
        view.hidden = false;
        view.classList.remove('view-in');
        void view.offsetWidth; // reinicia la animación
        view.classList.add('view-in');
      } else if (!on) {
        view.hidden = true;
      }
    }
    for (const b of nav.querySelectorAll('button[data-tab]')) {
      const on = b.dataset.tab === tabId;
      b.classList.toggle('text-moss', on);
      b.classList.toggle('text-ink/50', !on);
      b.querySelector('[data-pill]').classList.toggle('bg-moss/10', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    }
    history.replaceState(null, '', `#/${tabId}`);
  }

  function onState(state) {
    const running = state.timer.status === 'running';
    nav.querySelector('[data-dot]')?.classList.toggle('hidden', !running);
    if (running !== wasRunning) {
      wasRunning = running;
      keepAwake(running);
      if (!running) document.title = TITLE;
    }
  }

  function syncTitle() {
    if (store.state.timer.status === 'running') {
      document.title = `${formatClock(store.remainingMs())} · ${TITLE}`;
    }
  }

  function onRound({ taskId, count }) {
    const task = store.taskById(taskId);
    if (store.state.settings.sound) { chime(); duckMusic(); } // baja la música para que se oiga la campana
    haptic([140, 70, 140]);
    const action = tab === 'focus' ? undefined : { label: 'Ver', run: () => go('focus') };
    showToast({ message: `🍅 Ronda ${count} lista${task ? ` · ${task.title}` : ''}`, action, duration: 4500 });
  }

  function showToast({ message, action, duration = 2800 }) {
    const host = document.getElementById('toasts');
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

  nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) { haptic(8); go(b.dataset.tab); }
  });
  document.addEventListener('app:navigate', (e) => go(e.detail.tab));
  window.addEventListener('hashchange', applyRoute);
  document.addEventListener('app:toast', (e) => showToast(e.detail));
  // cloud-sync.js y live-sync.js arrancan/paran con cada cambio de sesión (login, logout, o la
  // que ya había al abrir la app). refreshIfNeeded restaura/renueva la sesión guardada sin
  // forzar un redirect.
  document.addEventListener('app:auth', (e) => {
    const session = e.detail?.session;
    if (session) {
      startCloudSync(session);
      startLiveSync(session);
    } else {
      stopCloudSync();
      stopLiveSync();
    }
  });
  refreshIfNeeded().then((session) => {
    if (!session) return;
    startCloudSync(session);
    startLiveSync(session);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) keepAwake(store.state.timer.status === 'running');
  });
  store.addEventListener('round', (e) => onRound(e.detail));
  store.subscribe(onState);
  setInterval(syncTitle, 1000);

  // Si la música quedó encendida, el navegador no deja sonar hasta que haya un gesto:
  // la arrancamos en el primer tap real sobre la app.
  if (store.state.settings.music) {
    const resume = () => { startMusic(); };
    window.addEventListener('pointerdown', resume, { once: true });
  }

  applyRoute();
}
