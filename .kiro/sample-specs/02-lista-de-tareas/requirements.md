# Spec 02: Lista de tareas

## Objetivo

Módulo `todo-list` completo con estado persistente. Resuelve la desorganización con el mínimo de toques.

## Historias de usuario

1. Quiero agregar una tarea en un toque + escribir + enviar, para anotar sin fricción.
2. Quiero clasificar tareas por tipo con color y emoji, para distinguirlas de un vistazo.
3. Quiero ver cuántas tareas llevo terminadas, para sentir avance.
4. Quiero completar una tarea tocando su círculo, y poder revertirlo.
5. Quiero eliminar deslizando y poder deshacer, para no tener miedo de equivocarme.
6. Quiero filtrar por tipo, para enfocarme en un área.
7. Quiero que mis tareas sigan ahí al recargar.

## Criterios de aceptación

1. Tipos: Trabajo 💼, Personal 🏡, Salud 💪, Social 👥, Entretenimiento 🎮 (colores de `design-system.md`).
2. CUANDO se toca **+** ENTONCES se abre la hoja "Nueva tarea" con campo de título (máx. 80), chips de tipo (recuerda el último) y botón **Agregar tarea** deshabilitado mientras el título esté vacío.
3. CUANDO se agrega ENTONCES la hoja se cierra, hay vibración y un toast "Tarea agregada ✨".
4. El título se recorta (`trim`) y se limita a 80 caracteres en el store.
5. CUANDO se toca el círculo ENTONCES la tarea alterna entre pendiente y completada (`doneAt`).
6. Al completar una tarea, aviso: sin rondas, "Terminada sin pomodoros: no brota nada"; con rondas, la planta correspondiente con botón **Ver** (la parte de rondas se activa en las specs 03 y 04).
7. CUANDO se desliza una fila a la izquierda más de 90 px ENTONCES se elimina y el toast ofrece **Deshacer** por ~4 s. El deslizado solo se activa con movimiento claramente horizontal.
8. Filtros: Todas + cada tipo. Mensajes de estado vacío distintos para "sin tareas" y "nada en este filtro".
9. Tarjeta de progreso: "N de M", barra en porcentaje y rondas de hoy.
10. Encabezado con fecha de hoy en español.
11. Tareas pendientes (nuevas primero) y completadas (recientes primero), con contador.
12. Persistencia en `localStorage` (`jardin-movil:v1`); datos corruptos no rompen la app.
13. Tests manuales: `TL-01` a `TL-18` de `docs/modules/todo-list/README.md` (los que dependen de rondas se completan en las specs 03 y 04).

## Fuera de alcance

Editar tareas, fechas límite, subtareas.
