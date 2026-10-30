---
inclusion: always
---

# Producto: Focus Garden

Lista de tareas interactiva con técnica pomodoro y recompensas que gamifican el avance. Cada tarea terminada con rondas de enfoque hace crecer una planta en una isla 3D.

## Problemas que resuelve

- Desorganización: no saber qué hacer ni por dónde empezar.
- Falta de sentido de avance: sentir que se trabaja mucho y no se ve resultado.
- Dificultad para enfocarse: el pomodoro da un marco corto y concreto.
- Ansiedad visual: la experiencia debe ser tranquilizadora, no un tablero de control.

## Módulos (cada uno con su README en `docs/modules/`)

| Módulo | Qué hace | Vista |
|--------|----------|-------|
| `todo-list` | Crear, filtrar, completar y eliminar tareas por tipo | `<tasks-view>` |
| `pomodoro` | Rondas de enfoque sobre una tarea, con música y sonido | `<focus-view>` |
| `3d-world` | Isla 3D donde crece una planta por tarea terminada | `<garden-view>` |
| `statistics` | KPIs, dona por tipo y tendencia de 7 días | `<stats-view>` |

## Principios de producto

1. **Mínimos clics.** Toda acción frecuente se resuelve en un toque (completar, enfocar) o un gesto (deslizar para eliminar). Si una función pide más de dos toques, se replantea.
2. **Sin complejidad innecesaria.** No se agregan ajustes, pantallas ni opciones que el usuario no haya necesitado. Antes de sumar, preguntar: ¿qué problema de la lista de arriba resuelve?
3. **Mobile first, responsive siempre.** Se diseña primero para el teléfono. Desde 768 px la navegación pasa a un riel lateral y el contenido se centra.
4. **Recompensa honesta.** La planta depende solo de las rondas de pomodoro hechas en la tarea (1 pasto, 2 flor, 3 arbusto, 4 árbol, 5 mariposa, 6 o más sakura). Terminar sin rondas no siembra nada.
5. **Solo en español.** Agregar otros idiomas es un refactor amplio y no se hace dentro de una iteración normal.
6. **Datos locales.** Todo vive en `localStorage`. No hay cuentas ni servidor.

## Antes de construir algo nuevo

Revisar `docs/features.md` (casos de uso y roadmap) y el README del módulo afectado. Si la idea no está en ninguno, anotarla primero en el roadmap y proponerla al usuario.
