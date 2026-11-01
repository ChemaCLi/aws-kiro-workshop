# QA landing-and-settings · 2026-10-31

**Módulos probados:** settings, pomodoro, statistics, 3d-world (tarea 7.1 del spec `landing-and-settings`).

**Método usado:** sin MCP `chrome-devtools` en esta sesión. No se pudo automatizar el navegador. Se ejecutaron en **Node 24** (lógica pura de `core`, sin DOM) las **5 propiedades** del módulo settings y la prueba pura ST-13 de statistics, usando los stubs `window`/`localStorage` que describen los propios scripts. El resto de casos de UI se **verificó por inspección del código fuente** (comportamiento esperado contra implementación), marcados ⚠️ porque requieren un navegador con WebGL y render visual para dar evidencia observada. Servidor `python3 -m http.server 8080` levantado en `exercise/` y detenido al terminar.

## Resumen

Resultado: **No aprobado todavía** — ninguna prueba quedó ❌, pero la mayoría de los casos de UI quedan ⚠️ (no verificables sin navegador automatizado en esta sesión). Las **5 propiedades** y **ST-13** sí pasan, ejecutadas en Node con la salida esperada. No se marca "Aprobado" porque falta evidencia observada de los casos visuales e interactivos.

- Propiedades (Node): 5 de 5 ✅.
- Lógica pura adicional: ST-13 ✅.
- Casos de UI (settings 1-12, pomodoro, statistics, 3d-world): ⚠️ no verificables por ejecución; revisados contra el código sin encontrar discrepancias con los README.

## Propiedades (ejecutadas en Node)

| # | Propiedad | Resultado | Evidencia |
|---|-----------|-----------|-----------|
| 1 | Franja depende solo de la hora local y cubre todo el día | ✅ | `Feature: landing-and-settings, Property 1: OK` en TZ America/Mexico_City, UTC, America/New_York, Asia/Kolkata y Pacific/Auckland |
| 2 | El hero nunca queda vacío y respeta el jardín real | ✅ | `Propiedad 2: OK (300 estados aleatorios + 6 bordes)` |
| 3 | `hasLocalData` es exacto y no muta | ✅ | `Propiedad 3 OK: 6 bordes + 300 estados puros + 300 estados en el Store; localStorage intacto` |
| 4 | `reset` y `seedDemo` conservan los ajustes | ✅ | `Propiedad 4 OK: 56 combinaciones + 200 iteraciones aleatorias` |
| 5 | Alternar un ajuste dos veces restaura el valor y se persiste | ✅ | `Propiedad 5 OK: 168 combinaciones + 200 iteraciones aleatorias` |

Las 5 salidas coinciden exactamente con el "Resultado esperado" de cada `properties/propiedad-N-*.md`. Los scripts se extrajeron tal cual de los `.md`; a los que importan `store.js` se les antepusieron los stubs `window`/`localStorage` del propio README y se reescribió el `import()` relativo a rutas `file://`.

## Casos de UI — settings (README casos 1 a 12)

Todos ⚠️ por falta de navegador automatizado. La columna "Evidencia" resume lo confirmado por inspección de código.

| ID | Resultado | Evidencia o hallazgo |
|----|-----------|----------------------|
| Caso 1 — Landing | ⚠️ | `src/landing.js` pinta hero, escalera (`renderPlantLadder` desde `PLANTS`) y chips de tipo (colores de `TASK_TYPES`); `index.html` tiene barra superior, secciones Cómo funciona/Funciones/Open source, llamada final y enlace a GitHub. No verificable: responsive 320/390/1280, 44px, desbordes. |
| Caso 2 — Cielo/astro/estrellas por hora | ⚠️ | `applyPeriod()` usa `timePeriodFor`, revalida cada 60 s y en `visibilitychange`; `renderStars()` pinta 70 estrellas deterministas; límites 06/12/16/20 probados por Propiedad 1. No verificable: render de cada franja, estrella fugaz, contraste nocturno, astro en móvil. |
| Caso 3 — Degradación y movimiento reducido | ⚠️ | `hero-garden.js` cae a emojis con `console.warn('Three.js no disponible...')`; import dinámico de `unpkg.com@0.160.0`; `pageshow`/`persisted` recarga. No verificable: bloqueo de red, `prefers-reduced-motion`, orden en red lenta. |
| Caso 4 — Botones de entrada | ⚠️ | `renderEntryState()` usa `store.hasLocalData()`; etiquetas "Continuar/Empezar mi jardín", nota local oculta con datos, "Entrar" fijo en la barra. `hasLocalData` probado por Propiedad 3. No verificable: lectura visual. |
| Caso 5 — Recordatorio de la cuenta | ⚠️ | `openAccountReminderSheet`: title "Antes de empezar", texto exacto del README, botón "Entendido" con `.focus()`; `onClose` → `location.assign('./app.html')`; `isEntering` evita doble hoja. No verificable: foco, Escape/fondo/arrastre, navegación. |
| Caso 6 — Botón de crear cuenta | ⚠️ | `openComingSoonSheet`: title "Próximamente", un botón "Entendido" que solo cierra, sin navegación ni red. No verificable: ausencia de peticiones en Network, URL sin cambio. |
| Caso 7 — Pestaña Ajustes en navegación | ⚠️ | `app-shell.js` TABS = Tareas, Foco, Jardín, Stats, Ajustes (orden correcto, Ajustes última, icono `settings`); `aria-label` y `aria-current`; `#/settings` abre directo. No verificable: caben sin desborde 320/360px, riel lateral. |
| Caso 8 — Música/sonido/modo demo | ⚠️ | Tres `switchRow` con `role="switch"` y `aria-checked`; música deshabilitada "No disponible sin conexión" si `!isMusicAvailable()`; demo deshabilitado con ronda viva; `DEMO_MS = 10000`. Persistencia probada por Propiedad 5. No verificable: sonido real, 10s, vibración. |
| Caso 9 — Acciones de datos | ⚠️ | `#seedSampleData()` confirma solo con tareas (toast "Datos de ejemplo cargados ✨"); `#resetAllData()` confirma en modo peligro (toast "Todo limpio 🌱"). Conservación de ajustes probada por Propiedad 4. No verificable: hojas de confirmación. |
| Caso 10 — Foco/Stats sin controles movidos | ⚠️ | `focus-view.js` sin switches de música/sonido/demo, chips 5-60, indicador "Modo demo" + "Cambiar en Ajustes" → `navigate('settings')`. `stats-view.js` sin acciones de datos, estado vacío con enlace a Ajustes. No verificable: campanita + duck de música. |
| Caso 11 — Espacios reservados | ⚠️ | `reservedSlot('Mi cuenta'...)` y `reservedSlot('Mis sesiones'...)` con `aria-disabled="true"`, `text-ink/50`, "Próximamente", sin `data-act`. No verificable: ausencia de red ni datos de cuenta en localStorage. |
| Caso 12 — Páginas separadas y botón de salir | ⚠️ | `index.html` y `app.html` separados; `tasks-view.js` `<a href="./index.html" aria-label="Salir a la página de inicio">` (h-11 w-11 = 44px); `settings-view.js` fila de salida a `./index.html`; manifest `start_url: ./app.html`; timer con `endsAt`. No verificable: atrás/adelante, URL real, ronda al volver. |

