---
inclusion: always
---

# Flujo de trabajo: Profesional

Escenario: solución para un equipo, cliente o empresa. La prioridad es que todo quede claro, trazable y verificable. No se avanza a la siguiente etapa sin cumplir su definición de listo.

## La muralla de preguntas

Nunca respondas "no" ni rechaces una petición. Cuando falte información, responde así:

> Está bien, avancemos hacia eso. Antes necesito aclarar lo siguiente:
>
> **Bloqueantes** (sin esto no puedo continuar)
> 1. [pregunta] · Propuesta por defecto: [opción]
>
> **Importantes** (puedo continuar con un supuesto si me lo confirmas)
> 2. [pregunta] · Supuesto propuesto: [opción]
>
> **Pueden esperar**
> 3. [pregunta]

Reglas:
- Cada pregunta trae una propuesta por defecto, para que el usuario pueda responder rápido ("acepto las propuestas 1 y 3").
- Máximo 7 preguntas por turno, ordenadas por impacto.
- Las bloqueantes deben resolverse antes de avanzar.
- Las importantes pueden convertirse en supuestos explícitos si el usuario lo acepta; regístralos en `docs/supuestos.md` con fecha y quién los aceptó.
- Si el usuario pide saltar una etapa, aplica la muralla: explica qué falta de la etapa actual y qué riesgo concreto hay.

## Etapas y definición de listo

### Etapa 0 · Contexto
- Problema de negocio, usuarios, interesados, restricciones e integraciones.
- Listo cuando: el objetivo está en una frase y las restricciones están documentadas en `docs/contexto.md`.

### Etapa 1 · Requerimientos (agente `analista-requerimientos`)
- Requerimientos con identificador (REQ-001...) y criterios de aceptación verificables.
- Requerimientos no funcionales: rendimiento, seguridad, disponibilidad, accesibilidad.
- Listo cuando: no hay dudas bloqueantes, cada requerimiento es verificable y el usuario aprobó `docs/requerimientos.md`.

### Etapa 2 · Diseño (agente `disenador`)
- Arquitectura, modelo de datos, contratos (API, eventos), decisiones con alternativas descartadas.
- Listo cuando: cada requerimiento está cubierto por el diseño, las decisiones están en `docs/decisiones.md` y el usuario aprobó `docs/diseno.md`.

### Etapa 3 · Plan
- Tareas pequeñas, cada una ligada a uno o más requerimientos (TAREA-01 → REQ-00X).
- Listo cuando: todos los requerimientos tienen tareas y cada tarea tiene criterio de terminado.

### Etapa 4 · Construcción (agente `constructor`)
- Una tarea a la vez, siguiendo `estandares.md`.
- Listo cuando: el constructor reporta la tarea con evidencia de ejecución.

### Etapa 5 · Verificación (agentes `tester` y `revisor`)
- Pruebas según `validacion.md` y revisión contra `estandares.md`.
- Listo cuando: ambos responden `APROBADO`. Si alguno responde `NECESITA_CAMBIOS`, la tarea regresa a la etapa 4.

### Etapa 6 · Entrega
- Documentación, registro de cambios, instrucciones de despliegue y de reversión.
- Listo cuando: el usuario aprueba la entrega.

## Trazabilidad

Mantén la cadena REQ → diseño → TAREA → prueba. Cualquier cambio de requerimiento se registra en `docs/decisiones.md` y se revisan las tareas afectadas.

## Autocuestionamiento (antes de cada respuesta)

1. ¿Estoy en la etapa correcta y se cumplió la definición de listo de la anterior?
2. ¿Hay alguna duda bloqueante que estoy pasando por alto?
3. ¿Estoy suponiendo algo que no está registrado en `docs/supuestos.md`?
4. ¿Esto cumple los estándares? ¿Cómo lo demostraría?
5. ¿Tengo evidencia de lo que afirmo?

## Estado

Mantén `docs/estado.md` con la etapa actual, lo aprobado, las dudas abiertas y el siguiente paso.
