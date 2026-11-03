---
inclusion: always
---

# Arquitectura

Tres capas con dependencias en un solo sentido: **views → ui → core**. `core` nunca importa de `views`, `ui` ni `three`.

> La capa de vistas se migró de Web Components (`src/components/`) a módulos JS planos
> (`src/views/`), montados por las páginas de Astro. Ver `docs/decisions/0001-migrar-a-astro.md`.

| Capa | Carpeta | Puede usar DOM | Responsabilidad |
|------|---------|----------------|-----------------|
| Reglas puras | `src/core/rules.js` | No | Tipos, plantas, estadísticas, geometría del jardín. Funciones sin efectos. |
| Estado | `src/core/store.js` | Solo `localStorage` | Única fuente de verdad. Guarda hechos (tareas, rondas) y emite `change` y `round`. |
| Servicios | `src/core/ticker.js`, `feedback.js`, `lofi.js` | Sí, APIs del navegador | Pulso del timer, sonido/vibración/wake lock, música. |
| UI compartida | `src/ui/` | Sí | Iconos, bottom sheets, utilidades, helper de montaje `mountView` (reemplaza a la antigua clase `StoreView`). |
| Módulos visibles | `src/views/` | Sí | Un módulo JS por vista, montado con `mountView(root, { setup, update, teardown })` sobre el contenedor que pinta la página `.astro`. |
| Páginas | `src/pages/*.astro`, `src/layouts/` | Sí (marcado estático) | Estructura de cada página (barra de pestañas, contenedores, secciones puramente estáticas) y el `<script>` que monta las vistas. |
| Escena 3D | `src/three/` | Sí | Se importa dinámicamente desde `garden-view` y `hero-garden`. |

## Flujo de datos

1. Una vista llama a una acción del `store` (`addTask`, `start`, `completeTask`...).
2. El `store` muta el estado, lo guarda en `localStorage` y emite `change` (agrupado con `queueMicrotask`).
3. Cada vista suscrita recibe `update(state)` y se vuelve a pintar.

## Reglas de diseño del código

- **Guardar hechos, derivar el resto.** El estado solo tiene tareas y rondas terminadas. El jardín, el progreso y las estadísticas se calculan con funciones de `rules.js`.
- **Una vista, un módulo.** Cada vista es una función `mountX(root)` de `src/views/` que llama a `mountView(root, { setup, update, teardown })`; `setup()` corre una vez, `update(state)` en cada cambio del store y `teardown()` (opcional) al desmontar.
- **Vistas desacopladas.** Se comunican con eventos en `document` (`app:navigate`, `app:toast`) a través de `navigate()` y `toast()` de `ui/util.js`. Una vista no importa a otra, salvo abrir una hoja compartida como `add-sheet`.
- **Lógica nueva, primero en `core`.** Si una regla se puede escribir sin DOM, va en `rules.js` o `store.js`, no dentro de un componente.
- **El timer sobrevive a todo.** Cambiar de pestaña, recargar o cerrar no pierde la ronda porque se guarda `endsAt`.
- **Escapar siempre.** Todo texto del usuario que entre a `innerHTML` pasa por `esc()`.
- **Persistencia versionada.** Si cambia la forma del estado, subir la versión de la clave (`jardin-movil:v2`) y migrar o descartar con cuidado.

## Dónde poner cosas nuevas

| Quiero agregar... | Va en... |
|-------------------|----------|
| Un tipo de tarea o una planta | `rules.js` (`TASK_TYPES`, `PLANTS`) y, si es planta, `BUILD` en `garden-scene.js` |
| Una acción que cambia datos | Un método de `Store` |
| Una pantalla nueva | Un módulo en `src/views/` + una entrada en `TABS` de `src/ui/tabs.js` + su contenedor en `app.astro` |
| Un diálogo | `openSheet()` desde `ui/sheet.js` |
| Una melodía | Un JSON en `melodies/` + `index.json` (skill `add-lofi-melody`) |
