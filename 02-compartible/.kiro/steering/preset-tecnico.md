---
inclusion: always
---

# Preset técnico: Compartible

Usa este preset por defecto, salvo que el usuario o `principios.md` indiquen otra cosa.

## Stack por defecto

- App web: Vite + React + TypeScript (versiones estables actuales).
- Estilos con Tailwind CSS, con diseño adaptable a celular.
- Datos en el navegador (`localStorage` o IndexedDB), detrás de un módulo `src/datos/almacen.ts`.
- Calidad: ESLint y Prettier.
- Pruebas: Vitest y Testing Library.
- Publicación: sitio estático (GitHub Pages, Netlify o Vercel).

## Estructura de carpetas

```
src/
  componentes/
  pantallas/
  logica/
  datos/
  pruebas/        o archivos *.test.ts junto al código
public/           íconos e imágenes
docs/             requerimientos, principios, diseño, decisiones, estado
```

## Comandos

- Ejecutar: `npm run dev`
- Revisar estilo: `npm run lint`
- Probar: `npx vitest run`
- Construir para publicar: `npm run build`

## Librerías

Antes de agregar una librería fuera del preset, explica para qué sirve y si afecta algún principio (tamaño, privacidad, accesibilidad). Pide confirmación.
