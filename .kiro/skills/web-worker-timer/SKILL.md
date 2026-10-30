---
name: web-worker-timer
description: Técnica para que el pomodoro siga funcionando con la pestaña en segundo plano o la pantalla bloqueada, usando un Web Worker, tiempo absoluto (endsAt) y un respaldo. Actívala al tocar ticker.js, ticker.worker.js, el timer del store, o al depurar rondas que terminan tarde, que se detienen o que se desfasan.
---

# Timer confiable con Web Worker

## El problema

Los navegadores **espacian los `setInterval` de las pestañas en segundo plano** (hasta una vez por minuto) y pueden suspender la página. Un timer que resta un segundo en cada tick se atrasa y la ronda termina tarde o nunca.

## La solución en tres partes

### 1. Tiempo absoluto, no acumulado

El store guarda `endsAt` (una marca de tiempo). El restante siempre es `endsAt - Date.now()`.

```js
remainingMs(now = Date.now()) {
  const t = this.state.timer;
  return t.status === 'running' ? Math.max(0, t.endsAt - now) : t.remainingMs;
}
```

Los ticks **no cuentan tiempo**: solo despiertan al store para que revise si ya pasó `endsAt` (`store.tick()` es idempotente). Así sobrevive a recargas, pestañas dormidas y retrasos.

### 2. Un Web Worker marca el pulso

`src/core/ticker.worker.js` solo emite un mensaje cada 250 ms. Los timers de un worker dedicado no se recortan en segundo plano.

```js
// worker
let handle = 0;
self.onmessage = ({ data }) => {
  if (data.cmd === 'start' && !handle) handle = setInterval(() => self.postMessage('tick'), data.ms ?? 250);
  else if (data.cmd === 'stop' && handle) { clearInterval(handle); handle = 0; }
};
```

El worker solo corre mientras hay una ronda (`running`), para no gastar batería en reposo.

### 3. Respaldo y revisiones al volver

`ticker.js` añade capas por si el worker no existe o falla:

- `setInterval` de respaldo si `new Worker` lanza, si hay `onerror`, o si el worker calla más de 2 s mientras el timer corre (guardia).
- Revisión inmediata en `visibilitychange`, `pageshow` y `focus`.
- Un `store.tick()` al arrancar la app, por si la ronda terminó mientras estaba cerrada.

## Reglas para modificar

1. Nunca derivar el tiempo restante de un contador de ticks.
2. `store.tick()` debe seguir siendo idempotente: varias fuentes pueden llamarlo.
3. El worker no importa nada ni conoce el store; solo late.
4. Cualquier campo nuevo del timer se guarda en `localStorage` y se valida en `load()`.
5. Mantener la visibilidad del estado: `__ticker` en consola muestra `source` (`worker`, `fallback`), `ticks` y `lastTickAt`.
6. Con bundler (Vite): `new Worker(new URL('./ticker.worker.js', import.meta.url), { type: 'module' })`.

## Límites honestos

- Si el sistema **suspende por completo** la pestaña (móvil con pantalla bloqueada durante minutos), el worker también se detiene. Gracias a `endsAt`, al volver la ronda se completa correctamente, pero la campanita no sonará en el instante exacto. Para avisar en ese caso hacen falta notificaciones del sistema o un servidor (ver roadmap).
- El Wake Lock (`keepAwake`) mantiene la pantalla encendida mientras corre una ronda; reduce el problema pero requiere HTTPS.

## Cómo probarlo

1. Activar **Modo demo** (10 s), iniciar una ronda, cambiar de pestaña 15 s y volver: la ronda debe haber terminado a tiempo, con `__ticker.source === 'worker'`.
2. Iniciar una ronda de 5 min y recargar: continúa con el tiempo correcto.
3. Bloquear `ticker.worker.js` en la red del navegador y recargar: `__ticker.source === 'fallback'` y todo sigue funcionando.
4. Casos `PO-04`, `PO-09`, `PO-10`, `PO-11`, `PO-12` en `docs/modules/pomodoro/README.md`.
