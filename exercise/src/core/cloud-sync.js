// Guarda y sincroniza el progreso (tareas, rondas, timer y ajustes) en la nube cuando hay una
// Session abierta, vía el servicio sync-api/ (ver su README). No toca nada sin sesión: cerrar
// sesión simplemente deja de sincronizar, sin tocar localStorage (igual que accounts-auth).
import { AUTH_CONFIG } from './auth-config.js';
import { hasLocalData } from './rules.js';
import { store } from './store.js';

const DEBOUNCE_MS = 1500;

/**
 * Decide qué hacer al conciliar el estado local con el de la nube. Función pura: no hace
 * fetch ni toca el store, solo compara. `cloud` es `null` cuando la persona todavía no tiene
 * nada guardado en la nube.
 *
 *   - Si ninguno tiene datos: no hay nada que mover ('noop').
 *   - Si solo uno de los dos tiene datos: gana el que tiene datos (evita que un dispositivo
 *     vacío borre el progreso de otro, o que un progreso real se descarte como "nada que subir").
 *   - Si ambos tienen datos: gana el más reciente por `updatedAt` (último cambio gana).
 *
 * @param {{ tasks: unknown[], rounds: unknown[], updatedAt?: number }} local estado actual del store.
 * @param {{ tasks: unknown[], rounds: unknown[], updatedAt?: number } | null} cloud lo que devolvió GET /state, o null.
 * @returns {'push' | 'pull' | 'noop'}
 */
export function decideSync(local, cloud) {
  const localHasData = hasLocalData(local);
  if (!cloud) return localHasData ? 'push' : 'noop';
  const cloudHasData = hasLocalData(cloud);
  if (!localHasData && !cloudHasData) return 'noop';
  if (!localHasData) return 'pull';
  if (!cloudHasData) return 'push';
  return (cloud.updatedAt ?? 0) > (local.updatedAt ?? 0) ? 'pull' : 'push';
}

function stateUrl() {
  return `${AUTH_CONFIG.syncApiEndpoint}/state`;
}

/** GET /state. `204` (sin datos guardados todavía) se traduce a `null`. */
async function fetchCloudState(session) {
  const response = await fetch(stateUrl(), {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`sync-api respondió ${response.status}`);
  return response.json();
}

/** PUT /state con el estado actual del store. `keepalive` para que sobreviva a un cierre de pestaña. */
async function pushCloudState(session, state) {
  await fetch(stateUrl(), {
    method: 'PUT',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
    body: JSON.stringify(state),
  });
}

let activeSession = null;
let unsubscribeStore = null;
let debounceTimer = null;

function scheduleDebouncedPush() {
  if (!activeSession) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushNow, DEBOUNCE_MS);
}

/** Pushea de inmediato (sin esperar el debounce); usado también al ocultar/cerrar la pestaña. */
function flushNow() {
  if (!activeSession) return;
  clearTimeout(debounceTimer);
  debounceTimer = null;
  pushCloudState(activeSession, store.state).catch(() => { /* se reintenta en el próximo cambio */ });
}

function onVisibilityHidden() {
  if (document.visibilityState === 'hidden') flushNow();
}

/**
 * Concilia una vez el estado local con el de la nube para esta Session (`decideSync`), y
 * aplica el resultado: `store.replaceState` si gana la nube, o un push inmediato si gana lo
 * local. Si el servicio no responde (sin red, aún no desplegado), no bloquea la app: se
 * reintenta solo en el próximo cambio o la próxima sesión.
 *
 * @param {{ accessToken: string, sub: string }} session
 */
export async function reconcile(session) {
  let cloud = null;
  try {
    cloud = await fetchCloudState(session);
  } catch {
    return;
  }
  const decision = decideSync(store.state, cloud);
  if (decision === 'pull') store.replaceState(cloud);
  else if (decision === 'push') await pushCloudState(session, store.state).catch(() => {});
}

/**
 * Arranca la sincronización para una Session: concilia una vez y, desde entonces, pushea con
 * debounce en cada cambio del store, más un flush inmediato al ocultar la pestaña o cerrarla.
 * Sin `session.sub` no hace nada (no hay por dónde indexar los datos en la nube).
 *
 * @param {{ accessToken: string, sub: string } | null} session
 */
export function startCloudSync(session) {
  stopCloudSync();
  if (!session?.sub) return;
  activeSession = session;
  reconcile(session).finally(() => {
    if (activeSession !== session) return; // la sesión cambió mientras conciliábamos
    unsubscribeStore = store.subscribe(scheduleDebouncedPush);
    document.addEventListener('visibilitychange', onVisibilityHidden);
    window.addEventListener('pagehide', flushNow);
  });
}

/** Detiene la sincronización (cierre de sesión). No toca localStorage. */
export function stopCloudSync() {
  activeSession = null;
  clearTimeout(debounceTimer);
  debounceTimer = null;
  unsubscribeStore?.();
  unsubscribeStore = null;
  document.removeEventListener('visibilitychange', onVisibilityHidden);
  window.removeEventListener('pagehide', flushNow);
}
