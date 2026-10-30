# Spec 01: Base y shell

## Objetivo

Tener la estructura de la app: página, estilos, navegación responsive y utilidades de interfaz compartidas. Todavía sin datos ni módulos.

## Historias de usuario

1. Como persona usuaria, quiero abrir la app en el teléfono y ver una barra de pestañas abajo para moverme sin esfuerzo.
2. Como persona usuaria en tableta o escritorio, quiero una barra lateral y un contenido centrado y legible.
3. Como persona usuaria, quiero recibir avisos breves (toasts) y diálogos desde abajo (hojas) que se cierren fácilmente.
4. Como alumno que replica el proyecto, quiero abrir `index.html` sin instalar nada.

## Criterios de aceptación

1. CUANDO se abre `index.html` ENTONCES se muestra la app en español (`lang="es"`) con fondo crema y sin barras de scroll de página.
2. MIENTRAS el ancho sea menor a 768 px, la barra de pestañas está abajo y respeta la zona segura inferior.
3. MIENTRAS el ancho sea de 768 px o más, la barra pasa a un riel lateral de 5,75 rem y el contenido se centra a 640 px.
4. CUANDO se toca una pestaña ENTONCES se muestra su vista, se marca la pestaña activa (`aria-current="page"`) y la URL cambia a `#/<pestaña>`.
5. CUANDO se abre la app con `#/<pestaña>` válida ENTONCES se abre esa pestaña; si es inválida, `tasks`.
6. CUANDO se llama `toast(mensaje, { action, duration })` ENTONCES aparece arriba, máximo 2 a la vez, con botón de acción opcional y desaparece solo.
7. CUANDO se llama `openSheet()` ENTONCES sube una hoja desde abajo (diálogo centrado desde 768 px) que se cierra con el fondo, Escape o arrastrando el asa hacia abajo más de 110 px.
8. CUANDO se llama `confirmSheet()` ENTONCES devuelve una promesa con `true` o `false`.
9. TODO texto que entre a `innerHTML` pasa por `esc()`.
10. Tailwind se carga por CDN con los tokens `cream`, `paper`, `ink`, `moss`, `leaf`, `line`.
11. Sin errores en consola.

## Fuera de alcance

Tareas, timer, jardín, estadísticas, sonido, PWA.
