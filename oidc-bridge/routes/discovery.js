// Ruta de descubrimiento OIDC del puente.
// Expone `/.well-known/openid-configuration`, el documento que Cognito lee para
// saber dónde están los endpoints del proveedor (authorize, token, jwks) y qué
// capacidades tiene. El issuer y las URLs se derivan de ISSUER, la URL pública
// base del servicio, para que coincidan con el `iss` de los tokens firmados.

import { Router } from 'express';

/**
 * Construye el documento de descubrimiento OIDC a partir del issuer.
 * Lógica pura: dado el issuer, arma las URLs absolutas de cada endpoint y la
 * lista de capacidades que el puente soporta (code flow, RS256, claims básicos).
 *
 * @param {string} issuer - URL pública base del puente, sin barra final.
 * @returns {Object} El documento de configuración OIDC.
 */
export function buildDiscoveryDocument(issuer) {
  const base = issuer.replace(/\/$/, '');
  return {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'email', 'profile'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: ['sub', 'email', 'name', 'preferred_username', 'iss', 'aud', 'exp', 'iat'],
  };
}

/**
 * Crea el router de `/.well-known/openid-configuration`.
 * Lee ISSUER en cada petición para fallar con un mensaje claro si falta, en
 * lugar de romper al importar el módulo.
 *
 * @returns {import('express').Router}
 */
export function createDiscoveryRouter() {
  const router = Router();

  router.get('/.well-known/openid-configuration', (req, res, next) => {
    const issuer = process.env.ISSUER;
    if (!issuer) {
      next(new Error('Falta ISSUER en el entorno.'));
      return;
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json(buildDiscoveryDocument(issuer));
  });

  return router;
}
