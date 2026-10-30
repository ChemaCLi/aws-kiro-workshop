---
inclusion: always
---

# Documentación y verificación

La documentación vive en `docs/` y es parte del producto. Un cambio no está terminado hasta que sus docs y su verificación están al día.

## Mapa

```
docs/features.md                      casos de uso y roadmap
docs/modules/todo-list/README.md      módulo de tareas
docs/modules/pomodoro/README.md       módulo de foco
docs/modules/3d-world/README.md       módulo del jardín 3D
docs/modules/statistics/README.md     módulo de estadísticas
```

Cada README de módulo tiene tres secciones fijas: **Descripción**, **Pruebas para qa-tester** y **Changelog**.

## Al cambiar un módulo

1. Actualizar **Descripción** si cambió el comportamiento.
2. Agregar o ajustar casos en **Pruebas para qa-tester** (cada caso con pasos y resultado esperado).
3. Agregar una entrada al **Changelog** del módulo: fecha `AAAA-MM-DD`, versión (`MAYOR.MENOR.PARCHE`) y qué cambió.
4. Si es una funcionalidad nueva o una del roadmap que se completó, actualizar `docs/features.md` (mover de "Pendiente" a "Disponible").
5. Pedir al agente `qa-tester` que ejecute las pruebas del módulo antes de cerrar.

## Versionado del changelog

- PARCHE: corrección sin cambio de comportamiento esperado.
- MENOR: funcionalidad nueva compatible.
- MAYOR: cambio que altera datos guardados o rompe comportamiento (acompañar de migración del `localStorage`).

## Datos de ejemplo para probar

- Foco > **Modo demo** hace rondas de 10 segundos.
- Stats > **Cargar datos de ejemplo** llena tareas, gráficas y jardín.
- Consola del navegador: `__store` (estado), `__ticker` (pulso), `__lofi` (música).
