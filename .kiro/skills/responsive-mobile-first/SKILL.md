---
name: responsive-mobile-first
description: Técnicas web para que Focus Garden se vea y funcione bien en teléfono, tableta y escritorio. Actívala al crear o modificar layouts, la barra de navegación, hojas o pantallas, o cuando haya problemas de desbordes, barras del navegador, zonas seguras del iPhone, zoom en inputs o gestos táctiles.
---

# Responsive y mobile first

Se diseña primero para ~390×844 y se amplía con `@media (min-width: 768px)`. Los estilos globales están en `index.html`.

## Técnicas que ya usa el proyecto (y por qué)

| Técnica | Dónde | Motivo |
|---------|-------|--------|
| `viewport-fit=cover` | `<meta viewport>` | Ocupar toda la pantalla en teléfonos con muesca |
| `env(safe-area-inset-*)` en `--safe-t`/`--safe-b` | `:root`, `.pad-top`, `nav` | No tapar contenido con muesca ni barra de inicio |
| Shell con `position: fixed; inset: 0` + rejilla | `app-shell` | Evita calcular alturas con `vh`/`dvh`, que se desfasan con las barras del navegador |
| Fila propia para la navegación (`grid-template-rows: minmax(0,1fr) auto`) | `app-shell` | La barra nunca se encoge ni queda fuera |
| `min-height: 0` / `min-width: 0` en hijos de la rejilla | `main` | Permite que el contenido haga scroll en vez de empujar el layout |
| `overscroll-behavior: none` en `html, body` | Global | Sin rebote que mueva toda la app |
| `touch-action: manipulation` | `body` | Quita el retraso de doble toque para zoom |
| `input { font-size: 16px }` | Global | iOS no hace zoom automático al enfocar |
| `-webkit-tap-highlight-color: transparent` | Global | Sin destello gris al tocar |
| Objetivos de 44 px | Botones | Táctil cómodo |
| Scroll interno `.scroll` con barra oculta | Vistas | Scroll táctil suave; `-webkit-overflow-scrolling: touch` |
| Riel lateral desde 768 px y `.page` centrado en 640 px | Media query | Línea de lectura cómoda en pantallas grandes |
| Hojas: desde abajo en móvil, diálogo centrado desde 768 px | `.sheet-root` | Alcance del pulgar vs. escritorio |
| `min(68vw, 270px)` + `aspect-ratio` | Anillo del timer | Tamaño fluido sin saltos |
| `ResizeObserver` | `garden-view` | El canvas 3D sigue el tamaño real del contenedor |
| `pointer` events (no `mouse`/`touch`) | Swipe, hojas, 3D | Un solo código para ratón, dedo y lápiz |

## Reglas para código nuevo

1. **Empezar por el móvil.** Escribir las clases base para móvil y sumar variantes con `md:` o media queries solo cuando haga falta.
2. **Sin anchos fijos en px** para contenedores. Usar `max-w-*`, `%`, `minmax`, `clamp()`.
3. **Probar siempre 3 anchos:** 360 (móvil pequeño), 768 (punto de quiebre) y 1280 (escritorio). Y en vertical y horizontal.
4. **Cuidar los dos lados de la pantalla:** zonas seguras laterales en horizontal (`env(safe-area-inset-left/right)`).
5. **Gestos con alternativa.** Todo gesto (deslizar para eliminar) tiene que tener un equivalente accesible, o ser reversible (Deshacer).
6. **Scroll vertical primero.** Un gesto horizontal solo se activa si el movimiento es claramente horizontal (ver `#onMove` en `tasks-view.js`: umbral de 10 px y proporción 1.5).
7. **No desplazar la página completa.** Cada vista maneja su propio `.scroll`; el `body` no hace scroll.
8. **Imágenes y canvas:** limitar `devicePixelRatio` a 2.
9. **Teclado móvil:** al abrir una hoja con input, esperar a que termine la animación antes de `focus()` (ver `add-sheet.js`).
10. **Movimiento:** respetar `prefers-reduced-motion`.

## Depuración rápida

- Chrome DevTools: modo dispositivo (Ctrl/Cmd+Shift+M), probar iPhone SE, iPhone 14, iPad y escritorio, con la opción de zona segura activada.
- Con el MCP `chrome-devtools`: `resize_page` a 390×844 y 1280×800 y `take_screenshot`.
- En un teléfono real por red local (`python3 -m http.server 8080` y `http://IP:8080`): no hay contexto seguro, así que `crypto.randomUUID` y Wake Lock no existen; la app ya tiene respaldos.
- Síntomas comunes:
  - *Barra inferior cortada*: alguna altura usa `100vh`; pasar a la rejilla del shell.
  - *Contenido que no hace scroll*: falta `min-height: 0` en un hijo de la rejilla o flex.
  - *Zoom al tocar un input*: tamaño de fuente menor a 16 px.
  - *Espacio bajo la barra en iPhone*: falta `padding-bottom: var(--safe-b)`.

## Al terminar

Ejecutar las pruebas de responsive del módulo (p. ej. `TL-17`, `PO-21`, `ST-12`, `W3-12`) y registrar el cambio en su changelog.
