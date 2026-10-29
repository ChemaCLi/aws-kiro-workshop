// Lleva el pulso del pomodoro: llama a store.tick() mientras hay una ronda corriendo.
//
// Fuente principal: un Web Worker (ticker.worker.js), que sigue latiendo con la pestaña
// en segundo plano. Respaldo: un setInterval en la página, solo si el worker no existe,
// falla, o deja de latir. Además se revisa al volver a la pestaña (visibilitychange,
// pageshow, focus). store.tick() es idempotente, así que varias fuentes no estorban.
const TICK_MS = 250;
const SILENCE_MS = 2000; // si el worker calla más que esto mientras corre el timer, entra el respaldo

export function startTicker(store) {
  const info = { source: 'none', ticks: 0, lastTickAt: 0 };
  globalThis.__ticker = info; // visible en consola para el workshop

  let worker = null;
  let fallback = 0;
  let watchdog = 0;

  const running = () => store.state.timer.status === 'running';

  const onTick = (source) => {
    info.ticks += 1;
    info.lastTickAt = Date.now();
    if (source) info.source = source;
    store.tick();
  };

  const useFallback = () => {
    if (fallback) return;
    info.source = 'fallback';
    fallback = setInterval(() => { if (running()) onTick(); }, TICK_MS * 2);
  };

  try {
    worker = new Worker(new URL('./ticker.worker.js', import.meta.url));
    info.source = 'worker';
    worker.onmessage = () => onTick('worker');
    worker.onerror = () => { worker = null; useFallback(); };
  } catch {
    useFallback();
  }

  // Solo hace latir al worker mientras corre una ronda (no gasta batería en idle).
  let beating = false;
  const sync = () => {
    if (!worker) return;
    if (running() && !beating) {
      beating = true;
      info.lastTickAt = Date.now(); // evita que el guardia vea una marca vieja de otra ronda
      worker.postMessage({ cmd: 'start', ms: TICK_MS });
    }
    else if (!running() && beating) { beating = false; worker.postMessage({ cmd: 'stop' }); }
  };
  store.subscribe(sync);

  // Guardia: si el worker se muere sin avisar, el respaldo toma el relevo.
  watchdog = setInterval(() => {
    if (worker && beating && running() && Date.now() - info.lastTickAt > SILENCE_MS) {
      worker.terminate();
      worker = null;
      beating = false;
      useFallback();
    }
  }, SILENCE_MS);

  // Al volver a la pestaña, o al restaurarla desde caché, se revisa de inmediato.
  const check = () => store.tick();
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', check);
  window.addEventListener('focus', check);

  store.tick(); // por si la ronda terminó mientras la app estaba cerrada
  return info;
}
