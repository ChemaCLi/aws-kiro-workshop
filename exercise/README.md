# Focus Garden

Tareas + pomodoro + jardín 3D + estadísticas. Responsive y mobile first: barra inferior en móvil, riel lateral desde 768 px. **Astro + Vite**, sin frameworks de UI (ni Web Components ni React/Vue). Ver [`docs/decisions/0001-migrar-a-astro.md`](docs/decisions/0001-migrar-a-astro.md) para el porqué de la migración y qué cambió.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre la URL que imprime Astro (por defecto http://localhost:4321). `npm run build` genera el sitio estático en `dist/` (ver skill `deploy-to-aws` para publicarlo); `npm test` corre las pruebas con Vitest.

## Estructura

```
astro.config.mjs           output: 'static', build.format: 'file', integración de Tailwind
package.json               astro, three, tone, vitest
public/                    icon.svg, manifest.webmanifest, melodies/ (servidos tal cual)
src/pages/index.astro      landing (página de presentación, sin SPA)
src/pages/app.astro        la app (SPA con pestañas por hash)
src/layouts/BaseLayout.astro  <head> compartido entre las dos páginas
src/views/                 un módulo JS por vista: app-shell, tasks-view, focus-view,
                            garden-view, stats-view, settings-view, account-view, hero-garden
src/styles/                tailwind.css (tokens), base.css (compartido), app.css y landing.css
src/core/rules.js          reglas puras: tipos, plantas por rondas, stats, espiral del jardín
src/core/store.js          estado + localStorage + acciones del pomodoro
src/core/auth.js           servicio de autenticación (Cognito, OAuth 2.0 + PKCE)
src/core/feedback.js       sonido, vibración, pantalla encendida
src/ui/                    iconos, bottom sheets, utilidades, helper de montaje de vistas
src/three/garden-scene.js  isla 3D (se carga de forma dinámica)
test/                      pruebas Vitest (core/, views/)
```

## Documentación y configuración de Kiro
```
docs/features.md           casos de uso y roadmap
docs/decisions/            decisiones de arquitectura (ADR), p. ej. la migración a Astro
docs/modules/*/README.md   descripción, pruebas para qa-tester y changelog de cada módulo
```
La configuración de Kiro vive en el `.kiro/` de la **raíz del repositorio** (`../.kiro/` desde esta carpeta):
```
../.kiro/steering/         producto, stack, arquitectura, estándar de código, diseño, dependencias, docs y QA
../.kiro/skills/           deploy-to-aws, migrate-to-react-or-vue, update-3d-world, responsive-mobile-first, web-worker-timer, add-lofi-melody, unit-tests
../.kiro/agents/           coder, qa-tester, entorno-tools
../.kiro/specs/            7 specs incrementales para reconstruir la app (ver ../.kiro/specs/README.md)
```
## Reglas del jardín

Una tarea terminada con N rondas de pomodoro siembra una parcela: 1 pasto, 2 flor, 3 arbusto, 4 árbol, 5 mariposa, 6 o más sakura. Una tarea terminada sin rondas no siembra nada.

## Para demos

- Foco > Modo demo: rondas de 10 segundos.
- Stats > Cargar datos de ejemplo: llena tareas, gráficas y jardín.
- En la consola: `__store` expone el estado.
