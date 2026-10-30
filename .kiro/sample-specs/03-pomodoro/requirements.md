# Spec 03: Pomodoro

## Objetivo

Módulo `pomodoro`: rondas de enfoque sobre una tarea, que no se pierden al cambiar de pestaña o recargar. Cada ronda terminada es un hecho que alimenta el progreso.

## Historias de usuario

1. Quiero elegir una tarea y empezar una ronda en un toque, para enfocarme.
2. Quiero elegir la duración de la ronda, para adaptarla a mi capacidad de concentración.
3. Quiero pausar y reiniciar, para manejar interrupciones.
4. Quiero que el reloj siga exacto aunque cambie de pestaña o recargue.
5. Quiero ver cuántas rondas llevo y qué recompensa viene.
6. Quiero un modo demo de 10 segundos, para mostrar la app.

## Criterios de aceptación

1. Pestaña **Foco** con ícono `timer` y un punto verde parpadeante cuando hay una ronda corriendo.
2. Tarjeta de tarea: muestra la tarea elegida o "Elige una tarea"; al tocarla abre una hoja con las pendientes (o "No tienes tareas pendientes" con **Crear una tarea**).
3. Duraciones: 5, 10, 15, 25 (por defecto), 35, 45 y 60 min, como chips. Se bloquean con la ronda en curso/pausa o en modo demo. Valores inválidos guardados se reemplazan por 25.
4. Estados `idle → running ⇄ paused → done`. El restante se calcula con `endsAt - Date.now()`.
5. Anillo SVG con cuenta atrás en el color del tipo de la tarea; texto de fase: "Listo para empezar", "Enfocado", "En pausa", "¡Ronda completa!".
6. Controles: reiniciar (solo con ronda en curso/pausa), iniciar/pausar y terminar tarea.
7. CUANDO el tiempo llega a cero ENTONCES se guarda una ronda `{ id, taskId, at, seconds }`, el estado pasa a `done` y se emite el evento `round` con el conteo; toast "🍅 Ronda N lista · título".
8. Tarjeta de fin: **Otra ronda** y **Terminar** (completa la tarea y avisa).
9. No se puede cambiar de tarea con la ronda en curso o en pausa: toast "Termina o reinicia la ronda…". El botón ▶ de Tareas selecciona y navega a Foco.
10. Eliminar o completar la tarea elegida reinicia el timer.
11. Persistencia: recargar con una ronda en curso la continúa; si ya terminó estando cerrada, se registra al abrir.
12. **Web Worker** para el pulso (250 ms) solo mientras corre. Respaldo con `setInterval` si falla o calla más de 2 s. Revisión al volver a la pestaña (`visibilitychange`, `pageshow`, `focus`). `__ticker` visible en consola.
13. Ajustes persistentes: **Modo demo** (rondas de 10 s). (Sonido y música llegan en la spec 06; aquí los interruptores se omiten.)
14. Tira de 6 plantas con la actual resaltada y pista de la siguiente (usa `PLANTS`).
15. Tests manuales: `PO-01` a `PO-16`, `PO-20`, `PO-21` de `docs/modules/pomodoro/README.md`.

## Fuera de alcance

Descansos, sonido, música, wake lock, título vivo (specs 06 y 07).
