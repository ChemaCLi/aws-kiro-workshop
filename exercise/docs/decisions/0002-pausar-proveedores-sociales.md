# 0002. Pausar Google, Meta, Amazon y GitHub; quedarse con correo y contraseña

| Campo | Valor |
|-------|-------|
| Estado | Aceptada |
| Fecha | 2026-11-03 |
| Decide | La persona dueña del proyecto |

## Contexto

El spec `accounts-auth` (completado el 2026-11-01) implementa los cinco métodos de inicio de sesión: correo y contraseña, Google, Meta, Login with Amazon y GitHub (este último vía `oidc-bridge/`). El primer despliegue real a AWS (2026-11-03) llegó hasta dejar funcionando:

- El sitio estático en S3 + CloudFront.
- Un User Pool de Cognito con App Client público (PKCE) y **correo y contraseña ya operativo**.
- El puente OIDC de GitHub desplegado en Lambda Web Functions, con su tabla de DynamoDB para el code-store, y registrado del lado de Cognito como proveedor OIDC (`GitHubBridge`).

Lo que falta para que los otros cuatro métodos funcionen de punta a punta son credenciales reales de terceros: una OAuth App en GitHub, y clientes OAuth en Google Cloud Console, Meta for Developers y Login with Amazon, cada una con su propio flujo de creación, verificación y (en el caso de Meta y Google) posible revisión de la app antes de salir de modo de prueba. Es trabajo real pero independiente del resto del producto.

## Decisión

Se pausa la configuración de Google, Meta, Amazon y GitHub. Mientras tanto:

- `account-view.js` solo expone los formularios de correo y contraseña; los botones de proveedor social se ocultan (`PROVIDERS = []` en `src/views/account-view.js`), no se eliminan: basta con devolver la lista a sus cuatro entradas para que reaparezcan.
- El código del flujo OAuth con PKCE para los cuatro proveedores (`src/core/auth.js`), el puente OIDC (`oidc-bridge/`) y su infraestructura en AWS (Lambda, DynamoDB, el registro `GitHubBridge` en Cognito) **se quedan como están**, desplegados y funcionando; no se desmontan. Solo falta darles las credenciales reales de cada proveedor y volver a mostrar sus botones.
- El trabajo siguiente es avanzar con los specs 3 (`cloud-sync`) y 4 (`multi-device-sessions`) de `exercise/docs/current-plan.md`, que no dependen de tener los cuatro proveedores sociales activos: correo y contraseña ya basta para probar guardado en la nube y sincronización entre dispositivos.

## Consecuencias

- `exercise/docs/features.md`: los casos de uso C3/C4 (proveedores sociales) quedan marcados "en pausa"; ver la tabla actualizada del módulo `accounts-auth`.
- `exercise/docs/current-plan.md` sigue marcando el spec 2 (`accounts-auth`) como completado: el código y el diseño no cambian, solo se pospone terminar de conectar cuatro de sus cinco métodos con proveedores reales.
- Quien pruebe el sitio desplegado hoy solo puede crear cuenta o iniciar sesión con correo y contraseña. Es una limitación temporal, no un cambio de alcance del spec.

## Cómo retomar los proveedores pausados

1. Crear la OAuth App de GitHub (redirect: `<url del puente>/callback`) y fijar `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` como variables de entorno del puente (ya hay una tabla de GitHub Secrets/Variables documentada en `.kiro/skills/deploy-to-aws/SKILL.md`).
2. Crear los clientes OAuth de Google, Meta y Login with Amazon (redirect: `<dominio de Cognito>/oauth2/idpresponse` en los tres casos) y registrarlos en Cognito con `create-identity-provider`.
3. Agregar cada proveedor a `SupportedIdentityProviders` del App Client (lectura-modificación-escritura; `update-user-pool-client` reemplaza el recurso completo).
4. Devolver `PROVIDERS` a sus cuatro entradas en `src/views/account-view.js` y volver a publicar el sitio.
