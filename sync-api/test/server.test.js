// Pruebas de integración de sync-api con dobles de Cognito y DynamoDB.
// Levanta la app Express real en un puerto efímero. Firma tokens de PRUEBA con una clave RS256
// generada en el propio test (jose) y los valida contra un JWKS local (createLocalJWKSet), en
// vez de contra el JWKS real de Cognito — así no hay red ni secretos de verdad, igual que
// oidc-bridge/test/server.test.js resuelve lo mismo para su propia clave de firma. El
// almacenamiento usa un doble en memoria con setSyncStoreClient, igual que setCodeStoreClient
// en oidc-bridge.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { setSyncStoreClient } from '../lib/sync-store.js';
import { setJwks } from '../lib/cognito-jwt.js';

// --- Configuración de entorno de PRUEBA (debe estar antes de crear la app) ---

const TEST_KEY_ID = 'test-key-1';
const TEST_POOL_ID = 'us-east-1_TESTPOOL';
const TEST_REGION = 'us-east-1';
const TEST_CLIENT_ID = 'test-cognito-client-id';
const ALLOWED_ORIGIN = 'https://app.example.test';
const ISSUER = `https://cognito-idp.${TEST_REGION}.amazonaws.com/${TEST_POOL_ID}`;

let createApp;
let signAccessToken;

/**
 * Doble en memoria del cliente de DynamoDB que usa `lib/sync-store.js`. Soporta solo los dos
 * comandos que el código real emite (`GetCommand`, `PutCommand`); cualquier otro indicaría que
 * `sync-store.js` cambió y el doble ya no lo cubre.
 *
 * @returns {{ send: (command: unknown) => Promise<unknown>, items: Map<string, object> }}
 */
function makeFakeDynamoClient() {
  const items = new Map();
  return {
    items,
    async send(command) {
      if (command instanceof PutCommand) {
        items.set(command.input.Item.sub, command.input.Item);
        return {};
      }
      if (command instanceof GetCommand) {
        return { Item: items.get(command.input.Key.sub) };
      }
      throw new Error(`Comando de DynamoDB no soportado en el doble de prueba: ${command.constructor.name}`);
    },
  };
}

before(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid: TEST_KEY_ID, alg: 'RS256', use: 'sig' };
  setJwks(createLocalJWKSet({ keys: [publicJwk] }));

  /**
   * Firma un access token de Cognito de prueba. Por defecto trae todo lo que la ruta exige
   * (`token_use: 'access'`, el `client_id` configurado, un `sub`); los overrides permiten
   * ejercitar cada rechazo (token_use, client_id, expirado, otro issuer).
   */
  signAccessToken = async ({ sub = 'user-sub-1', clientId = TEST_CLIENT_ID, tokenUse = 'access', issuer = ISSUER, expiresIn = '5m' } = {}) =>
    new SignJWT({ token_use: tokenUse, client_id: clientId, scope: 'aws.cognito.signin.user.admin' })
      .setProtectedHeader({ alg: 'RS256', kid: TEST_KEY_ID })
      .setSubject(sub)
      .setIssuer(issuer)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);

  process.env.COGNITO_USER_POOL_ID = TEST_POOL_ID;
  process.env.COGNITO_REGION = TEST_REGION;
  process.env.COGNITO_CLIENT_ID = TEST_CLIENT_ID;
  process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN;
  process.env.PORT = '0';

  ({ createApp } = await import('../server.js'));
});

/** Levanta la app en un puerto efímero; cada prueba arranca con su propio doble de DynamoDB. */
async function startServer() {
  setSyncStoreClient(makeFakeDynamoClient());
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const close = () => new Promise((resolve) => server.close(resolve));
  return { baseUrl, close };
}

const SAMPLE_STATE = {
  tasks: [{ id: 't-1', title: 'Probar sync-api', type: 'trabajo', createdAt: 1000, doneAt: null }],
  rounds: [{ id: 'r-1', taskId: 't-1', at: 2000, seconds: 1500 }],
  timer: { taskId: null, status: 'idle', totalMs: 1500000, remainingMs: 1500000, endsAt: null },
  settings: { demo: false, sound: true, music: false, minutes: 25 },
};

test('GET /state sin token responde 401', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/state`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'falta_token');
  } finally {
    await close();
  }
});

test('GET /state con un token de otro client_id responde 401', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const token = await signAccessToken({ clientId: 'otro-client' });
    const response = await fetch(`${baseUrl}/state`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 401);
  } finally {
    await close();
  }
});

test('GET /state con un ID token (token_use !== access) responde 401', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const token = await signAccessToken({ tokenUse: 'id' });
    const response = await fetch(`${baseUrl}/state`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 401);
  } finally {
    await close();
  }
});

test('GET /state con un token expirado responde 401', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const token = await signAccessToken({ expiresIn: '-1s' });
    const response = await fetch(`${baseUrl}/state`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 401);
  } finally {
    await close();
  }
});

test('GET /state con un token de un issuer distinto responde 401', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const token = await signAccessToken({ issuer: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_OTRO' });
    const response = await fetch(`${baseUrl}/state`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 401);
  } finally {
    await close();
  }
});

test('GET /state sin nada guardado responde 204', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const token = await signAccessToken({ sub: 'nunca-guardo-nada' });
    const response = await fetch(`${baseUrl}/state`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 204);
  } finally {
    await close();
  }
});

test('PUT /state guarda y GET /state lo devuelve igual, con un updatedAt propio del servidor', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const token = await signAccessToken({ sub: 'persona-1' });
    const before = Date.now();

    const putResponse = await fetch(`${baseUrl}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...SAMPLE_STATE, updatedAt: 1 }), // el cliente manda cualquier cosa; se ignora
    });
    assert.equal(putResponse.status, 200);
    const putBody = await putResponse.json();
    assert.ok(putBody.updatedAt >= before);

    const getResponse = await fetch(`${baseUrl}/state`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(getResponse.status, 200);
    const getBody = await getResponse.json();
    assert.deepEqual(getBody.tasks, SAMPLE_STATE.tasks);
    assert.deepEqual(getBody.rounds, SAMPLE_STATE.rounds);
    assert.deepEqual(getBody.timer, SAMPLE_STATE.timer);
    assert.deepEqual(getBody.settings, SAMPLE_STATE.settings);
    assert.equal(getBody.updatedAt, putBody.updatedAt);
  } finally {
    await close();
  }
});

test('dos personas distintas (sub distinto) no ven el estado de la otra', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const tokenA = await signAccessToken({ sub: 'persona-a' });
    const tokenB = await signAccessToken({ sub: 'persona-b' });

    await fetch(`${baseUrl}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify(SAMPLE_STATE),
    });

    const responseB = await fetch(`${baseUrl}/state`, { headers: { Authorization: `Bearer ${tokenB}` } });
    assert.equal(responseB.status, 204);
  } finally {
    await close();
  }
});

test('PUT /state con forma inválida responde 413', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const token = await signAccessToken();
    const response = await fetch(`${baseUrl}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tasks: 'no-es-un-arreglo', rounds: [], timer: {}, settings: {} }),
    });
    assert.equal(response.status, 413);
  } finally {
    await close();
  }
});

test('preflight CORS: origen permitido responde 204 con cabeceras; otro origen responde 403', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const allowed = await fetch(`${baseUrl}/state`, { method: 'OPTIONS', headers: { Origin: ALLOWED_ORIGIN } });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), ALLOWED_ORIGIN);

    const blocked = await fetch(`${baseUrl}/state`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example.test' } });
    assert.equal(blocked.status, 403);
  } finally {
    await close();
  }
});
