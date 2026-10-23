# 03 · Profesional

**Úsalo cuando:** el resultado es para un equipo, un cliente o una empresa, y necesitas que todo quede claro antes de avanzar.

**Qué hace por ti:** el agente aplica la **muralla de preguntas**: nunca responde "no", responde "Está bien, pero antes aclaremos estas dudas". Avanza por etapas con puertas de entrada, sigue estándares explícitos y demuestra con evidencia que se aplicaron.

## Qué incluye

| Archivo | Para qué sirve |
|---------|----------------|
| `prompt-inicio.md` | El mensaje que pegas en el chat de Kiro para empezar |
| `.kiro/steering/flujo-profesional.md` | Etapas, puertas y protocolo de la muralla de preguntas |
| `.kiro/steering/estandares.md` | Principios, patrones y convenciones (reemplaza con los de tu equipo) |
| `.kiro/steering/validacion.md` | Cómo se comprueba que los estándares se aplicaron |
| `.kiro/steering/preset-tecnico.md` | Stack del equipo (define el tuyo) |
| `.kiro/agents/` | El equipo de agentes |

## Flujo

Contexto → Requerimientos → Diseño → Plan → Construcción → Verificación → Entrega

Cada etapa tiene una **definición de listo**. No se avanza mientras haya dudas bloqueantes.

## Compatibilidad con el modo Spec de Kiro

Si usas el modo Spec, los requerimientos, el diseño y las tareas viven en `.kiro/specs/<funcionalidad>/`. Las reglas de esta carpeta aplican igual: el agente debe resolver la muralla de preguntas antes de aprobar cada documento.

**Antes de usarlo en un proyecto real:** reemplaza los marcadores `[...]` de `estandares.md`, `validacion.md` y `preset-tecnico.md` con los de tu equipo.
