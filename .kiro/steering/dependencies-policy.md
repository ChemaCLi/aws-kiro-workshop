---
inclusion: always
---

# Política de dependencias

**Por defecto no se agregan librerías externas.** Cada dependencia es peso, riesgo y algo que el alumno debe entender. Lo sencillo se escribe localmente.

## Antes de proponer una librería

Responder en este orden:

1. ¿El navegador ya lo hace? (`fetch`, `Intl`, `structuredClone`, `<dialog>`, `IntersectionObserver`, `Web Worker`, CSS).
2. ¿Se resuelve con menos de ~50 líneas propias y claras? Entonces se escribe en `src/core/` o `src/ui/`.
3. ¿Es realmente complejo (renderizado 3D, síntesis de audio, gráficas con miles de puntos)? Solo entonces se considera una librería.

## Qué se escribe localmente

- Peticiones y carga de JSON: una función `fetchJson(url)` pequeña, no axios.
- Fechas: `Intl.DateTimeFormat` y funciones de `rules.js`, no moment/dayjs.
- Identificadores: `uid()` del store, no uuid.
- Gráficas simples (dona, barras): SVG propio como en `stats-view.js`, no Chart.js.
- Iconos: `ui/icons.js`, no una librería de íconos.
- Eventos entre componentes: eventos en `document`, no un bus externo.
- Utilidades (debounce, clamp, formateo): una función en `ui/util.js`.

## Qué sí puede venir de CDN

Solo lo complejo, siempre por CDN con versión fija, sin instalar nada:

| Librería | Para qué | Cómo se carga |
|----------|----------|---------------|
| Tailwind | Estilos | `<script src="https://cdn.tailwindcss.com">` |
| Tone.js | Música y sonidos | `<script>` con versión fija, `defer` |
| Three.js | Mundo 3D | Import map + `import()` dinámico |

Reglas para una nueva librería por CDN:

- Versión fija en la URL (nunca `latest`).
- Cargarla solo donde se necesita (dinámicamente si es pesada).
- La app debe seguir funcionando si falla. Escribir la degradación elegante.
- Documentarla en `tech.md` y en el README del módulo que la usa, con el motivo.
- Pedir confirmación al usuario antes de agregarla.

## Excepción: migración de tecnología

Si el usuario migró a otro stack (React, Vue u otro, ver skill `migrate-to-react-or-vue`), esta política deja de limitarse a CDN: se usan los paquetes del ecosistema elegido, manteniendo el criterio de arriba (lo simple, local). Actualizar `tech.md` cuando eso ocurra.
