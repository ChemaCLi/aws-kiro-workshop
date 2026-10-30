# Focus Garden

Tareas + pomodoro + jardín 3D + estadísticas. Responsive y mobile first: barra inferior en móvil, riel lateral desde 768 px. Web Components nativos, Tailwind y Three.js por CDN. Sin Node, sin build.

## Cómo correrlo

### Localmente
Localmente abre el archivo index.html en tu navegador web como Chrome, Edge, Firefox, Brave u Opera.
### Con servidor
Puedes crear un servidor con ExpressJS o con Python para servir esta página html como un servicio.

## Estructura

```
index.html                 shell, config de Tailwind, import map de Three.js
src/main.js                arranque
src/core/rules.js          reglas puras: tipos, plantas por rondas, stats, espiral del jardín
src/core/store.js          estado + localStorage + acciones del pomodoro
src/core/feedback.js       sonido, vibración, pantalla encendida
src/ui/                    iconos, bottom sheets, utilidades, clase base de vistas
src/components/            <app-shell>, <tasks-view>, <focus-view>, <garden-view>, <stats-view>
src/three/garden-scene.js  isla 3D (se carga de forma dinámica)
```

## Documentación y configuración de Kiro
```
docs/features.md           casos de uso y roadmap
docs/modules/*/README.md   descripción, pruebas para qa-tester y changelog de cada módulo
```
La configuración de Kiro vive en el `.kiro/` de la **raíz del repositorio** (`../.kiro/` desde esta carpeta):
```
../.kiro/steering/         producto, stack, arquitectura, estándar de código, diseño, dependencias, docs y QA
../.kiro/skills/           deploy-to-aws, migrate-to-react-or-vue, update-3d-world, responsive-mobile-first, web-worker-timer, add-lofi-melody
../.kiro/agents/           coder, qa-tester, entorno-tools
../.kiro/specs/            7 specs incrementales para reconstruir la app (ver ../.kiro/specs/README.md)
```
## Reglas del jardín

Una tarea terminada con N rondas de pomodoro siembra una parcela: 1 pasto, 2 flor, 3 arbusto, 4 árbol, 5 mariposa, 6 o más sakura. Una tarea terminada sin rondas no siembra nada.

## Para demos

- Foco > Modo demo: rondas de 10 segundos.
- Stats > Cargar datos de ejemplo: llena tareas, gráficas y jardín.
- En la consola: `__store` expone el estado.
