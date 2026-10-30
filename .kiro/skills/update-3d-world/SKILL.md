---
name: update-3d-world
description: Cómo modificar el mundo 3D de Focus Garden con seguridad (nuevas plantas, cambios en la isla, nubes, cámara, rendimiento). Actívala cuando se pida cambiar, ampliar o depurar garden-scene.js o garden-view.js, agregar un tipo de planta, o mejorar el rendimiento del jardín.
---

# Actualizar el mundo 3D

Archivos: `src/three/garden-scene.js` (escena), `src/components/garden-view.js` (UI alrededor), `src/core/rules.js` (reglas). Documentación del módulo: `docs/modules/3d-world/README.md`.

## Reglas que no se rompen

1. **El jardín se deriva.** La escena recibe `plots` desde `gardenPlots(state)` y solo dibuja. No guarda datos ni cambia el store.
2. **Three.js sigue por CDN** con `import()` dinámico y degradación a la vista 2D. No agregar otras librerías 3D.
3. **Estilo low-poly con `flatShading`**, paleta suave, sin texturas de imagen. Usar los materiales `M` ya definidos antes de crear nuevos.
4. **Determinismo.** Todo aspecto aleatorio de una planta sale de `rng(hash(plot.id))`. La misma tarea siempre luce igual. Nunca usar `Math.random()` para la forma.
5. **Reutilizar geometrías y materiales** (`G`, `M`, `typeMat`). Crear geometrías por planta degrada el rendimiento.
6. **Movimiento reducido.** Todo movimiento continuo nuevo se desactiva con `reduceMotion`.
7. **Limpiar.** Lo que se crea por instancia con `new` y se desecha (geometrías, materiales, texturas propias) se libera con `dispose()`.

## Agregar un nuevo tipo de planta

1. **Regla.** En `rules.js`, agregar una entrada a `PLANTS` con `kind`, `rounds` (debe seguir siendo ascendente), `emoji` y `label`. Si la última entrada ya significa "6 o más", decidir con el usuario cómo se ajusta; actualizar `plantForRounds` y los textos que mencionan "6+" (`focus-view.js`, `garden-view.js`, README).
2. **Modelo.** En `garden-scene.js`, agregar una función al objeto `BUILD` con la misma clave `kind`. Firma: `nombre(group, r, ctx)`, donde `r` es el generador con semilla y `ctx` trae `type` (material del color del tipo), `wing` y `anim` (arreglo al que se agregan funciones `(t) => {}` para animar).
3. **Tamaño.** Que quepa en una celda de 1×1 (parcela de 0.94). Altura razonable: hasta ~1.6 unidades.
4. **Probar** con datos de ejemplo y variando las rondas para ver cada planta.
5. **Documentar**: tabla de reglas del README del módulo, casos nuevos para `qa-tester` y changelog (versión MENOR).

## Cambiar la isla, las nubes o la cámara

- Tamaño: `islandSizeFor(count)` en `rules.js` (función pura). Cuidar que siempre quede un anillo libre alrededor.
- Colocación: `spiralCell(index)`. Cambiarla reubica todas las plantas existentes; es un cambio visible, avisarlo.
- Encuadre: `fitDistance`/`reframe` calculan la distancia según el tamaño y el aspecto de la pantalla. Probar en vertical y horizontal.
- Nubes: `buildClouds`. Se reconstruyen cuando cambia el tamaño de la isla.

## Rendimiento (móvil primero)

- Mantener `powerPreference: 'low-power'`, pixel ratio máximo de 2 y sombras con un único mapa de 1024.
- El bucle de render debe pausarse cuando la pestaña o la vista están ocultas (ya lo hace `setRunning`). No añadir otros `requestAnimationFrame`.
- Objetos repetidos (hierba, hojas) con pocas caras (`ConeGeometry` de 4 a 7 segmentos).
- Probar con 50 y con 150 plantas: si baja de ~30 fps en un teléfono medio, considerar `InstancedMesh` para hierba y pétalos.
- Revisar con las herramientas de rendimiento del navegador antes de agregar luces o sombras.

## Depuración

- Datos: Stats > **Cargar datos de ejemplo**; `__store.state` en consola.
- La escena no expone su `THREE`; para inspeccionar, agregar temporalmente `window.__scene = scene` y quitarlo antes de terminar.
- Si el canvas queda en blanco: revisar que el contenedor tiene tamaño (`ResizeObserver` llama a `resize(w, h)`), que `WebGL` está disponible y la consola.
- Sin red: bloquear `unpkg.com/three` y comprobar que aparece la vista 2D.

## Antes de terminar

- Correr las pruebas `W3-xx` de `docs/modules/3d-world/README.md` con `qa-tester`.
- Actualizar el changelog del módulo.
- Respetar `code-standards.md`: funciones de construcción con nombre claro y un comentario que diga la intención ("un arbusto con bayas del color del tipo").
