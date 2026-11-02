// Ruta /token del puente OIDC.
// Cognito canjea aquí el code efímero del puente por un ID token OIDC firmado.
// La ruta valida el grant (solo `authorization_code`) y el cliente, consume el
// code (un solo uso) para recuperar la identidad de GitHub, y firma con la
// clave privada de entorno un ID token que Cognito acepta. El client secret de
// GitHub y la clave privada nunca salen del servidor.

import { Router } from 'express';
import { signIdToken } from '../lib/jwt.js';
import { consumeCode } from '../lib/code-store.js';

const GRANT_AUTHORIZATION_CODE = 'authorization_code';

// Vida declarada del ID token en segundos; coincide con el TTL de firma (5 min).
const EXPIRES_IN_SECONDS = 300;

/**
 * Lee el client id que Cognito presenta, soportando body y Basic auth.
 * El endpoint de token admite `client_secret_post` (campos en el cuerpo) y
 * `client_secret_basic` (cabecera Authorization: Basic). Se devuelve solo el
 * client id, que es el `aud` del ID token; el secret del cliente no se guarda.
 *
 * @param {import('express').Request} req
 * @returns {string} El client id, o '' si no viene.
 */
function readClientId(req) {
  if (typeof req.body?.client_id === 'string' && req.body.client_id !== '') {
    return req.body.client_id;
  }
  const authHeader = req.get('authorization') || '';
  if (authHeader.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(authHeader.slice('Basic '.length), 'base64').toString('utf8');
      const [clientId] = decoded.split(':');
      return clientId || '';
    } catch {
      // Cabecera Basic malformada: se trata como cliente ausente.
      return '';
    }
  }
  return '';
}

/**
 * Crea el router de `POST /token`.
 *
 * @returns {import('express').Router}
 */
export function createTokenRouter() {
  const router = Router();

  router.post('/token', async (req, res, next) => {
    try {
      const grantType = req.body?.grant_type;
      if (grantType !== GRANT_AUTHORIZATION_CODE) {
        res.status(400).json({ error: 'unsupported_grant_type' });
        return;
      }

      const clientId = readClientId(req);
      if (clientId === '') {
        res.status(401).json({ error: 'invalid_client' });
        return;
      }

      const code = typeof req.body?.code === 'string' ? req.body.code : '';
      const grant = consumeCode(code);
      if (!grant) {
        // Code desconocido, ya usado o caducado: grant inválido.
        res.status(400).json({ error: 'invalid_grant' });
        return;
      }

      // Firma el ID token con la identidad de GitHub y el cliente como audiencia.
      const idToken = await signIdToken(grant.identity, clientId);

      res.set('Cache-Control', 'no-store');
      res.json({
        access_token: idToken,
        token_type: 'Bearer',
        expires_in: EXPIRES_IN_SECONDS,
        id_token: idToken,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
