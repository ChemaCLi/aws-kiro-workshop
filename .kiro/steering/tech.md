---
inclusion: always
---

# Stack técnico

- **HTML + JavaScript ES modules**, sin Node, sin bundler, sin paso de build. Se abre `index.html` o se sirve con cualquier servidor estático.
- **Web Components nativos** (`customElements.define`) con **light DOM** (sin Shadow DOM) para que Tailwind aplique directo.
- **Tailwind por CDN** (`https://cdn.tailwindcss.com`) con la configuración de colores en `index.html`.
- **Tone.js por CDN** para la música y la campanita. No hay archivos de audio: las melodías son JSON en `melodies/`.
- **Three.js por CDN** con import map, solo para el mundo 3D y cargado con `import()` dinámico.
- **Web Worker** para el pulso del pomodoro (`src/core/ticker.worker.js`).
- **localStorage** para persistir (clave `jardin-movil:v1`).
- Idioma de la interfaz: **español únicamente** (`lang="es"`, fechas con `es-MX`).

## Estructura

Las rutas de los steerings, skills, agentes y specs son relativas a la carpeta de la app (`exercise/` en este repositorio). El `.kiro/` vive en la raíz del repositorio.

```
index.html                  shell, config de Tailwind, import map, estilos globales
manifest.webmanifest        metadatos de instalación
melodies/                   melodías lofi en JSON + index.json
src/main.js                 arranque
src/core/                   lógica sin DOM: rules, store, ticker, feedback, lofi
src/ui/                     utilidades de interfaz: icons, sheet, util, base
src/components/             un Web Component por módulo visible
src/three/                  escena 3D
docs/                       features.md y README de cada módulo
```

## Reglas técnicas

- Las dependencias externas se rigen por `dependencies-policy.md`.
- Todo recurso externo (Tone.js, Three.js) debe tener degradación elegante: si no carga, la app sigue funcionando.
- El tiempo del pomodoro se calcula siempre con `endsAt - Date.now()`, nunca acumulando ticks.
- Para probar en celular por red local no hay contexto seguro: no depender de `crypto.randomUUID` ni de APIs que solo existen en HTTPS sin respaldo.
- Si el usuario migra a React o Vue (ver skill `migrate-to-react-or-vue`), esta sección se actualiza y la política de dependencias deja de limitarse a CDN.
