# Módulo pomodoro

## Descripción

Rondas de enfoque sobre una tarea. Pantalla `#/focus`.

- **Vista:** `src/views/focus-view.js`.
- **Estado y acciones:** `store.state.timer` y `selectTask`, `start`, `pause`, `cancel`, `tick`, `setDuration` en `src/core/store.js`.
- **Pulso:** `src/core/ticker.js` + `src/core/ticker.worker.js` (Web Worker).
- **Sonido y sistema:** `src/core/feedback.js` (campanita, vibración, wake lock).
- **Música:** `src/core/lofi.js` con Tone.js (paquete npm) y melodías JSON en `public/melodies/` (lofi con `jazzy-amin.json` e hiphop/trap con `trap-oscuro.json`, "Trap en Do menor", 138 bpm). Al encender la música se elige una al azar entre las registradas en `public/melodies/index.json`.
- **Ajustes de música, sonido y modo demo:** viven en `src/views/settings-view.js` (pestaña **Ajustes**, ver [módulo settings](../settings/README.md)). Foco ya no tiene esos controles; solo respeta lo que se haya elegido allí.

### Modelo del timer

`timer = { taskId, status, totalMs, remainingMs, endsAt }`

Estados: `idle` → `running` ⇄ `paused` → `done`. La ronda se guarda como hecho `{ id, taskId, at, seconds }` al terminar.

El tiempo restante se calcula con `endsAt - Date.now()`. Los ticks solo despiertan al store para revisar si ya terminó, por eso el reloj es exacto aunque la pestaña esté en segundo plano.

### Comportamiento

- Tarjeta superior con la tarea elegida (o "Elige una tarea"); abre un selector con las tareas pendientes.
- Duraciones: 5, 10, 15, 25 (por defecto), 35, 45 y 60 minutos. Bloqueadas con la ronda en curso/pausa o en modo demo.
- Indicador **Modo demo**: con el modo demo activo (rondas de 10 s), junto a la etiqueta "Duración · minutos" aparece el texto "Modo demo" y un enlace "Cambiar en Ajustes" (objetivo táctil de 44 px) que lleva a `#/settings`. Con el modo demo apagado no se muestra.
- Anillo SVG con cuenta atrás en el color del tipo de tarea y fase en texto (Listo, Enfocado, En pausa, ¡Ronda completa!).
- Controles: reiniciar, iniciar/pausar, terminar tarea.
- Al acabar: campanita (si el sonido está activo en Ajustes), vibración, toast y tarjeta "¡Ronda completa!" con **Otra ronda** y **Terminar**.
- Tira de plantas: muestra la planta actual y la siguiente según las rondas de la tarea.
- Título de la pestaña: `MM:SS · Focus Garden` mientras corre.
- Pantalla encendida (Wake Lock) mientras corre, si el navegador lo permite.
- Ticker: Web Worker como fuente principal, `setInterval` como respaldo si el worker falla o calla más de 2 s. Se revisa también al volver a la pestaña.
- Música: si Tone.js no carga, el interruptor de Ajustes aparece deshabilitado ("No disponible sin conexión") y Foco sigue funcionando sin música.

### Límites conocidos

- No hay descansos (ver roadmap).
- Si el navegador suspende la pestaña por completo, la ronda termina al volver, no en el instante exacto.

## Pruebas para qa-tester

Precondición: tener al menos una tarea pendiente (usar datos de ejemplo). Para rondas rápidas activar **Modo demo** en **Ajustes** (`#/settings`); Foco ya no tiene interruptores de modo demo, sonido ni música. Revisar la consola: no debe haber errores.

