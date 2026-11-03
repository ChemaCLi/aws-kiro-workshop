// Valida los access token de Cognito que llegan en `Authorization: Bearer <token>`.
// sync-api solo debe aceptar tokens emitidos por el User Pool configurado, para el App Client
// configurado, y que sean access token (no ID token: el access token es el que Cognito espera
// usar para autorizar llamadas a una API propia; el ID token describe a la persona, no autoriza).
//
// Importante: los access token de Cognito NO tienen `aud` (a diferencia del ID token) — el
// cliente se identifica con el claim `client_id`. Por eso se compara `client_id` a mano en vez
// de usar la opción `audience` de `jwtVerify`: esa opción simplemente no aplica (el token nunca
// tiene `aud`), así que pasarla ahí daría una falsa sensación de estar validando el cliente.

import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks = null;

function issuer() {
  return `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
}

function getJwks() {
  jwks ??= createRemoteJWKSet(new URL(`${issuer()}/.well-known/jwks.json`));
  return jwks;
}

/**
 * Sustituye el JWKS por uno local (una clave de prueba), igual que `setCodeStoreClient` en
 * oidc-bridge. Nunca se llama en producción: ahí `getJwks()` crea el remoto en el primer uso,
 * contra el JWKS público real del User Pool.
 *
 * @param {ReturnType<typeof import('jose').createLocalJWKSet> | null} customJwks
 */
export function setJwks(customJwks) {
  jwks = customJwks;
}

/**
 * Valida un access token de Cognito y devuelve el `sub` (id estable de la persona) si es
 * válido. Rechaza con una excepción: firma inválida, issuer distinto, expirado, `token_use`
 * distinto de `"access"`, `client_id` distinto del App Client configurado, o `sub` ausente.
 *
 * @param {string} token el JWT crudo (sin el prefijo `"Bearer "`).
 * @returns {Promise<string>} el `sub` del usuario autenticado.
 */
export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, getJwks(), { issuer: issuer() });
  if (payload.token_use !== 'access') throw new Error('token_use inválido: se esperaba "access"');
  if (payload.client_id !== process.env.COGNITO_CLIENT_ID) throw new Error('client_id inválido');
  if (typeof payload.sub !== 'string' || payload.sub === '') throw new Error('el token no trae sub');
  return payload.sub;
}
