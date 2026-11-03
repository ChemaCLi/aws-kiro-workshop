// Valida los access token de Cognito. Copia exacta de sync-api/lib/cognito-jwt.js (duplicada a
// propósito: no hay un paquete compartido entre los servicios del proyecto). Aquí la usa el
// Lambda authorizer de la ruta $connect, que es el único punto donde API Gateway autentica una
// conexión WebSocket — los mensajes posteriores en la misma conexión ya no pasan por un
// authorizer, por eso router.js identifica al remitente por su `connectionId` guardado en
// DynamoDB, no por un token en cada mensaje.
//
// Importante: los access token de Cognito NO tienen `aud` (a diferencia del ID token) — el
// cliente se identifica con el claim `client_id`. Por eso se compara `client_id` a mano en vez
// de usar la opción `audience` de `jwtVerify`.

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
 * Sustituye el JWKS por uno local (una clave de prueba), igual que en sync-api. Nunca se llama
 * en producción: ahí `getJwks()` crea el remoto en el primer uso.
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
 * @param {string} token el JWT crudo.
 * @returns {Promise<string>} el `sub` del usuario autenticado.
 */
export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, getJwks(), { issuer: issuer() });
  if (payload.token_use !== 'access') throw new Error('token_use inválido: se esperaba "access"');
  if (payload.client_id !== process.env.COGNITO_CLIENT_ID) throw new Error('client_id inválido');
  if (typeof payload.sub !== 'string' || payload.sub === '') throw new Error('el token no trae sub');
  return payload.sub;
}
