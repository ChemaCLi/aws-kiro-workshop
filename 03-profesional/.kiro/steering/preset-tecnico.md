---
inclusion: always
---

# Preset técnico: Profesional

> Define aquí el stack de tu equipo. Si el proyecto ya tiene uno, el agente debe respetarlo y nunca cambiarlo sin aprobación.

## Stack del equipo
- Lenguaje: [por ejemplo TypeScript]
- Frontend: [por ejemplo React + Vite]
- Backend: [por ejemplo Node.js + Fastify o Express]
- Base de datos: [por ejemplo PostgreSQL]
- Mensajería: [si aplica]
- Pruebas: [por ejemplo Vitest y Playwright]
- Contenedores: [por ejemplo Docker]
- Integración continua: [por ejemplo GitHub Actions]
- Nube o servidores: [si aplica]

## Reglas
- No agregues dependencias nuevas sin registrar la decisión en `docs/decisiones.md`, con motivo y alternativa.
- Respeta la estructura de carpetas existente. Si no existe, propón una en la etapa de diseño y espera aprobación.
- Configuración por entorno mediante variables de entorno, con un archivo `.env.example` sin valores reales.
