# Módulo statistics

## Descripción

Panel que responde "¿cómo reparto mi energía y cómo voy?". Pantalla `#/stats`.

- **Componente:** `<stats-view>` (`src/components/stats-view.js`). Gráficas en SVG puro, sin librerías.
- **Cálculo:** `computeStats(state)` en `src/core/rules.js` (función pura).
- **Acciones:** `seedDemo()` y `reset()` en el store; confirmación con `confirmSheet`.

### Qué muestra

| Elemento | Definición |
|----------|------------|
| ✅ Tareas terminadas | Tareas con `doneAt` |
| 🍅 Rondas de pomodoro | Total de rondas guardadas |
| ⏱️ Minutos de foco | Suma de `seconds` de las rondas / 60, redondeado |
| 🔥 Racha | Días consecutivos con al menos una ronda; si hoy aún no hay, cuenta desde ayer |
| Dona "Por tipo" | Tareas terminadas por tipo, con porcentaje y el tipo más activo |
| Barras "Últimos 7 días" | Tareas terminadas por día, apiladas por tipo; el día de hoy en negrita y verde |

### Datos de ejemplo y borrado

- **Cargar datos de ejemplo:** crea 14 tareas terminadas en los últimos 7 días (con 1 a 7 rondas) y 2 pendientes. Pide confirmación si ya hay tareas.
- **Borrar todos los datos:** elimina tareas, rondas y timer; conserva los ajustes. Pide confirmación (acción en rojo).

### Límites conocidos

- Solo ventana de 7 días.
- La racha cuenta días con rondas, no con tareas terminadas.

## Pruebas para qa-tester

| ID | Prueba | Pasos | Resultado esperado |
|----|--------|-------|--------------------|
| ST-01 | Estado vacío | Borrar datos y abrir `#/stats` | KPIs en 0, dona vacía con "0 tareas", texto "Aún no hay tareas terminadas", barras vacías |
| ST-02 | Datos de ejemplo | Tocar **Cargar datos de ejemplo** | Toast de confirmación; KPIs con 14 tareas terminadas, rondas > 0, minutos > 0 |
| ST-03 | Confirmación al reemplazar | Con tareas existentes, cargar datos de ejemplo | Aparece la hoja de confirmación; **Cancelar** no cambia nada, **Cargar** reemplaza |
| ST-04 | Dona | Con datos de ejemplo revisar la dona | La suma de porcentajes ≈ 100 %; los colores coinciden con los de cada tipo; el centro muestra el total |
| ST-05 | Barras 7 días | Revisar las barras | 7 barras, la última con la etiqueta de hoy resaltada; el total de cada barra coincide con tareas de ese día; leyenda con los cinco tipos |
| ST-06 | Racha | Con datos de ejemplo | La racha es ≥ 7 (hay rondas todos los días). Con datos vacíos, completar una ronda hoy da 1 |
| ST-07 | Minutos de foco | Completar una ronda en modo demo | Los minutos suben en 0 o 1 (10 s se redondean); con rondas de 25 min suben 25 |
| ST-08 | Actualización en vivo | Terminar una tarea y volver a Stats | Los números reflejan el cambio sin recargar |
| ST-09 | Borrar todo | **Borrar todos los datos** > **Borrar todo** | Toast "Todo limpio 🌱"; Tareas, Jardín y Stats vacíos; los ajustes (sonido, música, minutos) se conservan |
| ST-10 | Cancelar borrado | **Borrar todos los datos** > **Cancelar** | No cambia nada |
| ST-11 | Escape de texto | Crear tarea con `<script>` en el título y completarla | No se ejecuta nada en Stats ni en el jardín |
| ST-12 | Responsive | Probar a 390 y 1280 px | Gráficas escalan al ancho de la tarjeta, sin desbordes |
| ST-13 | Cálculo puro | En la consola: `import('./src/core/rules.js').then(m => m.computeStats({tasks:[],rounds:[]}))` | Devuelve ceros, racha 0 y 7 días con `total: 0` |

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0.0 | 2026-10-29 | Versión inicial documentada: KPIs, dona por tipo, barras de 7 días, datos de ejemplo y borrado con confirmación. |
