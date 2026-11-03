# Módulo statistics

## Descripción

Panel que responde "¿cómo reparto mi energía y cómo voy?". Pantalla `#/stats`.

- **Vista:** `src/views/stats-view.js`. Gráficas en SVG puro, sin librerías.
- **Cálculo:** `computeStats(state)` en `src/core/rules.js` (función pura).
- **Solo lectura:** la vista no cambia datos. Cargar datos de ejemplo y borrar todo viven en Ajustes (ver `docs/modules/settings/README.md`).

### Qué muestra

| Elemento | Definición |
|----------|------------|
| ✅ Tareas terminadas | Tareas con `doneAt` |
| 🍅 Rondas de pomodoro | Total de rondas guardadas |
| ⏱️ Minutos de foco | Suma de `seconds` de las rondas / 60, redondeado |
| 🔥 Racha | Días consecutivos con al menos una ronda; si hoy aún no hay, cuenta desde ayer |
| Dona "Por tipo" | Tareas terminadas por tipo, con porcentaje y el tipo más activo |
| Barras "Últimos 7 días" | Tareas terminadas por día, apiladas por tipo; el día de hoy en negrita y verde |

### Estado vacío

Si no hay datos locales (`hasLocalData(state)` es falso: ninguna tarea y ninguna ronda), arriba de los KPIs aparece una tarjeta con 📊, el título "Aún no hay nada que contar", una frase de apoyo y el botón **Cargar datos de ejemplo en Ajustes**. El botón navega a la pestaña Ajustes (`navigate('settings')`); desde ahí se cargan los datos de ejemplo. Los KPIs, la dona y las barras se siguen mostrando en cero debajo de la tarjeta. En cuanto hay una tarea o una ronda, la tarjeta desaparece.

### Datos de ejemplo y borrado

Estas acciones ya no están en Estadísticas; se hacen en **Ajustes > Datos**:

- **Cargar datos de ejemplo:** crea 14 tareas terminadas en los últimos 7 días (con 1 a 7 rondas) y 2 pendientes. Pide confirmación si ya hay tareas.
- **Borrar todos los datos:** elimina tareas, rondas y timer; conserva los ajustes. Pide confirmación (acción en rojo).

### Límites conocidos

- Solo ventana de 7 días.
- La racha cuenta días con rondas, no con tareas terminadas.

## Pruebas para qa-tester

| ID | Prueba | Pasos | Resultado esperado |
|----|--------|-------|--------------------|
| ST-01 | Estado vacío | En Ajustes > Datos tocar **Borrar todos los datos** y confirmar; abrir `#/stats` | KPIs en 0, dona vacía con "0 tareas", texto "Aún no hay tareas terminadas", barras vacías; arriba, la tarjeta del estado vacío (ver ST-14) |
| ST-02 | Datos de ejemplo | En Ajustes > Datos tocar **Cargar datos de ejemplo** y volver a `#/stats` | Toast de confirmación; KPIs con 14 tareas terminadas, rondas > 0, minutos > 0; la tarjeta del estado vacío ya no aparece |
| ST-03 | Confirmación al reemplazar | Con tareas existentes, en Ajustes > Datos cargar datos de ejemplo | Aparece la hoja de confirmación; **Cancelar** no cambia nada, **Cargar** reemplaza |
| ST-04 | Dona | Con datos de ejemplo revisar la dona | La suma de porcentajes ≈ 100 %; los colores coinciden con los de cada tipo; el centro muestra el total |
| ST-05 | Barras 7 días | Revisar las barras | 7 barras, la última con la etiqueta de hoy resaltada; el total de cada barra coincide con tareas de ese día; leyenda con los cinco tipos |
| ST-06 | Racha | Con datos de ejemplo (cargados desde Ajustes) | La racha es ≥ 7 (hay rondas todos los días). Con datos vacíos, completar una ronda hoy da 1 |
| ST-07 | Minutos de foco | Completar una ronda en modo demo | Los minutos suben en 0 o 1 (10 s se redondean); con rondas de 25 min suben 25 |
| ST-08 | Actualización en vivo | Terminar una tarea y volver a Stats | Los números reflejan el cambio sin recargar |
| ST-09 | Borrar todo | En Ajustes > Datos tocar **Borrar todos los datos** > **Borrar todo** | Toast "Todo limpio 🌱"; Tareas, Jardín y Stats vacíos; los ajustes (sonido, música, minutos) se conservan |
| ST-10 | Cancelar borrado | En Ajustes > Datos tocar **Borrar todos los datos** > **Cancelar** | No cambia nada |
| ST-11 | Escape de texto | Crear tarea con `<script>` en el título y completarla | No se ejecuta nada en Stats ni en el jardín |
| ST-12 | Responsive | Probar a 390 y 1280 px | Gráficas escalan al ancho de la tarjeta, sin desbordes |
| ST-13 | Cálculo puro | En la consola: `import('./src/core/rules.js').then(m => m.computeStats({tasks:[],rounds:[]}))` | Devuelve ceros, racha 0 y 7 días con `total: 0` |
| ST-14 | Estado vacío con enlace a Ajustes | Sin tareas ni rondas, abrir `#/stats` y tocar **Cargar datos de ejemplo en Ajustes** | La tarjeta muestra 📊, "Aún no hay nada que contar" y el botón; al tocarlo se abre la pestaña Ajustes (`#/settings`) sin cargar nada todavía. Ahí, **Cargar datos de ejemplo** llena los datos y al volver a Stats la tarjeta ya no aparece. Con solo una tarea pendiente (sin terminar) la tarjeta tampoco aparece |
| ST-15 | Sin acciones de datos | Abrir `#/stats` con y sin datos | No hay botones **Cargar datos de ejemplo** ni **Borrar todos los datos**; el único botón de datos es el del estado vacío, que solo navega a Ajustes |

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0.0 | 2026-10-29 | Versión inicial documentada: KPIs, dona por tipo, barras de 7 días, datos de ejemplo y borrado con confirmación. |
| 1.1.0 | 2026-10-31 | Cargar datos de ejemplo y Borrar todos los datos se movieron a Ajustes > Datos; Estadísticas ya no cambia datos. Nuevo estado vacío (📊 "Aún no hay nada que contar") con el botón "Cargar datos de ejemplo en Ajustes" que navega a Ajustes. Sin cambios en los datos guardados. |
