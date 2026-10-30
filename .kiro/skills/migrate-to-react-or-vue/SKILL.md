---
name: migrate-to-react-or-vue
description: Guía para migrar Focus Garden de Web Components nativos a React o Vue de forma incremental, sin perder funcionalidad. Actívala cuando se pida migrar, portar o reescribir la app en React, Vue, Vite o cualquier framework, o cuando el usuario decida dejar de usar Web Components.
---

# Migrar a React o Vue

La arquitectura actual ya separa lo que **no cambia** (lógica) de lo que **sí cambia** (vistas). La migración consiste en reemplazar solo las vistas.

## Qué se conserva tal cual

| Archivo | Por qué se conserva |
|---------|---------------------|
| `src/core/rules.js` | Funciones puras, sin DOM |
| `src/core/store.js` | Estado + `localStorage` + eventos. Se expone a React/Vue con un adaptador (ver abajo) |
| `src/core/ticker.js` y `ticker.worker.js` | Independientes de la UI. Con Vite: `new Worker(new URL('./ticker.worker.js', import.meta.url), { type: 'module' })` |
| `src/core/feedback.js`, `lofi.js` | Servicios del navegador |
| `src/three/garden-scene.js` | Recibe un contenedor DOM; se monta desde un efecto/`onMounted` |
| `melodies/` | Mover a `public/melodies/` |
| `docs/` y `.kiro/` | Siguen vigentes; actualizar `tech.md` |

## Qué se reescribe

| Actual | React | Vue 3 |
|--------|-------|-------|
| `<app-shell>` | `App.tsx/jsx` con estado de pestaña y barra | `App.vue` |
| `<tasks-view>` | `TasksView` | `TasksView.vue` |
| `<focus-view>` | `FocusView` | `FocusView.vue` |
| `<garden-view>` | `GardenView` (contenedor + `useEffect`) | `GardenView.vue` (`onMounted`/`onBeforeUnmount`) |
| `<stats-view>` | `StatsView` | `StatsView.vue` |
| `ui/sheet.js` | Componente `Sheet` con portal | Componente `Sheet` con `<Teleport>` |
| `ui/icons.js` | Componente `Icon` que usa los mismos `PATHS` | Ídem |
| `navigate()`, `toast()` | Contexto de React o `provide/inject` / un store de toasts | Ídem |

## Pasos

1. **Preguntar** al usuario: ¿React o Vue?, ¿JavaScript o TypeScript?, ¿conservar Tailwind por CDN o instalarlo? Confirmar antes de empezar. Este es un cambio mayor: crear una spec en `.kiro/specs/` con el plan.
2. **Crear el proyecto** con Vite en una carpeta nueva (`npm create vite@latest`) sin tocar la actual. Trabajar en una rama.
3. **Copiar `core/`** sin cambios y comprobar que compila.
4. **Crear el adaptador del store**:
   - React: `useSyncExternalStore((cb) => store.subscribe(cb), () => store.state)`. `subscribe` ya devuelve la función para desuscribirse. El `state` se muta in situ, por lo que conviene exponer una versión que cambie en cada `change` (por ejemplo, un contador `version`) para que React detecte el cambio.
   - Vue: `const state = shallowRef(store.state)` y `store.subscribe(() => triggerRef(state))`.
5. **Migrar una vista por vez**, en este orden: `StatsView` (la más simple) → `TasksView` → `FocusView` → `GardenView`. Después de cada una, correr las pruebas del módulo con `qa-tester` (los casos de `docs/modules/` aplican igual).
6. **Mantener el diseño**: mismos tokens de color, tipografía, íconos y espaciado (`design-system.md`). Una migración no cambia el aspecto.
7. **Reemplazar** `innerHTML` + `esc()`: los frameworks escapan por defecto. No usar `dangerouslySetInnerHTML` / `v-html` con texto del usuario.
8. **Tailwind**: si se instala, mover el bloque `tailwind.config` de `index.html` a `tailwind.config.js` y los estilos globales a `index.css`.
9. **Tone.js y Three.js**: pasar de CDN a paquetes npm (`tone`, `three`) y quitar el import map. Ahora sí se permiten paquetes (ver `dependencies-policy.md`).
10. **Actualizar steerings**: `tech.md` (stack y estructura), `architecture.md` (capas), `dependencies-policy.md` (excepción de migración activa) y `code-standards.md` si cambian las convenciones.
11. **Publicar**: `dist/` se sube con la skill `deploy-to-aws`.

## Riesgos y cuidados

- El timer debe seguir calculándose con `endsAt`. No pasar el reloj a `setInterval` dentro de un componente.
- `garden-scene.js` debe llamar a `dispose()` al desmontar para no filtrar contextos WebGL.
- En React con StrictMode los efectos corren dos veces en desarrollo; asegurar que montar/desmontar la escena y el ticker sea idempotente.
- No perder el respaldo cuando Tone.js o Three.js fallan.
- Los datos de `localStorage` (`jardin-movil:v1`) deben seguir siendo compatibles: la migración no debe borrar el progreso de los usuarios.

## Criterio de terminado

Todas las pruebas de `docs/modules/*/README.md` pasan en la versión migrada, los changelogs tienen una entrada (por ejemplo, 2.0.0 por cambio de tecnología) y los steerings reflejan el nuevo stack.
