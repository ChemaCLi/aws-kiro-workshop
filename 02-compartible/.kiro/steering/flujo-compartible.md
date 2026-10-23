---
inclusion: always
---

# Flujo de trabajo: Compartible

Escenario: el usuario sabe cómo quiere que estén hechas las cosas, pero no tiene del todo claro qué construir. La app la usarán otras personas, así que debe entenderse sin explicaciones verbales y respetar los principios acordados.

## Regla central

Los principios de `principios.md` se respetan siempre. Si una idea del usuario o tuya los rompe:
1. Dilo en una frase y explica qué principio rompe.
2. Propón al menos una alternativa que sí lo respete.
3. Si el usuario decide hacer la excepción, regístrala en `docs/decisiones.md` con el motivo.

## Fases

### Fase 1 · Definir el qué
- Para quién es, qué problema le resuelve y cuál es la salida esperada.
- De 3 a 5 funciones núcleo. Todo lo demás va a "Más adelante".
- Qué queda fuera de alcance.
- Entregable: `docs/requerimientos.md` (usa al agente `analista-requerimientos`).

### Fase 2 · Acordar principios
- Presenta los principios de `principios.md` en lenguaje simple y pregunta si el usuario quiere agregar o cambiar alguno.
- Entregable: `docs/principios-acordados.md` con la lista final.

### Fase 3 · Diseño ligero
- Flujo del usuario, pantallas con sus estados (vacío, cargando, error) y modelo de datos.
- Plan de tareas pequeñas.
- Entregable: `docs/diseno.md` (usa al agente `disenador`).

### Fase 4 · Construir y probar
- Una tarea a la vez con el `constructor`.
- Cada tarea la verifica el `tester` y la revisa el `revisor` contra los principios.
- Si alguno responde `NECESITA_CAMBIOS`, regresa la tarea al constructor.

### Fase 5 · Preparar para compartir
- README para usuarios: qué hace, cómo se usa y capturas de pantalla.
- Datos de ejemplo para que quien la pruebe no empiece con la app vacía.
- Revisión de privacidad: qué datos guarda y dónde.
- Publicación como sitio estático (por ejemplo GitHub Pages, Netlify o Vercel), con pasos explicados.

## Autocuestionamiento (antes de cada respuesta)

1. ¿Esto respeta los principios acordados?
2. ¿Una persona que no conoce la app entendería esta pantalla sin ayuda?
3. ¿Estoy agregando funciones que nadie pidió?
4. ¿Estoy suponiendo algo? Pregunta o regístralo como supuesto.
5. ¿Lo verifiqué antes de decir que funciona?

## Si el usuario quiere saltarse fases

Puede hacerlo, excepto la fase 2: los principios deben estar acordados antes de construir. Si insiste, explica en una línea el riesgo y regístralo en `docs/decisiones.md`.

## Estado

Mantén `docs/estado.md` con la fase actual, lo hecho y el siguiente paso.
