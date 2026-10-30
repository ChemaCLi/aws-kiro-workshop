# Módulo 3d-world

## Descripción

Isla flotante low-poly con una parcela por tarea terminada que tenga al menos una ronda. Pantalla `#/garden`.

- **Componente:** `<garden-view>` (`src/components/garden-view.js`): contenedor, encabezado, leyenda, tarjeta de selección y respaldo 2D.
- **Escena:** `createGardenScene()` en `src/three/garden-scene.js`. Three.js se carga por CDN con `import()` dinámico.
- **Reglas:** `PLANTS`, `plantForRounds`, `gardenPlots`, `spiralCell`, `islandSizeFor` en `src/core/rules.js`.

### Reglas del mundo

| Rondas de la tarea | Planta |
|--------------------|--------|
| 1 | 🌱 Pasto |
| 2 | 🌼 Flor |
| 3 | 🌿 Arbusto |
| 4 | 🌳 Árbol |
| 5 | 🦋 Mariposa (flores con mariposa animada) |
| 6 o más | 🌸 Sakura (con pétalos cayendo) |

- El jardín se **deriva** del estado: no se guarda. Parcelas ordenadas por `doneAt`.
- Las parcelas se colocan en **espiral** desde el centro (`spiralCell`).
- La isla crece con `islandSizeFor(count)` (lado impar, mínimo 7) y siempre deja un anillo libre.
- Cada parcela lleva una piedra del color del tipo de tarea.
- Cada planta se genera con un generador pseudoaleatorio con semilla (`rng(hash(id))`): la misma tarea siempre se ve igual.

### Comportamiento de la escena

- Cámara orbital sin desplazamiento (pan), con límites de ángulo, giro automático que se pausa al tocar y se reanuda a los 4 s.
- La isla flota suavemente; nubes orbitan alrededor. Con `prefers-reduced-motion` no hay flotado ni giro.
- Aparición de plantas con animación "pop" escalonada. Tocar una planta la selecciona (anillo pulsante, salto) y abre la tarjeta con título, tipo, rondas, planta y cuándo se terminó. Tocar fuera deselecciona.
- Encuadre automático al cambiar el tamaño de la isla o de la ventana.
- Rendimiento: renderiza solo si la vista es visible y la pestaña activa; `powerPreference: low-power`; pixel ratio máximo 2.
- Respaldo: si Three.js no carga, se muestra una cuadrícula de emojis con aviso.

### Límites conocidos

- Sin conexión no hay 3D (ver roadmap: service worker).
- No hay ciclo de día ni clima.

## Pruebas para qa-tester

Precondición: cargar **datos de ejemplo** en Stats salvo que la prueba indique lo contrario. Probar en un navegador con WebGL.

| ID | Prueba | Pasos | Resultado esperado |
|----|--------|-------|--------------------|
| W3-01 | Isla vacía | Sin datos, abrir `#/garden` | Se ve la isla vacía, tarjeta "Tu isla está vacía" con **Ir a Foco**, subtítulo "Aún sin plantas" |
| W3-02 | Ir a Foco | Tocar **Ir a Foco** en la tarjeta vacía | Navega a `#/focus` |
| W3-03 | Datos de ejemplo | Cargar datos de ejemplo y abrir el jardín | Aparecen 14 plantas de varios tipos; subtítulo "14 plantas · 🍅 N rondas"; la tarjeta vacía se oculta |
| W3-04 | Planta por rondas | Comparar plantas con las rondas de sus tareas | 1 pasto, 2 flor, 3 arbusto, 4 árbol, 5 mariposa con alas animadas, 6+ sakura con pétalos cayendo |
| W3-05 | Seleccionar | Tocar una planta | Anillo pulsante, salto breve y tarjeta con título, tipo, 🍅, planta y "hoy/ayer/hace N días" |
| W3-06 | Deseleccionar | Tocar la **X** de la tarjeta y tocar un espacio vacío | La tarjeta se cierra y el anillo desaparece |
| W3-07 | Rotar y acercar | Arrastrar un dedo/ratón; pellizcar o usar la rueda | La cámara orbita y hace zoom dentro de los límites; el giro automático se detiene |
| W3-08 | Giro automático | Soltar la cámara y esperar 5 s | El giro automático se reanuda |
| W3-09 | Crecimiento reactivo | Completar una tarea con rondas desde Tareas y abrir el jardín | La nueva planta aparece con animación y la isla se agranda si hace falta |
| W3-10 | Eliminar tarea | Eliminar una tarea completada con rondas | Su planta desaparece y, si estaba seleccionada, la tarjeta se cierra |
| W3-11 | Planta que cambia | Reabrir una tarea completada | La parcela desaparece (solo cuentan las terminadas) |
| W3-12 | Respuesta al tamaño | Cambiar el tamaño de la ventana entre 390 y 1280 px | El canvas se ajusta sin deformarse; el encuadre sigue mostrando toda la isla |
| W3-13 | Sin Three.js | Bloquear `unpkg.com/three` en red y recargar en `#/garden` | Aviso "No se pudo cargar el 3D" y cuadrícula de emojis; el resto de la app funciona; consola con un `console.warn`, sin errores no capturados |
| W3-14 | Movimiento reducido | Activar "reducir movimiento" en el SO y recargar | La isla no flota ni gira sola |
| W3-15 | Rendimiento | Cambiar a otra pestaña y revisar el uso de CPU | El bucle de render se pausa en pestañas ocultas y en vistas ocultas |
| W3-16 | Consistencia visual | Recargar varias veces | Cada planta conserva su forma y rotación |

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0.0 | 2026-10-29 | Versión inicial documentada: isla low-poly con seis tipos de planta, espiral, selección, nubes, respaldo 2D. |
