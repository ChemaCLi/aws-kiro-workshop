# Taller: Todos pueden programar con Kiro

Material de apoyo del workshop de **AWS User Group Orizaba**. Aquí están la presentación, el proyecto de ejemplo y los presets de Kiro para generar aplicaciones web con facilidad.

## Qué hay en este repositorio

| Carpeta | Contenido |
|---------|-----------|
| [`.kiro/`](.kiro/) | Presets de Kiro para generar aplicaciones web con facilidad: steering, agentes, skills, specs de ejemplo y workflows |
| [`exercise/`](exercise/) | Ejemplo del proyecto que se desarrolla en el taller: **Focus Garden**, una lista de tareas con pomodoro y un jardín 3D |
| [`workshop/`](workshop/) | La presentación y el material de apoyo del taller |

## Versión en línea

Las tres piezas del taller están publicadas en AWS (S3 + CloudFront, con HTTPS):

| Pieza | Enlace |
|-------|--------|
| Presentación del taller | https://d1z03etewpzrzo.cloudfront.net |
| Generador de prompts | https://drkfrxxs7pcro.cloudfront.net |
| Focus Garden (lista de tareas con pomodoro y jardín 3D) | https://dncc4bsnnymsj.cloudfront.net |

> **Nota:** la presentación en línea se retirará en 2 semanas (alrededor del 13 de noviembre de 2026), porque incluye videos que hacen más costoso el alojamiento. Después de esa fecha, el enlace dejará de funcionar. Las diapositivas seguirán disponibles en este repositorio, en `workshop/presentation/presentation.html`.
>
> El Focus Garden publicado en línea es de **antes** de la migración a Astro (ver arriba): se desplegó copiando los archivos fuente directamente, como describía la skill `deploy-to-aws`. Para republicar la versión migrada hace falta `npm run build` y subir `dist/`, que esa skill ya actualizó.

## `.kiro/`: presets para generar apps web

La carpeta `.kiro` es oculta. En macOS se muestra en Finder con `Cmd + Shift + .`; en Windows, desde el Explorador en **Vista › Mostrar › Elementos ocultos**.

| Subcarpeta | Qué es |
|------------|--------|
| `steering/` | Reglas que Kiro lee en cada conversación: producto, stack técnico, arquitectura, sistema de diseño, estándar de código, política de dependencias, documentación y formato de specs |
| `agents/` | Agentes personalizados: `coder`, `documenter`, `entorno-tools` y `qa-tester` |
| `skills/` | Guías que Kiro activa según la tarea: melodías lofi, despliegue en AWS, migración a React o Vue, diapositivas del taller, diseño responsive, mundo 3D, timer en Web Worker y pruebas unitarias con Vitest |
| `sample-specs/` | Siete specs de ejemplo, en orden, para construir la app paso a paso |
| `specs/` | Specs de trabajo del proyecto |
| `workflows/` | Workflows reutilizables |

Para usarlos en tu propia app, copia la carpeta `.kiro` a la raíz de tu proyecto y ábrelo en Kiro.

## `exercise/`: el proyecto de ejemplo

Focus Garden es una app web con **Astro + Vite** (migrada desde Web Components nativos sin build; ver [`exercise/docs/decisions/0001-migrar-a-astro.md`](exercise/docs/decisions/0001-migrar-a-astro.md)). Cada tarea terminada con rondas de pomodoro hace crecer una planta en una isla 3D.

Para probarla:

```bash
cd exercise
npm install
npm run dev
```

Abre la URL que imprime Astro (por defecto http://localhost:4321). Hay más detalle en [`exercise/README.md`](exercise/README.md) y en [`exercise/docs/`](exercise/docs/).

## `workshop/`: presentación y material de apoyo

- [`workshop/presentation/`](workshop/presentation/): las diapositivas (`presentation.html`) y sus recursos (imágenes y videos).
- [`workshop/prompts/`](workshop/prompts/): página con los prompts que se usan durante el taller.

## Cómo empezar

1. Instala Kiro: https://kiro.dev/downloads (o usa Kiro Web: https://kiro.dev/web).
2. Descarga este repositorio (botón **Code › Download ZIP**, o `git clone`).
3. Abre la carpeta en Kiro (**File › Open Folder**).
4. Revisa la presentación en `workshop/presentation/presentation.html` y sigue los specs de `.kiro/sample-specs/`.

## Recursos

- Kiro: https://kiro.dev
- Documentación: https://kiro.dev/docs
- Agentes personalizados: https://kiro.dev/docs/custom-agents/
- Steering: https://kiro.dev/docs/steering/
- Plan de estudiante: https://kiro.dev/students
