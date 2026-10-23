---
inclusion: always
---

# Cómo se valida que los estándares se aplicaron

Cada estándar tiene una forma de comprobarse. Ninguna tarea se da por terminada sin evidencia.

## Validación automática

| Qué se valida | Cómo | Umbral |
|---------------|------|--------|
| Estilo y errores comunes | Linter: [ESLint u otro] | 0 errores |
| Formato | Formateador: [Prettier u otro] | Sin cambios pendientes |
| Tipos | [`tsc --noEmit` u otro] | 0 errores |
| Lógica de negocio | Pruebas unitarias | Cobertura mínima: [80]% en dominio |
| Integraciones | Pruebas de integración | Todos los contratos cubiertos |
| Flujos críticos | Pruebas de extremo a extremo: [Playwright u otro] | Flujos principales cubiertos |
| Dependencias | [`npm audit` u otro] | Sin vulnerabilidades altas o críticas |
| Secretos | [herramienta de escaneo] | 0 hallazgos |

## Validación manual (agente `revisor`)

- El código corresponde al diseño aprobado.
- Se respetan los patrones de `estandares.md`.
- Los nombres y la estructura se entienden sin explicación.
- El manejo de errores es explícito y útil.
- Los cambios están ligados a una TAREA y a un REQ.

## Definición de terminado

Una tarea está terminada cuando:
1. Cumple sus criterios de aceptación (tester: `APROBADO`).
2. Pasa toda la validación automática.
3. Pasa la revisión (revisor: `APROBADO`).
4. La documentación afectada está actualizada.
5. El reporte incluye la evidencia: comandos ejecutados y resultados.

## Formato de evidencia

```markdown
## Evidencia TAREA-0X
- Linter: `npm run lint` → 0 errores
- Tipos: `npx tsc --noEmit` → 0 errores
- Pruebas: `npm test` → 42 pasan, 0 fallan · cobertura dominio 86%
- Revisión: APROBADO (ver reporte del revisor)
```
