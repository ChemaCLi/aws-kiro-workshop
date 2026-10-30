---
inclusion: always
---

# Estándar de código

Prioridad: **código autoexplicativo y limpio antes que corto**. Quien lo lea en seis meses debe entender la intención sin ejecutarlo.

## Nombres

- Nombres que dicen qué es o qué hace: `remainingMs`, `plantForRounds`, `openAddTask`. Evitar `d`, `x`, `tmp`, `data`, `handle`.
- Funciones con verbo (`computeStats`, `announceCompletion`), valores con sustantivo, booleanos con `is/has/can` o estado claro (`locked`, `running`).
- Las unidades van en el nombre cuando hay riesgo: `totalMs`, `seconds`, `SWIPE_DELETE_PX`.
- Constantes con nombre en lugar de números mágicos: `const SWIPE_DELETE_PX = 90`.
- Código en inglés (identificadores). Textos visibles y comentarios en español.

## Funciones y métodos

- Una función hace una cosa. Si necesitas la palabra "y" para describirla, divídela.
- Si un bloque dentro de una función necesita un comentario para explicarse, extráelo a una función con ese nombre.
- Preferir retornos tempranos a anidar condiciones.
- Preferir `if` claros a ternarios encadenados o expresiones booleanas largas; nombrar la condición con una variable (`const isRoundInProgress = status === 'running' || status === 'paused'`).
- Sin efectos escondidos: una función `get`/`compute` no muta estado.

## Comentarios y descripciones

- Cada archivo abre con 1 a 3 líneas que explican qué módulo es y su responsabilidad.
- Cada función pública, método de `Store` y clase lleva un comentario breve (`/** ... */`) que describe **la intención y el porqué**, no repite el nombre.
  - Mal: `/** Suma uno al contador */`
  - Bien: `/** Una ronda terminada se guarda como hecho; la planta se deriva después. */`
- Comentar decisiones no obvias (por qué un worker, por qué `endsAt`, por qué un respaldo). No comentar lo evidente.
- Un comentario desactualizado es un bug: al cambiar el código, cambia su comentario.

## Estructura de un componente

Orden dentro de una clase: campos privados, `setup`, `update`, métodos de pintado (`#row`, `#paint`), manejadores de eventos (`#onClick`), `teardown`. Los métodos privados usan `#`.

## HTML generado

- Plantillas con template literals, partidas en funciones pequeñas (`#row`, `kpi`, `donut`).
- Atributos `data-act`, `data-id`, `data-tab` para delegar eventos; no un listener por elemento.
- Todo texto dinámico pasa por `esc()`.

## Errores y degradación

- Capturar solo donde se pueda actuar. `catch {}` vacío únicamente con un comentario que diga por qué es seguro.
- Los recursos opcionales (Tone.js, Three.js, vibración, wake lock) se comprueban antes de usarse.

## Formato

- ES modules, `const` por defecto, comillas simples, punto y coma, 2 espacios, líneas de hasta ~120 caracteres.
- Imports ordenados: core, ui, componentes.

## Antes de dar algo por terminado

1. Releer el diff como si fuera de otra persona: ¿se entiende sin explicación?
2. ¿Hay nombres genéricos, funciones largas o comentarios que solo repiten el código?
3. ¿Se actualizó el README del módulo y su changelog? (ver `docs-and-qa.md`)
