// Id estable de este dispositivo/navegador, para que live-sync.js pueda identificar cada
// conexión WebSocket ante el backend. No existía ningún concepto de id de dispositivo en el
// proyecto (solo `uid()` en core/store.js, para tareas/rondas); este es uno nuevo, aparte, en
// su propia clave de localStorage (no toca `jardin-movil:v1` ni `focus-garden:auth:v1`).
const KEY = 'focus-garden:device-id';

// Mismo patrón de respaldo que uid() en store.js: crypto.randomUUID no existe en contextos no
// seguros (p. ej. http://IP-local).
const generate = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let cached = null;

/** Devuelve el id de este dispositivo, generándolo y persistiéndolo la primera vez. */
export function getDeviceId() {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      cached = stored;
      return cached;
    }
  } catch { /* sin storage: se genera uno nuevo cada vez, no es crítico */ }
  cached = generate();
  try { localStorage.setItem(KEY, cached); } catch { /* modo privado */ }
  return cached;
}
