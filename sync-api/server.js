// Servidor del servicio de sincronización en la nube de Focus Garden.
// App Express que guarda y entrega el progreso (tareas, rondas, timer y ajustes) por persona,
// autenticando cada petición con el access token de Cognito que ya tiene la Session del
// frontend (ver src/core/cloud-sync.js). Aplica CORS por allowlist explícita (nunca origen
// abierto), igual que oidc-bridge, y monta el único contrato: GET/PUT /state.

import express from 'express';
import { isAllowedOrigin } from './lib/origins.js';
import { createStateRouter } from './routes/state.js';

const DEFAULT_PORT = 8787;

/**
 * Lee ALLOWED_ORIGINS del entorno y lo normaliza a una lista de orígenes.
 * La variable es una lista separada por comas; se parten, se recortan espacios
 * y se descartan entradas vacías. Una allowlist vacía deja al servicio sin
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
 * Middleware CORS por allowlist explícita, escrito a mano (sin el paquete cors, por la misma
 * política de dependencias que oidc-bridge). Refleja el origen SOLO si pertenece a la allowlist
 * exacta; cualquier otro no recibe cabeceras CORS y, si es una preflight (OPTIONS) de un
 * origen no permitido, se corta con 403.
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
      res.set('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

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
 * Construye la app Express con el CORS y la ruta montada. Se expone aparte de `start()` para
 * poder probarla sin abrir un puerto.
 *
 * @returns {import('express').Express}
 */
export function createApp() {
  const allowlist = parseAllowedOrigins();
  const app = express();

  // 1 MB alcanza de sobra para el progreso de una persona (tareas + rondas + ajustes) y evita
  // aceptar un cuerpo desproporcionado antes de llegar a la validación de forma de la ruta.
  app.use(express.json({ limit: '1mb' }));
  app.use(corsByAllowlist(allowlist));
  app.use(createStateRouter());

  // Manejador de errores central: traduce cualquier fallo (JSON inválido, DynamoDB caído) a
  // una respuesta clara sin filtrar detalles internos.
  app.use((err, req, res, next) => {
    console.error('[sync-api] error:', err.message);
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(500).json({ error: 'error_interno', message: err.message });
  });

  return app;
}

/**
 * Arranca el servidor. Como Lambda Web Function, debe escuchar exactamente en el host:puerto
 * que Lambda indica en AWS_LAMBDA_HTTP_ENDPOINT (p. ej. "0.0.0.0:3000"); si escucha en otro
 * lado, el runtime nunca le entrega tráfico y falla con Application.TimeoutListenError. Fuera
 * de Lambda (local, pruebas manuales), esa variable no existe y se usa PORT o el valor por
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
      console.log(`[sync-api] escuchando en ${lambdaEndpoint} (Lambda Web Function)`);
    });
  }
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  return app.listen(port, () => {
    console.log(`[sync-api] escuchando en el puerto ${port}`);
  });
}

// Arranca solo si este archivo se ejecuta directamente (no al importarlo en pruebas, ni al
// importarlo desde index.js bajo Lambda Web Functions — ver index.js).
const isMainModule = import.meta.main ?? process.argv[1]?.endsWith('server.js');
if (isMainModule) {
  start();
}
