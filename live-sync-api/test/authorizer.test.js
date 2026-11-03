// Pruebas del Lambda authorizer de $connect, con el mismo patrón que sync-api/test/server.test.js:
// una clave RS256 de PRUEBA generada en el propio test (jose) y un JWKS local
// (createLocalJWKSet), nunca el JWKS real de Cognito.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { setJwks } from '../lib/cognito-jwt.js';
import { handler } from '../authorizer.js';

const TEST_KEY_ID = 'test-key-1';
const TEST_POOL_ID = 'us-east-1_TESTPOOL';
const TEST_REGION = 'us-east-1';
const TEST_CLIENT_ID = 'test-cognito-client-id';
const ISSUER = `https://cognito-idp.${TEST_REGION}.amazonaws.com/${TEST_POOL_ID}`;
const METHOD_ARN = 'arn:aws:execute-api:us-east-1:123456789012:abc123/prod/$connect';

let signAccessToken;

before(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid: TEST_KEY_ID, alg: 'RS256', use: 'sig' };
  setJwks(createLocalJWKSet({ keys: [publicJwk] }));

  signAccessToken = async ({ sub = 'persona-1', clientId = TEST_CLIENT_ID, tokenUse = 'access', expiresIn = '5m' } = {}) =>
    new SignJWT({ token_use: tokenUse, client_id: clientId })
      .setProtectedHeader({ alg: 'RS256', kid: TEST_KEY_ID })
      .setSubject(sub)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);

  process.env.COGNITO_USER_POOL_ID = TEST_POOL_ID;
  process.env.COGNITO_REGION = TEST_REGION;
  process.env.COGNITO_CLIENT_ID = TEST_CLIENT_ID;
});

test('token válido: permite la conexión y expone el sub en el contexto', async () => {
  const token = await signAccessToken({ sub: 'persona-1' });
  const result = await handler({ methodArn: METHOD_ARN, queryStringParameters: { token } });

  assert.equal(result.principalId, 'persona-1');
  assert.equal(result.context.sub, 'persona-1');
  assert.equal(result.policyDocument.Statement[0].Effect, 'Allow');
  assert.equal(result.policyDocument.Statement[0].Resource, METHOD_ARN);
});

test('sin token: rechaza con "Unauthorized"', async () => {
  await assert.rejects(() => handler({ methodArn: METHOD_ARN, queryStringParameters: {} }), /Unauthorized/);
});

test('token de otro client_id: rechaza con "Unauthorized"', async () => {
  const token = await signAccessToken({ clientId: 'otro-client' });
  await assert.rejects(() => handler({ methodArn: METHOD_ARN, queryStringParameters: { token } }), /Unauthorized/);
});

test('un ID token (token_use !== access): rechaza con "Unauthorized"', async () => {
  const token = await signAccessToken({ tokenUse: 'id' });
  await assert.rejects(() => handler({ methodArn: METHOD_ARN, queryStringParameters: { token } }), /Unauthorized/);
});

test('token expirado: rechaza con "Unauthorized"', async () => {
  const token = await signAccessToken({ expiresIn: '-1s' });
  await assert.rejects(() => handler({ methodArn: METHOD_ARN, queryStringParameters: { token } }), /Unauthorized/);
});
