---
inclusion: always
---

# Principios de diseño

Estilo: **cálido, tranquilo y ordenado**. Papel crema, verdes suaves, bordes finos, esquinas muy redondeadas y movimiento lento. Nada de neón, sombras duras ni saturación alta. Cuando dudes, quita elementos antes de agregar.

## Colores

Definidos en `tailwind.config` de `index.html`. Usar los tokens, no hexadecimales sueltos en componentes nuevos.

| Token | Hex | Uso |
|-------|-----|-----|
| `cream` | `#fbf6ea` | Fondo de la app y campos de entrada |
| `paper` | `#fffdf7` | Tarjetas, barra de navegación, hojas |
| `ink` | `#23312b` | Texto principal; secundarios con opacidad (`text-ink/50`, `/60`, `/70`) |
| `moss` | `#2f6f4e` | **Acento principal**: botones primarios, pestaña activa, progreso |
| `leaf` | `#4f9d69` | Acento secundario: indicadores vivos (punto del timer) |
| `line` | `#eadfc6` | Bordes y pistas de gráficas |

Colores por tipo de tarea (`TASK_TYPES` en `rules.js`), usados en círculos, chips, gráficas y la piedra de cada parcela 3D:

| Tipo | Emoji | Color |
|------|-------|-------|
| Trabajo | 💼 | `#4f8ef7` |
| Personal | 🏡 | `#ec6fa8` |
| Salud | 💪 | `#3fb56b` |
| Social | 👥 | `#f0a52a` |
| Entretenimiento | 🎮 | `#8b6cf0` |

Un tipo nuevo debe verse distinto de estos cinco y mantener la saturación media. Peligro/borrar: `red-600` o `#e5604f`. Cielo del jardín: clase `.garden-sky`.

## Tipografía

- Fuente del sistema, redondeada: `ui-rounded, -apple-system, "SF Pro Text", "Segoe UI", Roboto, system-ui`. No agregar fuentes externas.
- Título de pantalla: `text-[34px] font-extrabold leading-tight tracking-tight`.
- Título de sección o tarjeta: `text-base` a `text-lg font-extrabold`.
- Cuerpo: `text-[15px]` a `text-[16px]`, `font-bold` para títulos de fila, `font-medium` para apoyo.
- Etiquetas pequeñas: `text-xs font-bold uppercase tracking-wide text-ink/50`.
- Números que cambian (reloj, KPIs): `tabular-nums`.
- Los `input` miden 16 px para evitar el zoom automático de iOS.

## Íconos

- Íconos de **trazo** estilo Lucide, definidos como strings SVG en `src/ui/icons.js` y usados con `icon('nombre', 'h-5 w-5')`. Trazo 2, extremos y uniones redondeados, `currentColor`.
- Para agregar uno: añadir su entrada a `PATHS` en viewBox 24×24. No instalar librerías de íconos.
- Los **emojis** se usan para lo emocional y lo que representa contenido: tipos de tarea, plantas, 🍅 rondas, 🔥 racha, estados vacíos. Los íconos SVG se usan para acciones y navegación.

## Forma y espacio

- Radios: tarjetas `rounded-2xl` a `rounded-3xl`, hojas `28px`, botones circulares `rounded-full`, chips `rounded-full`.
- Bordes: `border border-line` sobre `bg-paper`. Sombras solo en elementos flotantes (FAB, toasts, hojas).
- Espaciado horizontal de pantalla: `px-5`. Separación entre bloques: `mt-4` a `mt-6`.
- Objetivo táctil mínimo: 44×44 px (`h-11 w-11`).
- Respetar zonas seguras: `--safe-t` y `--safe-b`, clase `.pad-top`.

## Movimiento

- Transiciones de 120 a 300 ms. Botones con `.press` (escala 0.95 al presionar).
- Entradas suaves: `.view-in`, `.pop`, hojas con `sheet-up`.
- Respetar `prefers-reduced-motion` en la escena 3D y en nuevas animaciones largas.

## Layout responsive

- Móvil (< 768 px): contenido a todo el ancho, barra de pestañas inferior.
- Desde 768 px: riel lateral de 5.75 rem y contenido centrado en 640 px (`.page`). Las hojas pasan a diálogo centrado.
- El shell usa `position: fixed; inset: 0` con rejilla, no `vh`/`dvh`. Ver skill `responsive-mobile-first`.

## Patrones de interacción

- Acción principal frecuente: botón flotante (FAB) o botón circular grande en el color del tipo de tarea.
- Confirmaciones destructivas: hoja `confirmSheet`. Acciones reversibles: ejecutar y ofrecer **Deshacer** en un toast, sin confirmar.
- Retroalimentación: toast breve + `haptic()` en acciones importantes. Sin diálogos bloqueantes del navegador (`alert`, `confirm`).
- Estados vacíos: emoji grande, una frase amable y una acción siguiente.
- Accesibilidad: `aria-label` en botones de solo ícono, `role="switch"`/`radio` donde aplique, `aria-live` en toasts, contraste suficiente sobre `cream`.
