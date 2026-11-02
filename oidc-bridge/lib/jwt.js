// Firma y verificación de los ID token OIDC del puente.
// El puente firma, con una clave privada RS256 que vive en variables de
// entorno, el ID token que entrega a Cognito con la identidad de GitHub.
// Cognito valida ese token contra la clave pública publicada en el JWKS.
// Toda la criptografía se delega a `jose` (RS256 no trivial) según la
// política de dependencias; los secretos nunca llegan al frontend.

import { SignJWT, jwtVerify, importPKCS8, exportJWK } from 'jose';

const ALGORITHM = 'RS256';

// Tiempo de vida del ID token del puente. Corto: Cognito lo canjea de inmediato.
const TOKEN_TTL = '5m';

// Caché en memoria de la clave privada importada. Importar PKCS8 es costoso y
// la clave no cambia durante la vida del proceso, así que se hace una sola vez.
let cachedPrivateKey = null;

/**
 * Importa (y cachea) la clave privada de firma desde OIDC_SIGNING_KEY.
 * La variable de entorno guarda el PEM con `\n` literales para caber en una
 * línea; aquí se restauran los saltos reales antes de importarla.
 *
 * @returns {Promise<CryptoKey>} La clave privada lista para firmar con RS256.
 */
async function getPrivateKey() {
  if (cachedPrivateKey) return cachedPrivateKey;
  const pem = process.env.OIDC_SIGNING_KEY;
  if (!pem) {
    throw new Error('Falta OIDC_SIGNING_KEY en el entorno.');
  }
  const normalizedPem = pem.replace(/\\n/g, '\n');
  // Debe ser extractable: `exportPublicJwks` deriva de esta clave la parte
  // pública (con `exportJWK`) para publicarla en el JWKS. En jose 6 la firma es
  // `importPKCS8(pem, alg, options)`, y sin `{ extractable: true }` la WebCrypto
  // de Node 20+ produce una clave privada no extraíble que no se puede exportar,
  // lo que hacía fallar `/jwks` con 500. Solo se deriva y publica la pública;
  // el material privado nunca sale del proceso.
  cachedPrivateKey = await importPKCS8(normalizedPem, ALGORITHM, { extractable: true });
  return cachedPrivateKey;
}

/**
 * Lee el identificador de la clave (kid) de OIDC_KEY_ID.
 * El mismo kid va en la cabecera del token firmado y en la entrada del JWKS,
 * para que Cognito sepa qué clave pública usar al verificar.
 *
 * @returns {string} El kid configurado.
 */
function getKeyId() {
  const keyId = process.env.OIDC_KEY_ID;
  if (!keyId) {
    throw new Error('Falta OIDC_KEY_ID en el entorno.');
  }
  return keyId;
}

/**
 * Lee el issuer del puente de ISSUER (su URL pública base).
 * Es el `iss` de los tokens y el emisor que Cognito espera del proveedor.
 *
 * @returns {string} El issuer configurado.
 */
function getIssuer() {
  const issuer = process.env.ISSUER;
  if (!issuer) {
    throw new Error('Falta ISSUER en el entorno.');
  }
  return issuer;
}

/**
 * Firma un ID token OIDC con la identidad de GitHub para que Cognito lo acepte.
 * Fija `iss` al issuer del puente, `aud` al cliente (Cognito) y el `kid` en la
 * cabecera; el resto de claims (email, name, login) describen al usuario.
 *
 * @param {{ sub: string, email?: string, name?: string, login?: string }} identity
 *        Identidad normalizada que devuelve `fetchGithubIdentity`.
 * @param {string} audience - El `aud` esperado (el client id de Cognito).
 * @returns {Promise<string>} El ID token firmado (JWT compacto).
 */
export async function signIdToken(identity, audience) {
  if (!identity || typeof identity.sub !== 'string' || identity.sub === '') {
    throw new Error('La identidad para firmar debe tener un sub.');
  }
  if (typeof audience !== 'string' || audience === '') {
    throw new Error('El audience del ID token es obligatorio.');
  }

  const privateKey = await getPrivateKey();
  const claims = {
    email: identity.email || undefined,
    name: identity.name || undefined,
    preferred_username: identity.login || undefined,
  };

  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALGORITHM, kid: getKeyId() })
    .setSubject(identity.sub)
    .setIssuer(getIssuer())
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(privateKey);
}

/**
 * Verifica un ID token emitido por este puente.
 * Comprueba la firma con la clave privada (que `jose` deriva a pública) y que
 * el `iss` coincide con el issuer del puente. Útil en pruebas y para validar
 * tokens propios antes de reenviarlos.
 *
 * @param {string} idToken - El JWT a verificar.
 * @param {string} [audience] - Si se pasa, también se exige que `aud` coincida.
 * @returns {Promise<Object>} Los claims verificados del token.
 */
export async function verifyIdToken(idToken, audience) {
  if (typeof idToken !== 'string' || idToken === '') {
    throw new Error('El ID token a verificar es obligatorio.');
  }
  const privateKey = await getPrivateKey();
  const options = { issuer: getIssuer(), algorithms: [ALGORITHM] };
  if (audience) options.audience = audience;

  const { payload } = await jwtVerify(idToken, privateKey, options);
  return payload;
}

/**
 * Exporta la clave pública de firma como JWKS para el endpoint `/jwks`.
 * `jose` deriva la parte pública de la clave privada importada; se le añade el
 * `kid`, el uso (`sig`) y el algoritmo que Cognito necesita para verificar.
 *
 * @returns {Promise<{ keys: Object[] }>} El documento JWKS con la clave pública.
 */
export async function exportPublicJwks() {
  const privateKey = await getPrivateKey();
  const jwk = await exportJWK(privateKey);
  // Nunca exponer material privado: solo los campos de la clave pública RSA.
  const publicJwk = {
    kty: jwk.kty,
    n: jwk.n,
    e: jwk.e,
    kid: getKeyId(),
    use: 'sig',
    alg: ALGORITHM,
  };
  return { keys: [publicJwk] };
}
