# Taller: Construye apps con IA usando Kiro

Prompts, reglas y agentes para construir aplicaciones con IA siguiendo un método claro: **entrada → proceso → salida**, diseñado empezando por la salida.

## ¿Qué carpeta uso?

| Carpeta | Úsala cuando | Rigor |
|---------|--------------|-------|
| [`01-exploracion`](01-exploracion/) | No tienes clara la idea y no te importa cómo está hecha por dentro | Bajo: se aceptan sorpresas |
| [`02-compartible`](02-compartible/) | Sabes cómo quieres las cosas, pero no tanto qué; otras personas la usarán | Medio: se respetan principios |
| [`03-profesional`](03-profesional/) | Es para un equipo, cliente o empresa | Alto: muralla de preguntas, estándares y evidencia |

## Cómo empezar

1. Instala Kiro: https://kiro.dev/downloads (o usa Kiro Web: https://kiro.dev/web).
2. Descarga este repositorio (botón **Code › Download ZIP**, o `git clone`).
3. Copia la carpeta de tu escenario a donde quieras trabajar y renómbrala con el nombre de tu app.
4. Abre esa carpeta en Kiro (**File › Open Folder**).
5. Abre el chat, pega el contenido de `prompt-inicio.md`, completa lo que está entre corchetes y envíalo.
6. Responde las preguntas del agente y deja que el flujo te guíe.

> **Ojo:** la carpeta `.kiro` es oculta. En macOS se muestra en Finder con `Cmd + Shift + .`; en Windows, desde el Explorador en **Vista › Mostrar › Elementos ocultos**. Si copias la carpeta completa del escenario, `.kiro` se copia sola.

Desde la terminal (macOS o Linux):

```bash
cp -r 01-exploracion ~/proyectos/mi-app
```

En Windows (PowerShell):

```powershell
Copy-Item -Recurse 01-exploracion $HOME\proyectos\mi-app
```

## Qué hay dentro de cada escenario

```
0X-escenario/
├── README.md              cuándo usarlo
├── prompt-inicio.md       lo que pegas en el chat
└── .kiro/
    ├── steering/          reglas que Kiro lee siempre: flujo, preset técnico, principios
    └── agents/            el equipo de agentes
```

- **Steering** (`.kiro/steering/*.md`): reglas del proyecto que Kiro incluye en cada conversación. Aquí está el flujo de trabajo, las herramientas por defecto y los principios.
- **Agentes** (`.kiro/agents/*.md`): agentes personalizados de Kiro. El agente `guia` conduce el flujo y delega en los demás como subagentes.

## El equipo de agentes

| Agente | Qué hace |
|--------|----------|
| `guia` | Conduce el flujo del escenario y delega en los especialistas |
| `analista-requerimientos` | Extrae qué quieres mediante preguntas y documenta requerimientos |
| `disenador` | Define flujo de usuario, pantallas, modelo de datos y plan de tareas |
| `constructor` | Implementa una tarea a la vez y reporta cómo probarla |
| `tester` | Verifica con pruebas automáticas y una guía de prueba manual |
| `revisor` | Revisa contra principios y estándares, sin modificar archivos |

Los agentes son los mismos en los tres escenarios. Las reglas de `.kiro/steering/` definen qué tan rigurosos son. La copia maestra está en [`agentes/`](agentes/); si cambias un agente, actualiza las copias con `./sincronizar-agentes.sh`.

Puedes invocarlos por nombre en el chat, por ejemplo: `Usa el agente tester para verificar la TAREA-02`.

## Antes de abrir Kiro

Llena [`plantillas/ficha-idea.md`](plantillas/ficha-idea.md): salida esperada, para quién, datos que necesitas y cómo sabrás que funciona. Con eso, la conversación con la IA rinde mucho más.

O más fácil: abre [`plantillas/llenar-ficha.html`](plantillas/llenar-ficha.html) en tu navegador (doble clic). Es un formulario que te guía paso a paso, sugiere tu escenario y genera el prompt listo para pegar en Kiro, además de la ficha en Markdown.

## Personalízalo

- Cambia el stack en `preset-tecnico.md`.
- Agrega tus principios en `02-compartible/.kiro/steering/principios.md`.
- Reemplaza los marcadores `[...]` de `03-profesional` con los estándares de tu equipo.

## Recursos

- Kiro: https://kiro.dev
- Documentación: https://kiro.dev/docs
- Agentes personalizados: https://kiro.dev/docs/custom-agents/
- Steering: https://kiro.dev/docs/steering/
- Kiro Crew: https://kiro.dev/crew · https://github.com/kirodotdev/KiroCrew
- Plan de estudiante: https://kiro.dev/students
