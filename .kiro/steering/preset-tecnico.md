---
inclusion: always
---

# Preset técnico: Exploración

El usuario no quiere decidir cómo está hecha la app. Usa este preset por defecto, salvo que el usuario pida otra cosa.

## Stack por defecto

- App web que corre en el navegador.
- Vite + React + TypeScript (versiones estables actuales).
- Estilos con Tailwind CSS.
- Datos guardados en el navegador con `localStorage`, detrás de un módulo `src/datos/almacen.ts` para poder cambiarlo después.
- Sin servidor, sin inicio de sesión y sin cuentas, a menos que el usuario lo pida.
- Pruebas de la lógica con Vitest.

## Si el usuario no puede instalar nada

Si no tiene Node.js o no puede instalarlo, usa un solo archivo `index.html` con HTML, CSS y JavaScript, que se abra con doble clic. Explícale que es una versión más simple.

## Estructura de carpetas

```
src/
  componentes/   piezas de interfaz reutilizables
  pantallas/     una carpeta o archivo por pantalla
  logica/        reglas y cálculos, sin interfaz
  datos/         guardar y leer datos
docs/            visión, verificación, decisiones y estado
```

## Comandos

- Crear el proyecto: `npm create vite@latest . -- --template react-ts`
- Instalar dependencias: `npm install`
- Ejecutar: `npm run dev`
- Probar: `npx vitest run`

Si el usuario no tiene Node.js instalado, guíalo paso a paso desde https://nodejs.org (versión LTS) antes de empezar.

## Librerías

No agregues librerías fuera de este preset sin explicarle al usuario en una frase para qué sirven.
