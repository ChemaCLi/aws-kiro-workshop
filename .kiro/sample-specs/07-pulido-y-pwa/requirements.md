# Spec 07: Pulido y PWA

## Objetivo

Detalles que hacen que se sienta como app móvil: instalable, pantalla encendida durante la ronda, título vivo, accesibilidad y robustez de los datos.

## Historias de usuario

1. Quiero instalar la app en mi teléfono y abrirla a pantalla completa.
2. Quiero que la pantalla no se apague mientras estoy en una ronda.
3. Quiero ver el tiempo restante en la pestaña del navegador.
4. Quiero compartir o recargar una pantalla concreta por su URL.
5. Quiero que la app sea usable con lector de pantalla y con movimiento reducido.

## Criterios de aceptación

1. `manifest.webmanifest`: nombre y nombre corto "Focus Garden", `start_url ./index.html`, `display standalone`, `orientation portrait`, colores `#fbf6ea`, ícono `icon.svg`.
2. `icon.svg` de la marca: una hoja o brote sobre fondo crema, legible a 48 px.
3. Metas Apple y `theme-color` en `index.html`.
4. **Wake Lock**: se pide al iniciar una ronda y se libera al terminar o pausar; se vuelve a pedir al volver a la pestaña si sigue corriendo. Si no está disponible o falla (sin HTTPS), no pasa nada.
5. **Título vivo**: `MM:SS · Focus Garden` cada segundo mientras corre; vuelve a `Focus Garden` al terminar.
6. **Rutas por hash**: `#/tasks`, `#/focus`, `#/garden`, `#/stats`; el botón Atrás del navegador/`hashchange` navega.
7. **Accesibilidad**: `aria-label` en todo botón de solo ícono, `aria-current` en la pestaña activa, `role="switch"` y `radiogroup`, `aria-live` en toasts, enfoque visible, contraste legible.
8. **Movimiento reducido**: sin giros ni flotado en el 3D.
9. **Robustez**: `load()` tolera JSON corrupto y estructuras antiguas; `localStorage` bloqueado no rompe la app; `crypto.randomUUID` ausente tiene respaldo.
10. README del proyecto actualizado: cómo correrlo, estructura, reglas del jardín, atajos de demo.
11. Tests: `PO-20`, `PO-21`, `TL-17`, `TL-18`, `ST-12`, `W3-12`, `W3-14`.

## Fuera de alcance

Service worker y modo sin conexión (roadmap), notificaciones del sistema.
