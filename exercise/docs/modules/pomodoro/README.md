# Módulo pomodoro

## Descripción

Rondas de enfoque sobre una tarea. Pantalla `#/focus`.

- **Componente:** `<focus-view>` (`src/components/focus-view.js`).
- **Estado y acciones:** `store.state.timer` y `selectTask`, `start`, `pause`, `cancel`, `tick`, `setDuration`, `setSetting` en `src/core/store.js`.
- **Pulso:** `src/core/ticker.js` + `src/core/ticker.worker.js` (Web Worker).
- **Sonido y sistema:** `src/core/feedback.js` (campanita, vibración, wake lock).
- **Música:** `src/core/lofi.js` con Tone.js por CDN y melodías JSON en `melodies/`.

### Modelo del timer

`timer = { taskId, status, totalMs, remainingMs, endsAt }`

Estados: `idle` → `running` ⇄ `paused` → `done`. La ronda se guarda como hecho `{ id, taskId, at, seconds }` al terminar.

El tiempo restante se calcula con `endsAt - Date.now()`. Los ticks solo despiertan al store para revisar si ya terminó, por eso el reloj es exacto aunque la pestaña esté en segundo plano.

### Comportamiento

- Tarjeta superior con la tarea elegida (o "Elige una tarea"); abre un selector con las tareas pendientes.
- Duraciones: 5, 10, 15, 25 (por defecto), 35, 45 y 60 minutos. Bloqueadas con la ronda en curso/pausa o en modo demo.
- Anillo SVG con cuenta atrás en el color del tipo de tarea y fase en texto (Listo, Enfocado, En pausa, ¡Ronda completa!).
- Controles: reiniciar, iniciar/pausar, terminar tarea.
- Al acabar: campanita (si el sonido está activo), vibración, toast y tarjeta "¡Ronda completa!" con **Otra ronda** y **Terminar**.
- Tira de plantas: muestra la planta actual y la siguiente según las rondas de la tarea.
- Ajustes: **Modo demo** (rondas de 10 s), **Sonido** y **Música de fondo**; se guardan.
- Título de la pestaña: `MM:SS · Focus Garden` mientras corre.
- Pantalla encendida (Wake Lock) mientras corre, si el navegador lo permite.
- Ticker: Web Worker como fuente principal, `setInterval` como respaldo si el worker falla o calla más de 2 s. Se revisa también al volver a la pestaña.
- Música: si Tone.js no carga, el interruptor aparece deshabilitado ("No disponible").

### Límites conocidos

- No hay descansos (ver roadmap).
- Si el navegador suspende la pestaña por completo, la ronda termina al volver, no en el instante exacto.

## Pruebas para qa-tester

Precondición: tener al menos una tarea pendiente (usar datos de ejemplo). Para rondas rápidas activar **Modo demo**. Revisar la consola: no debe haber errores.

| ID | Prueba | Pasos | Resultado esperado |
|----|--------|-------|--------------------|
| PO-01 | Sin tarea | Abrir `#/focus` sin seleccionar tarea y tocar el botón central | Se abre el selector de tarea |
| PO-02 | Selector sin tareas | Con datos vacíos, tocar la tarjeta | Mensaje "No tienes tareas pendientes" y botón **Crear una tarea** que abre la hoja |
| PO-03 | Iniciar | Elegir una tarea y tocar ▶ | Estado "Enfocado", el anillo se vacía, el punto verde parpadea en la pestaña Foco |
| PO-04 | Pausar y reanudar | Pausar a mitad y esperar 5 s; reanudar | El tiempo no baja durante la pausa y continúa desde donde quedó |
| PO-05 | Reiniciar | Con la ronda activa, tocar reiniciar | Vuelve a "Listo para empezar" con el tiempo completo |
| PO-06 | Fin de ronda | Con Modo demo, iniciar y esperar 10 s | Toast "Ronda N lista", tarjeta "¡Ronda completa!", las rondas de la tarea suben en 1 |
| PO-07 | Otra ronda | En la tarjeta de fin, tocar **Otra ronda** | Inicia una nueva ronda de inmediato |
| PO-08 | Terminar desde Foco | Tocar **Terminar** en la tarjeta de fin | La tarea queda completada, se anuncia la planta y el timer se reinicia sin tarea |
| PO-09 | Persistencia | Iniciar una ronda de 5 min, recargar la página | Sigue "Enfocado" y el tiempo restante es coherente con la hora real |
| PO-10 | Ronda terminada con la app cerrada | En modo demo iniciar, cerrar la pestaña 15 s, reabrir | La ronda aparece registrada y en estado completo |
| PO-11 | Segundo plano | Iniciar una ronda de 10 s, cambiar a otra pestaña 15 s, volver | La ronda terminó a tiempo; `__ticker.source` es `worker` y `ticks` aumentó |
| PO-12 | Respaldo del ticker | En consola, forzar `new Worker` a fallar (bloquear `ticker.worker.js` en red) y recargar | `__ticker.source` es `fallback` y el timer sigue funcionando |
| PO-13 | Cambiar duración | En idle tocar 45 | El reloj muestra 45:00 y el chip queda activo; durante una ronda los chips están deshabilitados |
| PO-14 | Modo demo | Activar Modo demo | Aparece "Modo demo: 10 s", los chips se deshabilitan y el reloj marca 00:10; el interruptor se bloquea con una ronda activa |
| PO-15 | Bloqueo de cambio de tarea | Con ronda activa, intentar elegir otra tarea | Toast de aviso; la tarea no cambia |
| PO-16 | Eliminar tarea en curso | Con una ronda activa, eliminar su tarea desde Tareas | El timer se reinicia sin tarea |
| PO-17 | Sonido | Con Sonido activo terminar una ronda; repetir con Sonido apagado | Suena la campanita solo con el interruptor activo |
| PO-18 | Música | Activar Música de fondo | Suena lofi con fade-in; al apagar se desvanece. Sin red, el interruptor aparece deshabilitado |
| PO-19 | Música tras recarga | Con música activa recargar y tocar cualquier parte | La música reanuda tras el primer toque |
| PO-20 | Título de pestaña | Durante una ronda mirar la pestaña | Muestra `MM:SS · Focus Garden`; al terminar vuelve a `Focus Garden` |
| PO-21 | Responsive | Probar a 390 y 1280 px | El anillo se adapta (`min(68vw, 270px)`) y no hay desbordes; sin scroll horizontal |

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0.0 | 2026-10-29 | Versión inicial documentada: rondas con duración configurable, Web Worker con respaldo, modo demo, sonido, música lofi con Tone.js, wake lock. |
