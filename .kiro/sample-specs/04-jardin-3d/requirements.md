# Spec 04: Jardín 3D

## Objetivo

Módulo `3d-world`: la recompensa visual. Cada tarea terminada con rondas se convierte en una planta en una isla flotante 3D tranquila.

## Historias de usuario

1. Quiero ver mi esfuerzo convertido en un jardín, para sentir avance.
2. Quiero saber cuántas rondas necesito para cada planta, para motivarme.
3. Quiero tocar una planta para recordar qué tarea fue.
4. Quiero explorar la isla con el dedo, y que no me maree ni drene mi batería.
5. Quiero seguir usando la app si el 3D no carga.

## Criterios de aceptación

1. Pestaña **Jardín** con ícono `leaf`.
2. Reglas: 1 ronda 🌱 pasto, 2 🌼 flor, 3 🌿 arbusto, 4 🌳 árbol, 5 🦋 mariposa, 6+ 🌸 sakura. Solo cuentan tareas **terminadas** con al menos 1 ronda.
3. El jardín se deriva con `gardenPlots(state)` (ordenado por `doneAt`); no se guarda.
4. Three.js por CDN con import map y `import()` dinámico, versión fija.
5. Isla low-poly con `flatShading`, luces hemisférica y direccional con sombra, nubes que orbitan. Parcelas en espiral desde el centro (`spiralCell`). La isla crece con `islandSizeFor(n)`.
6. Cada planta es determinista: `rng(hash(taskId))`. Cada parcela lleva una piedra del color del tipo de la tarea.
7. Mariposa con alas animadas; sakura con pétalos cayendo.
8. Cámara orbital sin pan, con límites de ángulo y distancia, y giro automático que se detiene al tocar y se reanuda a los 4 s.
9. Tocar una planta (toque corto, sin arrastre) la selecciona: anillo pulsante, salto y tarjeta con título, tipo, rondas, planta y día relativo (hoy/ayer/hace N días). Botón cerrar deselecciona.
10. Plantas nuevas aparecen con animación escalonada.
11. Encabezado "Mi jardín" con subtítulo "N plantas · 🍅 M rondas" o "Aún sin plantas"; tarjeta de estado vacío con **Ir a Foco**; leyenda inferior de rondas por planta.
12. Rendimiento: render solo con vista y pestaña visibles; `low-power`; pixel ratio máximo 2; se libera con `dispose()`.
13. `prefers-reduced-motion` desactiva flotado y giro.
14. Si Three.js no carga: aviso y cuadrícula de emojis; el resto de la app sigue.
15. Tests manuales: `W3-01` a `W3-16`.

## Fuera de alcance

Ciclo de día, clima, nuevas plantas más allá de las seis.