| ID | Prueba | Pasos | Resultado esperado |
|----|--------|-------|--------------------|
| PO-01 | Sin tarea | Abrir `#/focus` sin seleccionar tarea y tocar el botón central | Se abre el selector de tarea |
| PO-02 | Selector sin tareas | Con datos vacíos, tocar la tarjeta | Mensaje "No tienes tareas pendientes" y botón **Crear una tarea** que abre la hoja |
| PO-03 | Iniciar | Elegir una tarea y tocar ▶ | Estado "Enfocado", el anillo se vacía, el punto verde parpadea en la pestaña Foco |
| PO-04 | Pausar y reanudar | Pausar a mitad y esperar 5 s; reanudar | El tiempo no baja durante la pausa y continúa desde donde quedó |
| PO-05 | Reiniciar | Con la ronda activa, tocar reiniciar | Vuelve a "Listo para empezar" con el tiempo completo |
| PO-06 | Fin de ronda | Con Modo demo activado en Ajustes, iniciar y esperar 10 s | Toast "Ronda N lista", tarjeta "¡Ronda completa!", las rondas de la tarea suben en 1 |
| PO-07 | Otra ronda | En la tarjeta de fin, tocar **Otra ronda** | Inicia una nueva ronda de inmediato |
| PO-08 | Terminar desde Foco | Tocar **Terminar** en la tarjeta de fin | La tarea queda completada, se anuncia la planta y el timer se reinicia sin tarea |
| PO-09 | Persistencia | Iniciar una ronda de 5 min, recargar la página | Sigue "Enfocado" y el tiempo restante es coherente con la hora real |
| PO-10 | Ronda terminada con la app cerrada | Con Modo demo activado en Ajustes, iniciar, cerrar la pestaña 15 s, reabrir | La ronda aparece registrada y en estado completo |
| PO-11 | Segundo plano | Iniciar una ronda de 10 s, cambiar a otra pestaña 15 s, volver | La ronda terminó a tiempo; `__ticker.source` es `worker` y `ticks` aumentó |
| PO-12 | Respaldo del ticker | En consola, forzar `new Worker` a fallar (bloquear `ticker.worker.js` en red) y recargar | `__ticker.source` es `fallback` y el timer sigue funcionando |
| PO-13 | Cambiar duración | En idle tocar 45 | El reloj muestra 45:00 y el chip queda activo; durante una ronda los chips están deshabilitados |
| PO-14 | Indicador de Modo demo | Sin modo demo, abrir `#/focus`; luego activar **Modo demo** en Ajustes y volver a Foco | Sin modo demo no aparece ningún indicador ni interruptor en Foco. Con modo demo aparece el texto "Modo demo" y el enlace "Cambiar en Ajustes", los chips de duración se deshabilitan y el reloj marca 00:10 |
| PO-14b | Enlace a Ajustes | Con modo demo activo, tocar "Cambiar en Ajustes" | Se abre `#/settings` con el interruptor "Modo demo" activo. Con una ronda en curso o en pausa ese interruptor está deshabilitado ("Termina o reinicia la ronda para cambiarlo") |
| PO-14c | Foco sin controles movidos | Abrir `#/focus` | No hay interruptores de Música de fondo, Sonido ni Modo demo; solo duración, anillo, controles y tira de plantas |
| PO-15 | Bloqueo de cambio de tarea | Con ronda activa, intentar elegir otra tarea | Toast de aviso; la tarea no cambia |
| PO-16 | Eliminar tarea en curso | Con una ronda activa, eliminar su tarea desde Tareas | El timer se reinicia sin tarea |
| PO-17 | Sonido | En Ajustes dejar "Sonido de la campanita" activo, terminar una ronda en Foco; repetir con el sonido apagado | Suena la campanita solo con el interruptor de Ajustes activo |
| PO-18 | Música | En Ajustes activar "Música de fondo" | Suena música (una melodía elegida al azar entre las disponibles, lofi o trap) con fade-in; al apagar se desvanece. Sin red, el interruptor aparece deshabilitado |
| PO-19 | Música tras recarga | Con la música activada en Ajustes, recargar y tocar cualquier parte | La música reanuda tras el primer toque |
| PO-20 | Título de pestaña | Durante una ronda mirar la pestaña | Muestra `MM:SS · Focus Garden`; al terminar vuelve a `Focus Garden` |
| PO-21 | Responsive | Probar a 390 y 1280 px | El anillo se adapta (`min(68vw, 270px)`) y no hay desbordes; sin scroll horizontal |
| PO-22 | Melodía trap | Dejar temporalmente solo `trap-oscuro.json` en `melodies/index.json`, recargar y activar "Música de fondo" en Ajustes. Al terminar, restaurar el índice con `jazzy-amin.json` y `trap-oscuro.json` | Suena "Trap en Do menor", enérgica (~138 bpm), con fade-in y sin errores en consola. Con el índice restaurado vuelve a elegirse al azar entre las dos melodías |

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0.0 | 2026-10-29 | Versión inicial documentada: rondas con duración configurable, Web Worker con respaldo, modo demo, sonido, música lofi con Tone.js, wake lock. |
| 1.1.0 | 2026-10-30 | Nueva melodía hiphop/trap "Trap en Do menor" (138 bpm) junto a la lofi; la música de fondo elige una al azar entre las dos. |
| 1.2.0 | 2026-10-31 | Música, sonido de la campanita y modo demo se movieron a la nueva pestaña Ajustes (`<settings-view>`); Foco ya no tiene esos interruptores. Con el modo demo activo, Foco muestra "Modo demo" y el enlace "Cambiar en Ajustes". Sin cambios en los datos guardados. |
