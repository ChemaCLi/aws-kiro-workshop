# Specs incrementales de Focus Garden

Siete specs que reconstruyen la app paso a paso. Cada una deja un producto **funcionando y probable**; la siguiente parte de ahí. Se ejecutan en orden.

| # | Spec | Qué se agrega | Módulo(s) | Resultado visible |
|---|------|---------------|-----------|-------------------|
| 01 | [base-y-shell](01-base-y-shell/) | `index.html`, Tailwind, shell, navegación, toasts, hojas, íconos | transversal | Una app vacía con barra de pestañas responsive |
| 02 | [lista-de-tareas](02-lista-de-tareas/) | Estado persistente, tipos, tareas, progreso, filtros, deslizar para eliminar | todo-list | Lista de tareas completa |
| 03 | [pomodoro](03-pomodoro/) | Timer con `endsAt`, duraciones, Web Worker, rondas, modo demo | pomodoro | Rondas de enfoque sobre una tarea |
| 04 | [jardin-3d](04-jardin-3d/) | Plantas por rondas, isla 3D con Three.js, respaldo 2D | 3d-world | El jardín crece con tu esfuerzo |
| 05 | [estadisticas](05-estadisticas/) | KPIs, dona, barras de 7 días, datos de ejemplo, borrado | statistics | Panel de progreso |
| 06 | [sonido-y-musica](06-sonido-y-musica/) | Campanita, vibración, música lofi con Tone.js, melodías JSON | pomodoro | La experiencia sensorial |
| 07 | [pulido-y-pwa](07-pulido-y-pwa/) | Manifiesto, ícono, wake lock, título vivo, rutas por hash, accesibilidad | transversal | Instalable y pulida |

## Cómo usarlas con Kiro

1. Abre el repositorio en Kiro. El `.kiro/` (steering, skills, agentes y estas specs) está en la raíz; la app y su `docs/` están en `exercise/`.
2. En el chat elige **Spec** y pide: `Implementa la spec 01-base-y-shell` (Kiro lee `requirements.md`, `design.md` y `tasks.md`).
3. Al terminar cada spec: pide al agente `qa-tester` que ejecute las pruebas del módulo que se tocó.
4. Haz commit con el nombre de la spec antes de pasar a la siguiente.

## Rutas

Las rutas de los archivos de las specs (`index.html`, `src/...`, `docs/...`, `melodies/...`) son relativas a la **carpeta de la app**: `exercise/` en este repositorio. Si un alumno copia `.kiro` a un proyecto nuevo, son relativas a la raíz de ese proyecto.

## Reglas comunes a todas las specs

- Respetar los steerings (`product`, `tech`, `architecture`, `code-standards`, `design-system`, `dependencies-policy`, `docs-and-qa`).
- Al cerrar una spec, el README del módulo debe tener su changelog actualizado.
- No adelantar funcionalidades de specs posteriores.
- Solo español en la interfaz.
