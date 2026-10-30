# Tareas: Estadísticas

- [ ] 1. Completar `lastDays` y `computeStats` en `rules.js`.
- [ ] 2. Agregar `seedDemo()` y `reset()` al store.
- [ ] 3. Crear `stats-view.js` con KPIs, dona, barras, leyenda y botones de datos.
- [ ] 4. Registrar la pestaña **Stats** en `app-shell.js` y el import en `main.js`.
- [ ] 5. Verificar con datos de ejemplo: porcentajes ≈ 100 %, barras que suman, racha ≥ 7, jardín con 14 plantas.
- [ ] 6. Verificar `computeStats` vacío en Node: `node --input-type=module -e "import('./src/core/rules.js').then(m=>console.log(m.computeStats({tasks:[],rounds:[]})))"`.
- [ ] 7. Actualizar `docs/modules/statistics/README.md` (changelog), marcar S1 a S5 en `docs/features.md` y ejecutar `qa-tester` con `statistics` y `3d-world`.
