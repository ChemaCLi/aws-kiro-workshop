# Spec 05: Estadísticas

## Objetivo

Módulo `statistics`: ver cómo reparto mi energía y cómo voy, y poder probar la app con datos de ejemplo.

## Historias de usuario

1. Quiero ver mis números clave de un vistazo.
2. Quiero saber en qué tipo de tareas gasto más energía.
3. Quiero ver mi tendencia de la última semana.
4. Quiero cargar datos de ejemplo para explorar o demostrar la app.
5. Quiero borrar todo y empezar de cero, con protección contra accidentes.

## Criterios de aceptación

1. Pestaña **Stats** con ícono `chart`.
2. Cuatro KPIs: ✅ tareas terminadas, 🍅 rondas, ⏱️ minutos de foco (suma de `seconds` / 60 redondeada) y 🔥 racha (días consecutivos con rondas; si hoy aún no hay, cuenta desde ayer).
3. Dona SVG "Por tipo" con los colores de cada tipo, total al centro, lista con conteo y porcentaje, y frase "Más activo en …" o "Aún no hay tareas terminadas".
4. Barras apiladas SVG de los últimos 7 días (letra del día en español, hoy resaltado, total sobre cada barra, barra mínima para días sin tareas) con leyenda y animación `grow`.
5. `computeStats(state, now)` es pura, completa y devuelve `{ doneCount, totalCount, rounds, roundsToday, focusMinutes, streak, byType, days }`.
6. **Cargar datos de ejemplo**: 14 tareas terminadas en los últimos 7 días (con 1 a 7 rondas) y 2 pendientes (una con 2 rondas); confirmación si ya hay tareas; conserva ajustes.
7. **Borrar todos los datos**: confirmación en rojo; elimina tareas, rondas y timer; conserva ajustes; toast "Todo limpio 🌱".
8. Sin librerías de gráficas. Todo texto con `esc()`.
9. Tests manuales: `ST-01` a `ST-13`.
10. Con datos de ejemplo se completan las pruebas `W3-*` pendientes de la spec 04.

## Fuera de alcance

Rangos distintos de 7 días, metas, logros, exportación.
