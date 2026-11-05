# Módulo todo-list

## Descripción

Lista de tareas con el mínimo de interacciones. Es la pantalla de inicio (`#/tasks`).

- **Vista:** `src/views/tasks-view.js`, la hoja `openAddTask` (`src/views/add-sheet.js`) y la hoja `openEditTask` (`src/views/edit-task-sheet.js`).
- **Datos:** `store.state.tasks`, cada tarea es `{ id, title, note, type, createdAt, doneAt|null }`.
- **Reglas:** `TASK_TYPES`, `TYPE_BY_ID`, `roundsByTask`, `computeStats`, `groupTasksByDate` en `src/core/rules.js`.
- **Acciones del store:** `addTask`, `updateTask`, `removeTask` + `restore` (deshacer), `completeTask`, `reopenTask`.

### Comportamiento

- Encabezado con la fecha de hoy en español y tarjeta de progreso ("N de M", barra, rondas de hoy).
- Chips de filtro: Todas + los cinco tipos. El filtro no se guarda al recargar.
- Dos secciones: **Pendientes** (más nuevas primero) y **Completadas** (agrupada por día, con chips para agrupar por fecha de **Completado** o de **Creado**), con contador.
- Cada fila: checkbox cuadrado del color del tipo (✓ cuando está completa; toca para completar/reabrir), título (toca para editar) + 📝 si tiene nota, tipo, 🍅 rondas, planta si está completa, botón ▶ si está pendiente.
- **+** (FAB) abre la hoja "Nueva tarea": título (máx. 80 caracteres), enlace **+ Agregar nota** que revela un textarea opcional (máx. 500 caracteres), tipo (recuerda el último usado), botón deshabilitado si el título está vacío.
- Tocar el título de una tarea abre la hoja "Editar tarea": permite cambiar título y nota; **Guardar cambios** deshabilitado si el título queda vacío.
- Deslizar a la izquierda más de 90 px elimina la tarea y muestra "Deshacer" por 4,2 s. Eliminar también quita sus rondas; deshacer las devuelve.
- Completar una tarea muestra un aviso con su planta y un botón **Ver** al jardín. Toda tarea terminada brota al menos 🌱 Pasto, tenga rondas o no; más rondas dan una planta más grande.
- Estado vacío: "Tu jardín empieza aquí" o "Nada en este filtro".
- Si la tarea está seleccionada en el timer y se completa o elimina, el timer se reinicia.

### Límites conocidos

- Solo existe título y nota de texto; no hay subtareas, adjuntos ni fechas de vencimiento.
- El agrupado de Completadas (por fecha de creación o de completitud) no se recuerda al recargar.

## Pruebas para qa-tester

Precondición general: abrir la app, Stats > **Borrar todos los datos** para iniciar limpio. Ejecutar en ancho móvil (390×844) y en escritorio (1280×800).

| ID | Prueba | Pasos | Resultado esperado |
|----|--------|-------|--------------------|
| TL-01 | Estado vacío | Abrir `#/tasks` sin datos | Se ve "Tu jardín empieza aquí" y "0 de 0" en la tarjeta de progreso |
| TL-02 | Crear tarea | Tocar **+**, escribir "Leer", **Agregar tarea** | La hoja se cierra, aparece toast "Tarea agregada ✨" y la tarea sale en Pendientes con tipo Trabajo |
| TL-03 | Validación | Abrir la hoja y no escribir nada | El botón **Agregar tarea** está deshabilitado; con solo espacios sigue deshabilitado |
| TL-04 | Límite de título | Pegar 120 caracteres en el título | El campo acepta como máximo 80 |
| TL-05 | Recordar tipo | Crear una tarea tipo Salud; abrir la hoja otra vez | El chip Salud aparece seleccionado |
| TL-06 | Escape de HTML | Crear una tarea con título `<b>hola</b>` | Se muestra el texto literal, sin negritas ni errores |
| TL-07 | Completar sin rondas | Tocar el checkbox de una tarea sin rondas | Pasa a Completadas con tachado; toast "¡Creció pasto en tu jardín!" con botón **Ver**; progreso "1 de 1" |
| TL-08 | Reabrir | Tocar el checkbox de una tarea completada | Vuelve a Pendientes y el progreso baja |
| TL-09 | Completar con rondas | Con datos de ejemplo, completar "Ensayar la presentación" (2 rondas) | Toast "¡Creció flor en tu jardín!" con botón **Ver** que lleva a `#/garden` |
| TL-10 | Eliminar y deshacer | Deslizar una fila a la izquierda más de 90 px; tocar **Deshacer** | La fila desaparece y regresa con sus rondas |
| TL-11 | Cancelar deslizado | Deslizar menos de 90 px y soltar | La fila regresa a su sitio; no se elimina |
| TL-12 | Scroll vertical | Arrastrar verticalmente sobre una fila | La lista hace scroll y no inicia el deslizado |
| TL-13 | Filtros | Con datos de ejemplo, tocar el chip Salud | Solo se ven tareas de Salud; con un tipo sin tareas aparece "Nada en este filtro" |
| TL-14 | Enfocar | Tocar ▶ en una tarea pendiente | Se abre Foco con esa tarea seleccionada |
| TL-15 | Enfocar con ronda activa | Iniciar una ronda y volver a Tareas; tocar ▶ de otra tarea | Toast "Termina o reinicia la ronda actual..." y no cambia la tarea |
| TL-16 | Persistencia | Crear tareas y recargar la página | Las tareas siguen ahí |
| TL-17 | Responsive | Cambiar el ancho de 390 a 1280 px | En móvil: barra inferior y FAB a la derecha; desde 768 px: riel lateral, contenido centrado a 640 px |
| TL-18 | Accesibilidad | Revisar botones de solo ícono | Tienen `aria-label` (Completar, Enfocar, Nueva tarea, Editar tarea) |
| TL-19 | Checkbox cuadrado | Mirar el checkbox de cualquier tarea | Es cuadrado (no circular); al completar muestra un ✓ sobre el color del tipo |
| TL-20 | Agregar nota | Tocar **+**, escribir título, tocar **+ Agregar nota**, escribir texto, **Agregar tarea** | El enlace se oculta y aparece un textarea; la tarea creada muestra 📝 junto al título |
| TL-21 | Editar tarea | Tocar el título de una tarea | Se abre la hoja "Editar tarea" con título y nota precargados; cambiar y **Guardar cambios** actualiza la fila |
| TL-22 | Editar título vacío | En "Editar tarea", borrar todo el título | El botón **Guardar cambios** queda deshabilitado |
| TL-23 | Agrupar completadas | Con varias tareas completadas en distintos días, tocar los chips **Completado**/**Creado** sobre la sección Completadas | La lista se reagrupa bajo encabezados de día (hoy, ayer, hace N días) según la fecha elegida |

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.1.0 | 2026-11-05 | Nota opcional por tarea, edición de título/nota desde un modal, checkbox cuadrado, agrupado de Completadas por fecha de creación o de completitud, y toda tarea terminada brota al menos 🌱 Pasto (antes se requería 1+ ronda). |
| 1.0.0 | 2026-10-29 | Versión inicial documentada: crear, filtrar, completar, reabrir, eliminar con deshacer, progreso del día. |
