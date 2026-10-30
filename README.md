# Taller: Todos pueden programar con Kiro

Material de apoyo del workshop de **AWS User Group Orizaba**. Aquí están la presentación, el proyecto de ejemplo y los presets de Kiro para generar aplicaciones web con facilidad.

## Qué hay en este repositorio

| Carpeta | Contenido |
|---------|-----------|
| [`.kiro/`](.kiro/) | Presets de Kiro para generar aplicaciones web con facilidad: steering, agentes, skills, specs de ejemplo y workflows |
| [`exercise/`](exercise/) | Ejemplo del proyecto que se desarrolla en el taller: **Focus Garden**, una lista de tareas con pomodoro y un jardín 3D |
| [`workshop/`](workshop/) | La presentación y el material de apoyo del taller |

## `.kiro/`: presets para generar apps web

La carpeta `.kiro` es oculta. En macOS se muestra en Finder con `Cmd + Shift + .`; en Windows, desde el Explorador en **Vista › Mostrar › Elementos ocultos**.

| Subcarpeta | Qué es |
|------------|--------|
| `steering/` | Reglas que Kiro lee en cada conversación: producto, stack técnico, arquitectura, sistema de diseño, estándar de código, política de dependencias, documentación y formato de specs |
| `agents/` | Agentes personalizados: `coder`, `documenter`, `entorno-tools` y `qa-tester` |
| `skills/` | Guías que Kiro activa según la tarea: melodías lofi, despliegue en AWS, migración a React o Vue, diapositivas del taller, diseño responsive, mundo 3D y timer en Web Worker |
| `sample-specs/` | Siete specs de ejemplo, en orden, para construir la app paso a paso |
| `specs/` | Specs de trabajo del proyecto |
| `workflows/` | Workflows reutilizables |

Para usarlos en tu propia app, copia la carpeta `.kiro` a la raíz de tu proyecto y ábrelo en Kiro.

## `exercise/`: el proyecto de ejemplo

Focus Garden es una app web sin build ni bundler (HTML, JavaScript ES modules, Web Components, Tailwind, Tone.js y Three.js por CDN). Cada tarea terminada con rondas de pomodoro hace crecer una planta en una isla 3D.

Para probarla, abre `exercise/index.html` o sírvela con cualquier servidor estático:

```bash
cd exercise
python3 -m http.server 8000
```

Después entra a http://localhost:8000. Hay más detalle en [`exercise/README.md`](exercise/README.md) y en [`exercise/docs/`](exercise/docs/).

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