## Casos de UI — pomodoro

| ID | Resultado | Evidencia o hallazgo |
|----|-----------|----------------------|
| PO-01..PO-12, PO-15..PO-22 | ⚠️ | Sin navegador. `focus-view.js`, `store.js`, `ticker.js` coherentes con el README (selector, estados idle→running⇄paused→done, `endsAt`, worker + respaldo, título de pestaña). No verificable sin ejecución en navegador. |
| PO-13 Cambiar duración | ⚠️ | Chips `DURATIONS`; `store.setDuration()` rechaza con ronda viva; chips `disabled` si `locked || demo`. `setDuration` ejercitado en Propiedades 4/5. Falta evidencia visual. |
| PO-14 / 14b / 14c Indicador Modo demo | ⚠️ | Indicador "Modo demo" + "Cambiar en Ajustes" (`navigate('settings')`) solo con `settings.demo`; sin controles movidos en Foco; reloj 00:10 con `DEMO_MS`. Falta evidencia visual. |

## Casos de UI — statistics

| ID | Resultado | Evidencia o hallazgo |
|----|-----------|----------------------|
| ST-13 Cálculo puro | ✅ | Ejecutado en Node: `computeStats({tasks:[],rounds:[]})` → doneCount 0, rounds 0, focusMinutes 0, streak 0, 7 días con total 0. |
| ST-01..ST-12, ST-14 | ⚠️ | Sin navegador. `stats-view.js` coherente (KPIs, dona SVG, barras 7 días, estado vacío 📊 con enlace a Ajustes, `esc()` en títulos). Datos de ejemplo = 14 terminadas + 2 pendientes (confirmado en `store.seedDemo`). Falta evidencia visual. |
| ST-15 Sin acciones de datos | ⚠️ | `stats-view.js` sin botones "Cargar datos de ejemplo"/"Borrar todos los datos"; único `data-act` es `settings` del estado vacío, que solo navega. Coincide con el README; falta evidencia visual. |

## Casos de UI — 3d-world

| ID | Resultado | Evidencia o hallazgo |
|----|-----------|----------------------|
| W3-01..W3-12, W3-14..W3-16 | ⚠️ | Sin navegador ni WebGL. `garden-view.js` + `garden-scene.js` coherentes (plantas por rondas vía `plantForRounds`, espiral `spiralCell`, selección, encuadre, pausa en pestaña oculta). Reglas puras presentes en `rules.js`. No verificable sin render 3D. |
| W3-13 Sin Three.js | ⚠️ | `garden-view.js` cae a cuadrícula de emojis con `console.warn('Three.js no disponible...')` y aviso "No se pudo cargar el 3D". No verificable sin bloquear la red en navegador. |

## Fallas

Ninguna prueba resultó ❌. Las 5 propiedades y ST-13 pasan; el resto queda ⚠️ por falta de navegador automatizado, no por fallo observado.

## Pruebas faltantes en el README

No se detectaron discrepancias de comportamiento entre los README y el código inspeccionado. Dos notas menores (no son fallos del producto):

- Caso 6 / `landing-sheets.js`: el texto literal de la hoja "Próximamente" es "Las cuentas llegan pronto. Por ahora tu jardín vive en este dispositivo." Coincide con la descripción del README ("las cuentas llegan pronto"); se deja constancia del texto exacto para el caso de prueba.
- Sugerencia de proceso: los casos de UI solo pueden cerrarse con el MCP `chrome-devtools`. Conviene que `entorno-tools` lo prepare para una segunda pasada que convierta los ⚠️ en ✅/❌ con evidencia observada (capturas, Network, valores de `__store`). No es un cambio al README.
