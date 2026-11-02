// Ruta /callback del puente OIDC.
// GitHub devuelve aquí el authorization code tras el login. La ruta recupera la
// autorización pendiente por el state del puente, canjea el code con GitHub
// (usando el client secret de entorno), lee la identidad del usuario, emite un
// code EFÍMERO propio del puente y redirige de vuelta a Cognito con ese code y
// el state original de Cognito. El ID token no se firma aquí: se firma en
// `/token`, cuando Cognito canjea el code del puente.

import { Router } from 'express';
import { exchangeCodeForToken, fetchGithubIdentity } from '../lib/github.js';
import { issueCode } from '../lib/code-store.js';
import { takePendingAuthorization } from './authorize.js';

/**
 * Crea el router de `GET /callback`.
 *
 * @returns {import('express').Router}
 */
export function createCallbackRouter() {
  const router = Router();

  router.get('/callback', async (req, res, next) => {
    try {
      const githubCode = typeof req.query.code === 'string' ? req.query.code : '';
      const bridgeState = typeof req.query.state === 'string' ? req.query.state : '';

      // El state debe corresponder a una autorización que el puente inició.
      // Si no, es una respuesta no solicitada o caducada: se rechaza (CSRF).
      const pending = takePendingAuthorization(bridgeState);
      if (!pending) {
        res.status(400).json({ error: 'state_invalido' });
        return;
      }

      if (githubCode === '') {
        // GitHub pudo devolver error=access_denied si el usuario canceló.
        res.status(400).json({ error: 'sin_code_de_github' });
        return;
      }

      const issuer = process.env.ISSUER;
      const callbackUri = issuer ? `${issuer.replace(/\/$/, '')}/callback` : undefined;

      // Canje servidor-a-servidor con GitHub; el secret nunca sale del puente.
      const accessToken = await exchangeCodeForToken(githubCode, callbackUri);
      const identity = await fetchGithubIdentity(accessToken);

      // Code efímero del puente: Cognito lo canjeará en /token por el ID token.
      const bridgeCode = issueCode(identity, pending.cognitoRedirectUri);

      // Vuelta a Cognito con su propio state y el code del puente.
      const redirectBack = new URL(pending.cognitoRedirectUri);
      redirectBack.searchParams.set('code', bridgeCode);
      if (pending.cognitoState) redirectBack.searchParams.set('state', pending.cognitoState);

      res.redirect(redirectBack.toString());
    } catch (error) {
      // Error de red o de OAuth con GitHub: se reporta claro, sin abrir sesión.
      next(error);
    }
  });

  return router;
}
