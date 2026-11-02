// Ruta del JWKS del puente OIDC.
// Publica la clave PÚBLICA de firma para que Cognito valide los ID token que
// emite el puente. Solo expone material público (derivado de la clave privada
// de entorno); nunca la clave privada. Es un GET sin estado ni secretos.

import { Router } from 'express';
import { exportPublicJwks } from '../lib/jwt.js';

/**
 * Crea el router de `/.well-known/jwks.json`.
 * Devuelve el documento JWKS con la clave pública RSA (kid, use, alg). Si la
 * configuración de firma falta, delega el error al manejador central.
 *
 * @returns {import('express').Router}
 */
export function createJwksRouter() {
  const router = Router();

  router.get('/.well-known/jwks.json', async (req, res, next) => {
    try {
      const jwks = await exportPublicJwks();
      // El JWKS es público y estable; se puede cachear un rato en el cliente.
      res.set('Cache-Control', 'public, max-age=300');
      res.json(jwks);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
