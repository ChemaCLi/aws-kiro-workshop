# tareas-app

Aplicación web personal, pensada para usarse en el navegador de un teléfono, para
organizar tus tareas. Puedes registrar una tarea (descripción, tipo, duración
estimada y fecha límite), trabajarla con un temporizador estilo pomodoro que acumula
el tiempo real invertido, y marcarla como completada para que salga de la lista y
avance una barra de progreso. Los datos se guardan en el navegador (`localStorage`),
así que no necesitas cuenta ni inicio de sesión.

## Cómo ejecutarla

Necesitas [Node.js](https://nodejs.org) (versión LTS). Desde esta carpeta:

```bash
npm install     # instala las dependencias (solo la primera vez)
npm run dev     # inicia la app en modo desarrollo
```

Luego abre en el navegador la dirección que aparece en la terminal (normalmente
`http://localhost:5173`).

## Pruebas

```bash
npx vitest run  # ejecuta todas las pruebas una vez
```

## Cómo está organizado el código

```
src/
  componentes/   piezas de interfaz reutilizables
  pantallas/     la pantalla principal de la app
  logica/        reglas y cálculos puros, sin interfaz
  datos/         guardar y leer datos en el navegador
```

## Herramientas

- Vite + React + TypeScript
- Tailwind CSS (estilos pensados primero para pantalla de teléfono)
- Vitest y fast-check para las pruebas
