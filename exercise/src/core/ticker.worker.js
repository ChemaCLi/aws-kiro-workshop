// Web Worker que marca el pulso del pomodoro.
// Los timers de la página se espacian cuando la pestaña está en segundo plano (hasta 1 vez
// por minuto); los de un worker dedicado no sufren ese recorte. Este archivo no sabe nada
// del timer: solo avisa "tick" cada `ms` y la página decide qué hacer con `store.tick()`.
// El tiempo restante NO se acumula con estos ticks, siempre se calcula con endsAt - Date.now().
let handle = 0;

self.onmessage = ({ data }) => {
  if (data.cmd === 'start' && !handle) {
    handle = setInterval(() => self.postMessage({ type: 'tick', at: Date.now() }), data.ms ?? 250);
  } else if (data.cmd === 'stop' && handle) {
    clearInterval(handle);
    handle = 0;
  }
};
