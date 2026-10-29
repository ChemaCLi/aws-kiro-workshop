# Jardín de Tareas (móvil)

Tareas + pomodoro + jardín 3D + estadísticas. Web Components nativos, Tailwind y Three.js por CDN. Sin Node, sin build.

## Cómo correrlo

Los módulos ES necesitan HTTP (no funciona con `file://`). Desde esta carpeta:

```bash
python3 -m http.server 4322
```

Abre `http://localhost:4322`. Para probar en tu teléfono, usa la IP de tu Mac (`http://192.168.x.x:4322`) en la misma red wifi.

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

## Reglas del jardín

Una tarea terminada con N rondas de pomodoro siembra una parcela: 1 pasto, 2 flor, 3 arbusto, 4 árbol, 5 mariposa, 6 o más sakura. Una tarea terminada sin rondas no siembra nada.

## Para demos

- Foco > Modo demo: rondas de 10 segundos.
- Stats > Cargar datos de ejemplo: llena tareas, gráficas y jardín.
- En la consola: `__store` expone el estado.
