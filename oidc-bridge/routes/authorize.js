// Ruta /authorize del puente OIDC.
// Cognito llega aquí como cliente del puente para iniciar el login con GitHub.
// La ruta valida que el origen/redirect pertenezca a la allowlist, genera su
// PROPIO state (defensa CSRF del tramo puente↔GitHub, independiente del state
// de Cognito), recuerda los datos de Cognito (su state y su redirect_uri) y
// redirige al diálogo de autorización de GitHub. El `/callback` recupera esos
// datos usando el state del puente que GitHub devuelve.

import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { isAllowedOrigin } from '../lib/origins.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

// Vida de una autorización pendiente antes de descartarse. El usuario completa
// el login de GitHub en este plazo; pasado, el state del puente deja de valer.
const PENDING_TTL_MS = 10 * 60 * 1000;

// state del puente -> { cognitoState, cognitoRedirectUri, expiresAt }
// En memoria del proceso: el dato es efímero y de un solo uso.
const pendingAuthorizations = new Map();

/**
 * Registra una autorización pendiente bajo un state nuevo del puente.
 * Guarda el state y la redirect_uri que Cognito mandó para poder devolvérselos
 * tal cual en `/callback`. Devuelve el state del puente que viaja a GitHub.
 *
 * @param {string} cognitoState - El state original que envió Cognito.
 * @param {string} cognitoRedirectUri - La redirect_uri a la que volver (Cognito).
 * @returns {string} El state del puente.
 */
export function rememberPendingAuthorization(cognitoState, cognitoRedirectUri) {
  const bridgeState = randomBytes(24).toString('base64url');
  pendingAuthorizations.set(bridgeState, {
    cognitoState,
    cognitoRedirectUri,
    expiresAt: Date.now() + PENDING_TTL_MS,
  });
  return bridgeState;
}

/**
 * Recupera y consume una autorización pendiente por el state del puente.
 * Un solo uso: se borra al leerla. Devuelve null si no existe o caducó, para
 * que `/callback` rechace un state desconocido o viejo.
 *
 * @param {string} bridgeState - El state que GitHub devolvió al callback.
 * @returns {{ cognitoState: string, cognitoRedirectUri: string } | null}
 */
export function takePendingAuthorization(bridgeState) {
  if (typeof bridgeState !== 'string' || bridgeState === '') return null;
  const entry = pendingAuthorizations.get(bridgeState);
  if (!entry) return null;
  pendingAuthorizations.delete(bridgeState);
  if (entry.expiresAt < Date.now()) return null;
  return { cognitoState: entry.cognitoState, cognitoRedirectUri: entry.cognitoRedirectUri };
}

/**
 * Crea el router de `GET /authorize`.
 * Necesita la allowlist (orígenes permitidos) para validar de dónde viene la
 * petición antes de iniciar el flujo con GitHub.
 *
 * @param {string[]} allowlist - Orígenes permitidos, exactos.
 * @returns {import('express').Router}
 */
export function createAuthorizeRouter(allowlist) {
  const router = Router();

  router.get('/authorize', (req, res, next) => {
    try {
      // El origen efectivo: la cabecera Origin si viene, o la redirect_uri que
      // Cognito declara. Ambos deben pertenecer a la allowlist exacta.
      const redirectUri = typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : '';
      const requestOrigin = req.get('origin') || originOf(redirectUri);
      if (!isAllowedOrigin(requestOrigin, allowlist)) {
        res.status(403).json({ error: 'origen_no_permitido' });
        return;
      }

      const clientId = process.env.GITHUB_CLIENT_ID;
      if (!clientId) {
        next(new Error('Falta GITHUB_CLIENT_ID en el entorno.'));
        return;
      }
      const issuer = process.env.ISSUER;
      if (!issuer) {
        next(new Error('Falta ISSUER en el entorno.'));
        return;
      }

      const cognitoState = typeof req.query.state === 'string' ? req.query.state : '';
      const bridgeState = rememberPendingAuthorization(cognitoState, redirectUri);

      // La redirect_uri del puente hacia GitHub siempre es su propio /callback.
      const callbackUri = `${issuer.replace(/\/$/, '')}/callback`;
      const githubUrl = new URL(GITHUB_AUTHORIZE_URL);
      githubUrl.searchParams.set('client_id', clientId);
      githubUrl.searchParams.set('redirect_uri', callbackUri);
      githubUrl.searchParams.set('scope', 'read:user user:email');
      githubUrl.searchParams.set('state', bridgeState);

      res.redirect(githubUrl.toString());
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/**
 * Extrae el origen (esquema + host + puerto) de una URL.
 * Permite validar una redirect_uri contra la allowlist de orígenes cuando la
 * petición no trae cabecera Origin. Devuelve '' si la URL no es válida, para
 * fallar del lado seguro.
 *
 * @param {string} url - La URL de la que extraer el origen.
 * @returns {string} El origen, o '' si la URL no es parseable.
 */
function originOf(url) {
  if (typeof url !== 'string' || url === '') return '';
  try {
    return new URL(url).origin;
  } catch {
    // URL malformada: sin origen válido, lo trata como no permitido.
    return '';
  }
}
