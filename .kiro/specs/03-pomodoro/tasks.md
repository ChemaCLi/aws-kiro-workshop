# Tareas: Pomodoro

- [ ] 1. Agregar `DURATIONS`, `DEFAULT_MINUTES` y `durationLabel` a `rules.js`.
- [ ] 2. Extender `store.js`: `settings`, `timer`, `rounds`, `roundMs`, validación en `load()` y las acciones de la tabla de diseño.
- [ ] 3. Hacer que `completeTask` y `removeTask` reinicien el timer si la tarea era la activa.
- [ ] 4. Crear `ticker.worker.js` y `ticker.js` (worker, respaldo, guardia, revisiones al volver).
- [ ] 5. Llamar a `startTicker(store)` en `main.js`.
- [ ] 6. Crear `focus-view.js`: tarjeta de tarea, duraciones, anillo, controles, tarjeta de fin, tira de plantas, modo demo, selector de tarea.
- [ ] 7. Agregar el botón ▶ a las filas pendientes de `tasks-view.js` y el aviso de bloqueo.
- [ ] 8. Registrar la pestaña **Foco** en `app-shell.js` (punto parpadeante) y el toast de ronda terminada (evento `round`).
- [ ] 9. Verificar con Modo demo: iniciar, pausar, reanudar, terminar, otra ronda, recargar a mitad, cambiar de pestaña.
- [ ] 10. Actualizar `docs/modules/pomodoro/README.md` (changelog), marcar P1 a P7 y P10 en `docs/features.md` y ejecutar `qa-tester` con `pomodoro`.
