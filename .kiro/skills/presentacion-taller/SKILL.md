---
name: presentacion-taller
description: Sistema de diseño para las diapositivas del taller "Todos pueden programar con Kiro" (AWS User Group Orizaba). Actívala al crear, editar o revisar diapositivas de workshop/presentation/presentation.html, o cualquier deck nuevo que deba verse igual. Cubre tipografía, colores de acento de AWS y Kiro, los adornos fijos de cada diapositiva (logos y etiqueta del user group) y los patrones de composición.
---

# Diapositivas del taller — sistema de diseño

Esta skill define cómo se ven las diapositivas del taller **"Todos pueden programar con Kiro"** del **AWS User Group Orizaba**. Síguela al pie para que cada diapositiva nueva combine con las que ya existen.

El deck vive en `workshop/presentation/presentation.html`. Es un archivo HTML autónomo: cada diapositiva es un `<section class="deck-slide">` de 1920×1080 px, con las fuentes e imágenes embebidas o cargadas desde `assets/`. No depende de internet.

## Formato de cada diapositiva

- Lienzo fijo de **1920×1080 px** (16:9).
- Un `<section class="deck-slide" id="N" ... aria-label="Slide N of TOTAL">` por diapositiva. Al agregar o quitar diapositivas, renumera los `id`, los `aria-label` ("Slide N of TOTAL") y agrega/quita la entrada correspondiente en el JSON `#deck-motion` del `<head>`.
- Padding de contenido estándar: **128px** laterales. En diapositivas con mucho aire vertical, `96px 128px`.
- Separación entre bloques: múltiplos de 8 (16, 24, 32, 48, 56, 64, 72).

## Tipografía

Solo hay tres familias embebidas. **No introduzcas fuentes nuevas** (incluida FiraCode): la política de seguridad del archivo bloquea fuentes externas y caerían a una fuente del sistema. Si de verdad se necesita otra fuente, hay que embeberla como `@font-face` base64 primero.

| Rol | Familia | Uso |
|-----|---------|-----|
| Título principal (portada / cierre) | `Inter` 700, muy grande, `letter-spacing: -0.035em` | Frases ancla de la portada y el llamado final |
| Título de sección | `Space Grotesk` 700, `line-height: 1.1` | Encabezado de la mayoría de las diapositivas de contenido |
| Título "código / terminal" | `JetBrains Mono` 600 | Diapositivas con estética de consola (p. ej. el perfil de GitHub) |
| Subtítulo / texto complementario | `JetBrains Mono` 400–600 | Kickers, etiquetas, pies, metadatos. Es la fuente mono del deck |
| Cuerpo / párrafos | `Inter` 400–500 | Descripciones, celdas de tabla, bullets |

Reglas:
- Declara siempre fallbacks: `Inter, Arial, ui-sans-serif, system-ui, sans-serif` · `'Space Grotesk', Arial, ui-sans-serif, system-ui, sans-serif` · `'JetBrains Mono', 'Courier New', ui-monospace, Menlo, Consolas, monospace`.
- **Kickers / etiquetas** (lo "complementario") van en JetBrains Mono, mayúsculas, con prefijo de terminal y `letter-spacing` amplio: `> SPEAKER`, `01 · KIRO`, `> REPO DEL TALLER`. Tamaño ~26–28px, `letter-spacing: 0.14em–0.16em`.
- Tamaños de referencia: título portada ~112px; título sección 72–80px; subtítulo 36–44px; cuerpo 26–32px; kicker 26–28px.

## Colores

### Fondos
- **Azul AWS Orizaba (oscuro):** `#05106B` — fondo base de portada, speaker y diapositivas destacadas. Variante con degradado permitida: `linear-gradient(120deg, #040A50 0%, #05106B 45%, #092096 100%)` solo si no compite con una foto.
- **Crema (claro):** `#F4F1EA` — fondo de las diapositivas de contenido "documentales".
- **Carbón (código):** `#15161D` / `#1F2029` — fondo de diapositivas con estética de consola.
- Imagen de fondo opcional: `assets/background.png` (volcán + catedral de Orizaba), a `object-fit: cover`, solo en portada y diapositivas tipo portada.

### Acentos — AWS
- **Naranja AWS:** `#FF9900` — acento principal sobre fondo oscuro (palabras clave en títulos, "Software Crafter", resaltados).
- **Naranja oscuro (sobre crema):** `#A1530C` — mismo rol del naranja pero legible sobre fondo claro.
- **Ámbar suave:** `#F0A35A` — kickers/acentos secundarios sobre fondo oscuro.

### Acentos — Kiro
- **Violeta Kiro:** `#5A3FD1` (`rgb(90,63,209)`) — acento principal sobre fondo claro (numeración, enlaces, bordes).
- **Lavanda Kiro:** `#A58BFF` (`rgb(165,139,255)`) — acento sobre fondo oscuro (kickers, subtítulos de tarjeta, la palabra "Kiro").
- **Azul claro:** `#8AB4FF` (`rgb(138,180,255)`) — kickers de terminal sobre fondo azul.

### Texto
- Sobre oscuro: títulos `#FFFFFF` o crema `#F3EFE6`; cuerpo `#CDDAFF` / `#C9C4B8`; atenuado `rgba(190,208,255,0.6)`.
- Sobre crema: títulos `#1B1C24`; cuerpo `#4A4B55`.

