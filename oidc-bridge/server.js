// Servidor del puente OIDC de GitHub para Focus Garden.
// App Express que traduce el login de GitHub a un proveedor OIDC que Cognito
// acepta. Aplica CORS por allowlist explícita (nunca origen abierto) con
// `isAllowedOrigin`, parsea el cuerpo del endpoint de token y monta las cinco
// rutas del contrato: discovery, jwks, authorize, callback y token.
// Los secretos (client secret de GitHub, clave privada de firma) viven en
// variables de entorno y nunca llegan al frontend.

import express from 'express';
import { isAllowedOrigin } from './lib/origins.js';
import { createDiscoveryRouter } from './routes/discovery.js';
import { createJwksRouter } from './routes/jwks.js';
import { createAuthorizeRouter } from './routes/authorize.js';
import { createCallbackRouter } from './routes/callback.js';
import { createTokenRouter } from './routes/token.js';

const DEFAULT_PORT = 8787;

/**
 * Lee ALLOWED_ORIGINS del entorno y lo normaliza a una lista de orígenes.
 * La variable es una lista separada por comas; se parten, se recortan espacios
 * y se descartan entradas vacías. Una allowlist vacía deja al puente sin
 * orígenes permitidos (rechaza todo), que es el lado seguro.
 *
 * @returns {string[]} Los orígenes permitidos, exactos.
 */
export function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
}

/**
 * Middleware CORS por allowlist explícita, escrito a mano (sin el paquete cors,
 * por la política de dependencias). Refleja el origen SOLO si pertenece a la
 * allowlist exacta; cualquier otro no recibe cabeceras CORS y, si es una
 * preflight (OPTIONS) de un origen no permitido, se corta con 403.
 *
 * @param {string[]} allowlist - Orígenes permitidos.
 * @returns {import('express').RequestHandler}
 */
export function corsByAllowlist(allowlist) {
  return (req, res, next) => {
    const origin = req.get('origin');
    const allowed = isAllowedOrigin(origin, allowlist);

    if (allowed) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // Preflight: responde aquí mismo. Permitido → 204; no permitido → 403.
    if (req.method === 'OPTIONS') {
      if (allowed) {
        res.sendStatus(204);
        return;
      }
      res.status(403).json({ error: 'origen_no_permitido' });
      return;
    }

    next();
  };
}

/**
 * Construye la app Express con el CORS y todas las rutas montadas.
 * Se expone aparte de `start()` para poder probarla sin abrir un puerto.
 *
 * @returns {import('express').Express}
 */
export function createApp() {
  const allowlist = parseAllowedOrigins();
  const app = express();

  // Cognito envía el cuerpo de /token como formulario; también se acepta JSON.
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.use(corsByAllowlist(allowlist));

  app.use(createDiscoveryRouter());
  app.use(createJwksRouter());
  app.use(createAuthorizeRouter(allowlist));
  app.use(createCallbackRouter());
  app.use(createTokenRouter());

  // Manejador de errores central: traduce cualquier fallo (config faltante,
  // GitHub caído) a una respuesta clara sin filtrar detalles internos.
  app.use((err, req, res, next) => {
    console.error('[oidc-bridge] error:', err.message);
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(500).json({ error: 'error_interno', message: err.message });
  });

  return app;
}

/**
 * Arranca el servidor. Como Lambda Web Function, debe escuchar exactamente en
 * el host:puerto que Lambda indica en AWS_LAMBDA_HTTP_ENDPOINT (p. ej.
 * "0.0.0.0:3000"); si escucha en otro lado, el runtime nunca le entrega
 * tráfico y falla con Application.TimeoutListenError. Fuera de Lambda (local,
 * pruebas manuales), esa variable no existe y se usa PORT o el valor por
 * defecto.
 *
 * @returns {import('node:http').Server}
 */
export function start() {
  const app = createApp();
  const lambdaEndpoint = process.env.AWS_LAMBDA_HTTP_ENDPOINT;
  if (lambdaEndpoint) {
    const [host, portStr] = lambdaEndpoint.split(':');
    const port = Number(portStr);
    return app.listen(port, host, () => {
      console.log(`[oidc-bridge] escuchando en ${lambdaEndpoint} (Lambda Web Function)`);
    });
  }
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  return app.listen(port, () => {
    console.log(`[oidc-bridge] escuchando en el puerto ${port}`);
  });
}

// Arranca solo si este archivo se ejecuta directamente (no al importarlo en
// pruebas). `import.meta.main` existe en Node 24+; el respaldo cubre Node 20-23.
const isMainModule = import.meta.main ?? process.argv[1]?.endsWith('server.js');
if (isMainModule) {
  start();
}
