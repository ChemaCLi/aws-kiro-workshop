# Diseño: Estadísticas

## Árbol de archivos

```
src/core/rules.js              (modificar: + lastDays, computeStats completo)
src/core/store.js              (modificar: + seedDemo, reset)
src/components/stats-view.js   (nuevo: <stats-view>)
src/components/app-shell.js    (modificar: registrar pestaña Stats)
src/main.js                    (modificar: importar stats-view)
```

## Diagrama de componentes

Dirección de dependencias `components → ui → core`. Las gráficas son SVG propio, sin librerías.

```mermaid
flowchart TD
  stats["components/stats-view.js"] --> base["ui/base.js (StoreView)"]
  stats --> util["ui/util.js (esc)"]
  stats --> sheet["ui/sheet.js (confirmSheet)"]
  stats --> store["core/store.js (seedDemo, reset)"]
  store --> rules["core/rules.js (computeStats, lastDays, dayStart)"]
  stats --> rules
  shell["components/app-shell.js"] --> stats
```

## Flujo: render de estadísticas (derivadas)

```mermaid
flowchart TD
  A["update(state)"] --> B["computeStats(state, now)"]
  B --> C["kpi(): 4 KPIs"]
  B --> D["donut(byType, total)"]
  B --> E["weekChart(days)"]
  C --> F["pinta SVG/HTML con esc()"]
  D --> F
  E --> F
```

## Flujo: datos de ejemplo y borrado

```mermaid
sequenceDiagram
  participant V as stats-view
  participant C as confirmSheet
  participant S as Store
  V->>C: seed (si ya hay tareas, confirma)
  C-->>V: true
  V->>S: seedDemo()
  S->>S: 14 terminadas + 2 pendientes, conserva settings
  S-->>V: change -> repinta
  V->>C: reset (confirmación roja)
  C-->>V: true
  V->>S: reset() -> freshState(settings)
  S-->>V: change -> toast 'Todo limpio 🌱'
```

## `rules.js`

- `lastDays(count, now)` → `[{ start, end, label, isToday }]`, con etiqueta `Intl.DateTimeFormat('es-MX', { weekday: 'narrow' })`.
- `computeStats(state, now = Date.now())`:
  - `byType`: conteo de tareas terminadas por tipo (todos los tipos inician en 0).
  - `days`: 7 días con `byType` y `total`, según `doneAt`.
  - `streak`: conjunto de `dayStart(r.at)` de las rondas; se camina hacia atrás desde hoy (o ayer si hoy no tiene).
  - `focusMinutes`: `Math.round(sum(seconds) / 60)`.
- Las fechas usan `dayStart` y `addDays` con `setDate` (correcto en cambios de horario).

## `store.js`

- `seedDemo()`: arreglo `[título, tipo, rondas, hace_cuántos_días]`, ids con `uid()`, `doneAt` repartido en el día, rondas de 1500 s antes de `doneAt`. Dos pendientes. Reemplaza `state` conservando `settings`.
- `reset()`: `freshState(this.state.settings)`.

## `<stats-view>`

- Funciones auxiliares fuera de la clase: `kpi(emoji, value, label)`, `donut(byType, total)`, `weekChart(days)`. Cada una devuelve una cadena SVG/HTML y lleva un comentario de intención.
- Dona: `circle` con `stroke-dasharray` y `stroke-dashoffset` acumulado, separación de 2,5 entre segmentos cuando hay más de uno.
- Barras: ancho 320, alto 170, máximo mínimo de 3, `clipPath` redondeado por barra, animación `grow` escalonada 50 ms.
- Confirmaciones con `confirmSheet`. Acciones por `data-act` (`seed`, `reset`).

## Decisiones

- SVG propio: sin dependencias para gráficas (ver `dependencies-policy.md`).
- Las estadísticas se **derivan** en cada render; no se guardan.