Regla de equilibrio: **un acento dominante por diapositiva.** Naranja AWS y violeta/lavanda Kiro pueden convivir, pero uno manda y el otro aparece en un detalle (como en el título de la portada: "programar" en naranja, "Kiro" en lavanda).

## Adornos fijos (en TODAS las diapositivas)

1. **Logo de AWS — esquina superior izquierda.** `assets/aws-logo.webp`, 72×72px, en `left: 112px; top: 28px; z-index: 5`, sin fondo y con sus colores originales. Sobre fondos oscuros añade contorno fino para legibilidad: `filter: drop-shadow(0 0 1.5px rgba(255,255,255,0.95)) drop-shadow(0 0 1.5px rgba(255,255,255,0.95));`. Sobre fondo crema, sin filtro.
2. **Etiqueta del user group** junto al logo de AWS: el texto es **`// AWS User Group Orizaba`** en **Title Case** (no mayúsculas sostenidas). JetBrains Mono, `letter-spacing: 0.14em–0.16em`, color `#8AB4FF` sobre oscuro o `#5A3FD1` sobre claro.
3. **Logo de Kiro — esquina superior derecha.** Usa `assets/kiro-logo-clean.png` (fantasma blanco con transparencia real; es la versión ya limpia de `kiro-logo.webp`, que traía un patrón de cuadros pegado). Tamaño ~60px de alto (45×60), alineado con el logo de AWS (`top: 28px; right: 112px`). No uses blend modes.
   - Sobre fondo **oscuro**: muéstralo tal cual, blanco, sin filtro.
   - Sobre fondo **claro/crema**: mantenlo blanco y dale un contorno negro en la silueta con `drop-shadow` apiladas (8 direcciones, ~1.5px), p. ej. `filter: drop-shadow(1.5px 0 0 #000) drop-shadow(-1.5px 0 0 #000) drop-shadow(0 1.5px 0 #000) drop-shadow(0 -1.5px 0 #000) drop-shadow(1px 1px 0 #000) drop-shadow(-1px -1px 0 #000) drop-shadow(1px -1px 0 #000) drop-shadow(-1px 1px 0 #000);`. No uses `mix-blend-mode` para esto: borra el contorno negro.
   - **Excepción — portada (diapositiva 1):** NO lleva el logo de Kiro arriba a la derecha, porque el logo de Kiro ya aparece grande junto al título y repetirlo se ve redundante.

Mantén estos tres adornos coherentes en posición y tamaño en toda la presentación.

## Recursos externos

- **Imágenes, logos, fotos, QR:** usa siempre archivos de la carpeta `assets/` con rutas relativas (`assets/aws-logo.webp`, `assets/kiro-logo.webp`, `assets/background.png`, `assets/profile.jpeg`, `assets/github-white-icon.webp`, `assets/workshop-repo-link-qr.png`). No incrustes imágenes como base64 nuevas ni enlaces a imágenes remotas. Si falta un recurso, pídelo o agrégalo a `assets/`, no lo inventes desde una URL externa.
- **Tipografías o librerías que enriquezcan la presentación** (fuentes adicionales, animaciones, efectos dinámicos): cárgalas **solo desde el CDN oficial** del proyecto correspondiente (p. ej. `fonts.googleapis.com`/`fonts.gstatic.com` para fuentes, el CDN oficial de la librería para JS/CSS). Nada de espejos no oficiales ni copias sueltas.
- Al agregar un CDN, **actualiza la `Content-Security-Policy`** del `<head>` para permitir ese origen (`style-src`, `font-src`, `script-src` o `connect-src` según corresponda); si no, el navegador lo bloqueará. Prefiere versiones fijadas (con número de versión y, si es posible, `integrity`), no `@latest`.
- Entre las dos opciones, prioriza lo local: si el efecto se logra con CSS nativo y los `assets/`, no agregues una librería externa.

## Patrones de composición

- **Títulos concretos y grandes, poco texto.** Una idea por diapositiva. Frases cortas, nada de párrafos largos.
- **Ideas en grupos visuales simples:** columnas iguales, tarjetas, o lista numerada con separadores finos. 3–5 elementos por grupo como máximo.
- **Numeración y pasos** en JetBrains Mono con el acento violeta Kiro (`01`, `02`, ...).
- **Flechas de proceso** `→` entre tarjetas para secuencias (entrada → proceso → salida).
- **Tarjetas glass** sobre fondo oscuro: `background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08)); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.35); border-radius: 20–28px;`.
- **Prefijos de terminal** (`>`, `$`, `//`, `·`) en kickers y pies para reforzar el tono dev.
- **Jerarquía por color, no por tamaño excesivo:** atenúa el texto secundario (opacidad ~0.6) en vez de encogerlo mucho.
- Bordes y separadores finos: `1px`–`2px`, `rgba(...,0.22)` sobre crema, `rgba(255,255,255,0.12)` sobre oscuro.

## Checklist antes de dar por lista una diapositiva

- [ ] Logo AWS arriba-izquierda + `// AWS User Group Orizaba`.
- [ ] Logo Kiro arriba-derecha con `kiro-logo-clean.png` (contorno negro si el fondo es claro). Excepto en la portada, que no lo lleva.
- [ ] Título grande y concreto; una sola idea.
- [ ] Un acento dominante (AWS o Kiro) con los hex exactos de arriba.
- [ ] Tipografía por rol (título / subtítulo-mono / cuerpo).
- [ ] `id`, `aria-label` "of TOTAL" y entrada en `#deck-motion` consistentes.
- [ ] Verificar en el navegador a 1920×1080 antes de cerrar.
