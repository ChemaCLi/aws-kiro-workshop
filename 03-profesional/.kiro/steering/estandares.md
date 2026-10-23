---
inclusion: always
---

# Estándares, patrones y principios

> Reemplaza o ajusta esta sección con los estándares de tu equipo. Lo que está aquí es un punto de partida razonable.

## Principios
- **SOLID**, aplicado con criterio: responsabilidad única y dependencias hacia abstracciones.
- **KISS y YAGNI:** la solución más simple que cumpla los requerimientos; nada "por si acaso".
- **DRY con juicio:** no dupliques reglas de negocio; tolera duplicación pequeña si abstraer complica.
- **Fallar de forma explícita:** errores claros, nunca silenciosos.

## Patrones de arquitectura
- Backend: capas o arquitectura hexagonal (dominio, aplicación, infraestructura). El dominio no depende de frameworks.
- Acceso a datos mediante repositorios.
- Inyección de dependencias para facilitar pruebas.
- Frontend: organización por funcionalidad; componentes de presentación separados de la lógica.
- [Patrones propios del equipo]

## Convenciones
- Nombres: [idioma del código: inglés | español], camelCase para variables y funciones, PascalCase para clases y componentes.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Ramas: [por ejemplo `feature/REQ-001-descripcion`].
- Cada cambio pasa por revisión antes de integrarse.

## APIs
- REST con recursos en plural, códigos HTTP correctos y formato de error uniforme: `{ "error": { "code": "...", "message": "..." } }`.
- Versionado: [por ejemplo `/v1/`].
- Contratos documentados: [OpenAPI u otro].

## Seguridad
- Base: OWASP Top 10.
- Validación de toda entrada externa.
- Secretos solo en variables de entorno o gestor de secretos; nunca en el repositorio.
- Mínimo privilegio en accesos y permisos.
- Datos personales: [normativa aplicable, por ejemplo la ley de protección de datos de tu país].

## Observabilidad
- Logs estructurados con nivel, contexto e identificador de correlación.
- Sin datos sensibles en los logs.
- [Métricas y alertas requeridas]
