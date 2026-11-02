// Pruebas de integración del puente OIDC con mocks de GitHub.
// Feature: accounts-auth, tarea 5.7: se prueban los endpoints del contrato
// (authorize, callback + token, jwks) levantando la app Express real en un
// puerto efímero y mockeando a GitHub (fetch nativo) y el entorno.
// Validates: Requirements 11.2, 11.4
//
// Por qué así: lib/github.js usa el fetch nativo de Node, de modo que se
// reemplaza globalThis.fetch dentro de cada prueba (restaurándolo en el finally)
// para simular el canje code→token y el perfil /user, /user/emails sin red. La
// clave de firma RS256 es de PRUEBA: se genera en el propio test con jose, así
// no hay secretos de verdad y el id_token se puede verificar contra su pública.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportPKCS8, jwtVerify } from 'jose';

// --- Configuración de entorno de PRUEBA (debe estar antes de crear la app) ---

const TEST_ISSUER = 'https://bridge.example.test';
const TEST_KEY_ID = 'test-key-1';
const TEST_GITHUB_CLIENT_ID = 'test-github-client-id';
const TEST_COGNITO_CLIENT_ID = 'test-cognito-client-id';
// Origen permitido = la redirect_uri de Cognito; un origen fuera de esto se rechaza.
const ALLOWED_ORIGIN = 'https://app.example.test';
const COGNITO_REDIRECT_URI = `${ALLOWED_ORIGIN}/oauth2/idpresponse`;

// createApp se importa de forma diferida (tras fijar el entorno) para que la
// allowlist y el resto de config se lean ya con los valores de prueba.
let createApp;

// Clave pública de PRUEBA (contraparte de OIDC_SIGNING_KEY). Se conserva para
// verificar el id_token directamente, sin depender del endpoint JWKS.
let testPublicKey;

/**
 * Deja el entorno del proceso con una configuración de puente completa y de
 * prueba, incluyendo una clave RS256 recién generada exportada como PKCS8.
 * Se corre una vez antes de todas las pruebas; genera la clave aquí para no
 * incrustar material criptográfico en el repo.
 */
before(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true });
  const pkcs8 = await exportPKCS8(privateKey);
  testPublicKey = publicKey;

  process.env.GITHUB_CLIENT_ID = TEST_GITHUB_CLIENT_ID;
  process.env.GITHUB_CLIENT_SECRET = 'test-github-client-secret';
  process.env.OIDC_SIGNING_KEY = pkcs8;
  process.env.OIDC_KEY_ID = TEST_KEY_ID;
  process.env.ISSUER = TEST_ISSUER;
  process.env.ALLOWED_ORIGINS = ALLOWED_ORIGIN;
  process.env.PORT = '0';

  ({ createApp } = await import('../server.js'));
});

// --- Arnés: servidor efímero + helpers de request y de mock de GitHub ---

/**
 * Levanta la app en un puerto efímero (listen(0)) y devuelve la URL base y un
 * cierre. No se abre un puerto fijo para que las pruebas no choquen entre sí
 * ni con un servidor local ya corriendo.
 *
 * @returns {Promise<{ baseUrl: string, close: () => Promise<void> }>}
 */
async function startServer() {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const close = () => new Promise((resolve) => server.close(resolve));
  return { baseUrl, close };
}

/**
 * Construye una respuesta JSON mínima compatible con el fetch nativo, para que
 * el código del puente (que llama a `response.ok` y `response.json()`) funcione
 * sin diferencias frente a una respuesta real.
 *
 * @param {any} body - El cuerpo que `response.json()` resolverá.
 * @param {number} [status=200] - El código HTTP simulado.
 * @returns {{ ok: boolean, status: number, json: () => Promise<any> }}
 */
function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

/**
 * Instala un mock de globalThis.fetch que responde a las tres llamadas que el
 * puente hace a GitHub (token, /user, /user/emails) y devuelve una función para
 * restaurar el fetch original. El perfil y el correo son configurables para
 * poder afirmar sobre los claims del id_token resultante.
 *
 * @param {{ accessToken?: string, profile?: object, emails?: object[] }} options
 * @returns {() => void} Restaura el fetch original.
 */
function mockGithubFetch({ accessToken = 'gh-access-token', profile, emails } = {}) {
  const originalFetch = globalThis.fetch;
  const resolvedProfile = profile ?? { id: 4242, login: 'octocat', name: 'Octo Cat' };
  const resolvedEmails = emails ?? [{ email: 'octo@example.test', primary: true, verified: true }];

  globalThis.fetch = async (input, init) => {
    // El mismo global fetch sirve tanto a las llamadas del puente hacia GitHub
    // como a las del propio test hacia el servidor local. Solo se interceptan
    // las URLs de GitHub; el resto (p. ej. 127.0.0.1) pasa al fetch original.
    // input puede ser string, URL o Request; se normaliza a texto para la
    // coincidencia, pero el original se reenvía intacto al fetch real.
    const target = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
    if (target.startsWith('https://github.com/login/oauth/access_token')) {
      return jsonResponse({ access_token: accessToken, token_type: 'bearer' });
    }
    if (target === 'https://api.github.com/user') {
      return jsonResponse(resolvedProfile);
    }
    if (target === 'https://api.github.com/user/emails') {
      return jsonResponse(resolvedEmails);
    }
    return originalFetch(input, init);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

// --- /.well-known/jwks.json: solo material público ---
//
// `lib/jwt.js` importa la privada con `{ extractable: true }` para poder derivar
// y publicar solo la parte pública (Requirement 11.2); el JWKS no expone ningún
// componente privado de la clave RSA.

test('Feature: accounts-auth - jwks publica la clave pública RS256 sin material privado',
  async () => {
  const { baseUrl, close } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/.well-known/jwks.json`);
    assert.equal(res.status, 200);

    const jwks = await res.json();
    assert.equal(Array.isArray(jwks.keys), true);
    assert.equal(jwks.keys.length, 1);

    const [key] = jwks.keys;
    assert.equal(key.kty, 'RSA');
    assert.equal(key.use, 'sig');
    assert.equal(key.alg, 'RS256');
    assert.equal(key.kid, TEST_KEY_ID);
    assert.equal(typeof key.n, 'string');
    assert.equal(typeof key.e, 'string');

    // Ningún componente privado de la clave RSA debe filtrarse en el JWKS.
    for (const privateField of ['d', 'p', 'q', 'dp', 'dq', 'qi']) {
      assert.equal(key[privateField], undefined, `el JWKS no debe exponer ${privateField}`);
    }
  } finally {
    await close();
  }
});

// --- /authorize: redirige a GitHub con origen permitido, 403 con origen ajeno ---

test('Feature: accounts-auth - authorize redirige a GitHub con client_id y state cuando el origen es permitido', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const url = new URL(`${baseUrl}/authorize`);
    url.searchParams.set('redirect_uri', COGNITO_REDIRECT_URI);
    url.searchParams.set('state', 'cognito-state-123');

    // manual: no seguir el 302 para poder inspeccionar el Location hacia GitHub.
    const res = await fetch(url, { headers: { origin: ALLOWED_ORIGIN }, redirect: 'manual' });
    assert.equal(res.status, 302);

    const location = new URL(res.headers.get('location'));
    assert.equal(location.origin + location.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(location.searchParams.get('client_id'), TEST_GITHUB_CLIENT_ID);
    assert.equal(location.searchParams.get('redirect_uri'), `${TEST_ISSUER}/callback`);
    // El state que viaja a GitHub es el DEL PUENTE, no el de Cognito (defensa CSRF).
    const bridgeState = location.searchParams.get('state');
    assert.equal(typeof bridgeState, 'string');
    assert.notEqual(bridgeState, '');
    assert.notEqual(bridgeState, 'cognito-state-123');
  } finally {
    await close();
  }
});

test('Feature: accounts-auth - authorize responde 403 cuando el origen no está en la allowlist', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const url = new URL(`${baseUrl}/authorize`);
    url.searchParams.set('redirect_uri', 'https://evil.example.test/oauth2/idpresponse');
    url.searchParams.set('state', 'cognito-state-123');

    const res = await fetch(url, { headers: { origin: 'https://evil.example.test' }, redirect: 'manual' });
    assert.equal(res.status, 403);

    const body = await res.json();
    assert.equal(body.error, 'origen_no_permitido');
  } finally {
    await close();
  }
});

// --- /callback + POST /token: flujo completo con GitHub mockeado ---

/**
 * Corre el tramo authorize → callback y devuelve el code efímero del puente
 * junto con la URL de vuelta a Cognito. Encapsula la coreografía de states para
 * que las pruebas de /token se concentren en el canje y el id_token.
 *
 * @param {string} baseUrl - URL base del servidor de prueba.
 * @param {ReturnType<typeof mockGithubFetch>} _restore - no usado aquí; el mock se
 *        instala y restaura en la prueba que llama, para controlar su alcance.
 * @returns {Promise<{ bridgeCode: string, redirectBack: URL }>}
 */
async function runAuthorizeAndCallback(baseUrl) {
  // 1) authorize: obtiene el state del puente que GitHub "devolvería".
  const authorizeUrl = new URL(`${baseUrl}/authorize`);
  authorizeUrl.searchParams.set('redirect_uri', COGNITO_REDIRECT_URI);
  authorizeUrl.searchParams.set('state', 'cognito-state-xyz');
  const authorizeRes = await fetch(authorizeUrl, { headers: { origin: ALLOWED_ORIGIN }, redirect: 'manual' });
  const githubRedirect = new URL(authorizeRes.headers.get('location'));
  const bridgeState = githubRedirect.searchParams.get('state');

  // 2) callback: GitHub vuelve con un code y el state del puente.
  const callbackUrl = new URL(`${baseUrl}/callback`);
  callbackUrl.searchParams.set('code', 'github-auth-code');
  callbackUrl.searchParams.set('state', bridgeState);
  const callbackRes = await fetch(callbackUrl, { redirect: 'manual' });
  assert.equal(callbackRes.status, 302);

  const redirectBack = new URL(callbackRes.headers.get('location'));
  return { bridgeCode: redirectBack.searchParams.get('code'), redirectBack };
}

test('Feature: accounts-auth - callback canjea el code de GitHub y redirige a Cognito con un code efímero', async () => {
  const restore = mockGithubFetch();
  const { baseUrl, close } = await startServer();
  try {
    const { bridgeCode, redirectBack } = await runAuthorizeAndCallback(baseUrl);

    // Vuelve al redirect_uri de Cognito, conservando su state original.
    assert.equal(redirectBack.origin + redirectBack.pathname, COGNITO_REDIRECT_URI);
    assert.equal(redirectBack.searchParams.get('state'), 'cognito-state-xyz');
    // Entrega un code propio del puente, distinto del code de GitHub.
    assert.equal(typeof bridgeCode, 'string');
    assert.notEqual(bridgeCode, '');
    assert.notEqual(bridgeCode, 'github-auth-code');
  } finally {
    await close();
    restore();
  }
});

test('Feature: accounts-auth - token canjea el code del puente por un id_token firmado y verificable', async () => {
  const restore = mockGithubFetch({
    profile: { id: 9001, login: 'devperson', name: 'Dev Person' },
    emails: [{ email: 'dev@example.test', primary: true, verified: true }],
  });
  const { baseUrl, close } = await startServer();
  try {
    const { bridgeCode } = await runAuthorizeAndCallback(baseUrl);

    // POST /token como lo haría Cognito: formulario con grant authorization_code.
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: bridgeCode,
      client_id: TEST_COGNITO_CLIENT_ID,
      redirect_uri: COGNITO_REDIRECT_URI,
    });
    const tokenRes = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    assert.equal(tokenRes.status, 200);

    const tokens = await tokenRes.json();
    assert.equal(tokens.token_type, 'Bearer');
    assert.equal(typeof tokens.id_token, 'string');

    // Verifica el id_token contra la clave pública de prueba (la contraparte de
    // la clave de firma del puente), como haría Cognito con la clave del JWKS.
    const { payload, protectedHeader } = await jwtVerify(tokens.id_token, testPublicKey, {
      issuer: TEST_ISSUER,
      audience: TEST_COGNITO_CLIENT_ID,
      algorithms: ['RS256'],
    });

    assert.equal(protectedHeader.alg, 'RS256');
    assert.equal(protectedHeader.kid, TEST_KEY_ID);
    assert.equal(payload.iss, TEST_ISSUER);
    assert.equal(payload.aud, TEST_COGNITO_CLIENT_ID);
    assert.equal(payload.sub, '9001');
    assert.equal(payload.email, 'dev@example.test');
    assert.equal(payload.name, 'Dev Person');
    assert.equal(payload.preferred_username, 'devperson');
  } finally {
    await close();
    restore();
  }
});

test('Feature: accounts-auth - token rechaza con invalid_grant un code ya canjeado (un solo uso)', async () => {
  const restore = mockGithubFetch();
  const { baseUrl, close } = await startServer();
  try {
    const { bridgeCode } = await runAuthorizeAndCallback(baseUrl);

    const makeTokenRequest = () => {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: bridgeCode,
        client_id: TEST_COGNITO_CLIENT_ID,
      });
      return fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
    };

    const first = await makeTokenRequest();
    assert.equal(first.status, 200);

    // El mismo code no debe volver a servir: el store lo consume en el primer canje.
    const second = await makeTokenRequest();
    assert.equal(second.status, 400);
    const body = await second.json();
    assert.equal(body.error, 'invalid_grant');
  } finally {
    await close();
    restore();
  }
});

test('Feature: accounts-auth - token rechaza un grant_type no soportado', async () => {
  const { baseUrl, close } = await startServer();
  try {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: TEST_COGNITO_CLIENT_ID });
    const res = await fetch(`${baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    assert.equal(res.status, 400);
    const payload = await res.json();
    assert.equal(payload.error, 'unsupported_grant_type');
  } finally {
    await close();
  }
});

// Cierra cualquier handle residual: las pruebas cierran su propio servidor en
// el finally, así que aquí no queda estado que limpiar. El hook existe por
// simetría y para dejar claro el ciclo de vida.
after(() => {});
