// Portado de docs/modules/accounts-auth/properties/propiedad-{2,3,4,5,6,7,9,10,11,12,13,14}-*.md
// (antes scripts para pegar en la consola del navegador o en `node --input-type=module`).
// jsdom da `location` y `localStorage` reales, así que no hacen falta los stubs manuales que
// traían los scripts originales para correr en Node sin navegador.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { forAll, randomInt } from '../support/forAll.js';
import {
  pkceChallenge,
  buildAuthorizeUrl,
  buildTokenRequest,
  randomState,
  postSignInRoute,
  sessionAction,
  validateIdClaims,
  accountSlotModel,
  passwordUnmetRules,
  mapAuthError,
  saveSession,
  loadSession,
} from '../../src/core/auth.js';
import { AUTH_CONFIG } from '../../src/core/auth-config.js';

const randomUrlSafe = (len) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

describe('Feature: accounts-auth, Property 2: El desafío PKCE deriva del verificador y es verificable', () => {
  // Validates: Requirements 4.4, 12.1
  const toBase64Url = (bytes) => {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const expectedChallenge = async (verifier) => {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return toBase64Url(new Uint8Array(digest));
  };
  const VERIFIER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const randomVerifier = () => {
    const length = randomInt(43, 128);
    let out = '';
    for (let i = 0; i < length; i++) out += VERIFIER_ALPHABET[Math.floor(Math.random() * VERIFIER_ALPHABET.length)];
    return out;
  };
  const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
  const challengeHoldsFor = async (verifier) => {
    const challenge = await pkceChallenge(verifier);
    if (typeof challenge !== 'string' || challenge.length === 0) return false;
    if (!BASE64URL_RE.test(challenge)) return false;
    if (challenge.length !== 43) return false;
    const again = await pkceChallenge(verifier);
    if (again !== challenge) return false;
    const recomputed = await expectedChallenge(verifier);
    return recomputed === challenge;
  };

  test('caso canónico de la RFC 7636', async () => {
    const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(await pkceChallenge(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
  });

  test('120 verificadores aleatorios: determinista, formato y verificable', async () => {
    for (let i = 0; i < 120; i++) {
      const verifier = randomVerifier();
      expect(await challengeHoldsFor(verifier), `verifier: ${verifier}`).toBe(true);
    }
  });
});

describe('Feature: accounts-auth, Property 3: La URL de autorización usa code, PKCE, state y una redirect permitida', () => {
  // Validates: Requirements 4.2, 5.2, 12.1, 12.3
  const providerKeys = Object.keys(AUTH_CONFIG.providers);

  const assertAuthorizeUrl = ({ provider, state, challenge }) => {
    const url = new URL(buildAuthorizeUrl({ provider, state, challenge }));
    const params = url.searchParams;
    if (params.get('response_type') !== 'code') return false;
    if (params.get('code_challenge_method') !== 'S256') return false;
    if (params.get('code_challenge') !== challenge) return false;
    if (params.get('state') !== state) return false;
    if (params.get('redirect_uri') !== AUTH_CONFIG.redirectUri) return false;
    if (params.get('client_id') !== AUTH_CONFIG.clientId) return false;
    if (params.get('identity_provider') !== AUTH_CONFIG.providers[provider]) return false;
    const whole = url.toString();
    if (/client_secret/i.test(whole)) return false;
    if (/response_type=token/i.test(whole)) return false;
    return true;
  };

  test('cada proveedor del dominio finito cumple todas las garantías', () => {
    expect(providerKeys.length).toBeGreaterThan(0);
    for (const provider of providerKeys) {
      const input = { provider, state: randomUrlSafe(43), challenge: randomUrlSafe(43) };
      expect(assertAuthorizeUrl(input), JSON.stringify(input)).toBe(true);
    }
  });

  test('>=100 iteraciones aleatorias repartidas entre proveedores', () => {
    const runsPerProvider = Math.ceil(100 / providerKeys.length);
    for (const provider of providerKeys) {
      forAll(
        runsPerProvider,
        () => ({ provider, state: randomUrlSafe(randomInt(16, 64)), challenge: randomUrlSafe(randomInt(16, 64)) }),
        assertAuthorizeUrl,
      );
    }
  });
});

describe('Feature: accounts-auth, Property 4: El canje valida el state y nunca envía secreto', () => {
  // Validates: Requirements 4.3, 4.5, 5.4, 9.3, 12.2
  const randomToken = (len = randomInt(8, 44)) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  };
  // Regla pura de `handleRedirect`: acepta si y solo si el state devuelto es idéntico al enviado.
  const stateAccepts = (sent, returned) => sent === returned;

  test('el bicondicional del state se cumple en casos límite y pares aleatorios', () => {
    const edgeCases = [
      ['abc123', 'abc123', true],
      ['abc123', 'abc124', false],
      ['abc123', 'ABC123', false],
      ['abc123', 'abc123 ', false],
      ['', '', true],
      ['x', '', false],
      ['', 'x', false],
      ['token', 'tokentoken', false],
    ];
    for (const [sent, returned, shouldAccept] of edgeCases) {
      expect(stateAccepts(sent, returned)).toBe(shouldAccept);
    }
    forAll(300, () => {
      const sent = randomToken();
      if (Math.random() < 0.5) return { sent, returned: sent, equal: true };
      let returned = randomToken();
      while (returned === sent) returned = randomToken();
      return { sent, returned, equal: false };
    }, ({ sent, returned, equal }) => stateAccepts(sent, returned) === equal);
  });

  test('buildTokenRequest nunca envía secreto y siempre lleva el verifier', () => {
    forAll(200, () => ({ code: randomToken(), verifier: randomToken() }), ({ code, verifier }) => {
      const { url, body } = buildTokenRequest({ code, verifier });
      if (!(body instanceof URLSearchParams)) return false;
      if (typeof url !== 'string' || !/\/oauth2\/token$/.test(new URL(url).pathname)) return false;
      for (const key of body.keys()) if (/secret/i.test(key)) return false;
      if (body.has('client_secret')) return false;
      if (/client_secret/i.test(body.toString())) return false;
      if (body.get('code_verifier') !== verifier) return false;
      if (body.get('code') !== code) return false;
      if (body.get('grant_type') !== 'authorization_code') return false;
      return true;
    });
  });
});

describe('Feature: accounts-auth, Property 5: El state es fresco y suficientemente aleatorio', () => {
  // Validates: Requirements 12.2
  const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
  const EXPECTED_MIN_LENGTH = 43;
  const SAMPLE_SIZE = 2000; // reducido de 10000 para mantener la prueba rápida; sigue siendo >= 100

  test('formato base64url válido y longitud suficiente', () => {
    forAll(SAMPLE_SIZE, () => randomState(),
      (state) => typeof state === 'string' && BASE64URL_RE.test(state) && state.length >= EXPECTED_MIN_LENGTH);
  });

  test('sin colisiones en una muestra grande', () => {
    const sample = Array.from({ length: SAMPLE_SIZE }, () => randomState());
    expect(new Set(sample).size).toBe(sample.length);
  });
});

describe('Feature: accounts-auth, Property 6: Auth_Config solo contiene valores públicos', () => {
  // Validates: Requirements 5.6, 9.1, 9.2, 12.4
  const ALLOWED_KEYS = ['userPoolId', 'clientId', 'region', 'cognitoDomain', 'redirectUri', 'scopes', 'providers', 'oidcBridgeEndpoint', 'syncApiEndpoint', 'liveSyncEndpoint'];
  const SECRET_KEY_RE = /(secret|client[_-]?secret|private[_-]?key|api[_-]?key|password|passwd|credential|access[_-]?key)/i;
  const PRIVATE_KEY_MARKER_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
  const CLIENT_SECRET_PARAM_RE = /client_secret\s*=/i;
  const looksLikeOpaqueSecret = (value) => {
    if (typeof value !== 'string') return false;
    const isUrl = /^https?:\/\//.test(value);
    const isPublicId = /[._-]/.test(value) || value.length <= 20;
    if (isUrl || isPublicId) return false;
    return /^[A-Za-z0-9+/=_-]{32,}$/.test(value);
  };
  const looksLikeSecret = (value) =>
    typeof value === 'string' &&
    (PRIVATE_KEY_MARKER_RE.test(value) || CLIENT_SECRET_PARAM_RE.test(value) || looksLikeOpaqueSecret(value));
  const scanForSecrets = (node, path = '$') => {
    const findings = [];
    if (Array.isArray(node)) {
      node.forEach((item, index) => findings.push(...scanForSecrets(item, `${path}[${index}]`)));
      return findings;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        const childPath = `${path}.${key}`;
        if (SECRET_KEY_RE.test(key)) findings.push(`${childPath}: nombre de clave sospechoso`);
        findings.push(...scanForSecrets(value, childPath));
      }
      return findings;
    }
    if (looksLikeSecret(node)) findings.push(`${path}: valor con aspecto de secreto`);
    return findings;
  };
  const randomOpaque = (len) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  };
  const makeCleanConfig = () => ({
    userPoolId: `us-east-1_${randomOpaque(9)}`,
    clientId: `app-${randomOpaque(randomInt(6, 12))}`,
    region: 'us-east-1',
    cognitoDomain: `https://focus-${randomInt(1, 999)}.auth.us-east-1.amazoncognito.com`,
    redirectUri: 'https://focus-garden.example/app.html',
    scopes: ['openid', 'email', 'profile'],
    providers: { Google: 'Google', GitHub: 'GitHubBridge' },
    oidcBridgeEndpoint: 'https://oidc-bridge.example.com',
    syncApiEndpoint: 'https://sync-api.example.com',
    liveSyncEndpoint: 'wss://live-sync.example.com',
  });
  const SECRET_INJECTIONS = [
    (cfg) => { cfg.clientSecret = randomOpaque(40); },
    (cfg) => { cfg.githubSecret = randomOpaque(32); },
    (cfg) => { cfg.signingKey = `-----BEGIN PRIVATE KEY-----\n${randomOpaque(64)}\n-----END PRIVATE KEY-----`; },
    (cfg) => { cfg.oidcBridgeEndpoint = `https://oidc-bridge.example.com?client_secret=${randomOpaque(24)}`; },
    (cfg) => { cfg.providers = { ...cfg.providers, Opaque: randomOpaque(48) }; },
    (cfg) => { cfg.apiKey = randomOpaque(36); },
  ];

  test('AUTH_CONFIG real: claves públicas exactas, sin secretos, endpoint declarado', () => {
    const actualKeys = Object.keys(AUTH_CONFIG).sort();
    expect(actualKeys).toEqual([...ALLOWED_KEYS].sort());
    expect(scanForSecrets(AUTH_CONFIG)).toEqual([]);
    expect(AUTH_CONFIG.oidcBridgeEndpoint).toMatch(/^https?:\/\//);
    expect(looksLikeSecret(AUTH_CONFIG.oidcBridgeEndpoint)).toBe(false);
    expect(AUTH_CONFIG.syncApiEndpoint).toMatch(/^https?:\/\//);
    expect(looksLikeSecret(AUTH_CONFIG.syncApiEndpoint)).toBe(false);
    expect(AUTH_CONFIG.liveSyncEndpoint).toMatch(/^wss?:\/\//);
    expect(looksLikeSecret(AUTH_CONFIG.liveSyncEndpoint)).toBe(false);
  });

  test('el detector de secretos no da falsos positivos ni negativos en 200 configs generadas', () => {
    const generate = () => {
      const hasSecret = Math.random() < 0.5;
      const config = makeCleanConfig();
      if (hasSecret) {
        SECRET_INJECTIONS[Math.floor(Math.random() * SECRET_INJECTIONS.length)](config);
        if (scanForSecrets(config).length === 0) SECRET_INJECTIONS[0](config);
      }
      return { config, hasSecret };
    };
    forAll(200, generate, ({ config, hasSecret }) => (scanForSecrets(config).length > 0) === hasSecret);
  });
});

describe('Feature: accounts-auth, Property 7: El destino tras iniciar sesión depende solo de la Display_Name', () => {
  // Validates: Requirements 3.5, 4.7, 6.1, 6.5
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const PRESENT_NAMES = ['Ana', 'José', '  nombre con espacios  ', ' ', 'x', 'María Fernanda', '🌱'];
  const ABSENT_NAMES = [undefined, null, ''];
  const buildNoise = () => ({
    email: pick(['a@b.com', 'user@example.org', '', undefined]),
    accessToken: pick(['tok-abc', 'tok-xyz', '', undefined]),
    refreshToken: pick(['ref-123', 'ref-456', '', undefined]),
    accessExpiresAt: pick([0, Date.now(), Date.now() + 3600_000]),
    refreshExpiresAt: pick([0, Date.now() + 86_400_000]),
  });
  const expectedRoute = (session) => (Boolean(session && session.displayName) ? 'tasks' : 'name-prompt');
  const routeMatches = (session) => {
    const route = postSignInRoute(session);
    return (route === 'name-prompt' || route === 'tasks') && route === expectedRoute(session);
  };
  const check = (session) => {
    if (!routeMatches(session)) return false;
    const twin = { displayName: session.displayName, ...buildNoise() };
    return postSignInRoute(twin) === postSignInRoute(session);
  };

  test('casos límite dirigidos y sesión nula/indefinida', () => {
    for (const displayName of [...PRESENT_NAMES, ...ABSENT_NAMES]) {
      expect(check({ displayName }), `displayName=${JSON.stringify(displayName)}`).toBe(true);
      expect(check({ displayName, ...buildNoise() })).toBe(true);
    }
    expect(postSignInRoute(null)).toBe('name-prompt');
    expect(postSignInRoute(undefined)).toBe('name-prompt');
  });

  test('500 sesiones aleatorias: el destino depende solo de displayName', () => {
    forAll(500, () => {
      const present = Math.random() < 0.5;
      const displayName = present ? pick(PRESENT_NAMES) : pick(ABSENT_NAMES);
      return { displayName, ...buildNoise() };
    }, check);
  });
});

describe('Feature: accounts-auth, Property 9: Guardar y cargar la sesión es un round-trip', () => {
  // Validates: Requirements 9.4
  const SESSION_KEY = 'focus-garden:auth:v1';
  const GARDEN_KEY = 'jardin-movil:v1';
  let originalSession;
  let originalGarden;

  beforeEach(() => {
    originalSession = localStorage.getItem(SESSION_KEY);
    originalGarden = localStorage.getItem(GARDEN_KEY);
  });
  afterEach(() => {
    if (originalSession === null) localStorage.removeItem(SESSION_KEY); else localStorage.setItem(SESSION_KEY, originalSession);
    if (originalGarden === null) localStorage.removeItem(GARDEN_KEY); else localStorage.setItem(GARDEN_KEY, originalGarden);
  });

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const randomToken = (prefix) => `${prefix}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  const makeValidSession = () => {
    const now = Date.now();
    const accessExpiresAt = now + randomInt(1, 3600) * 1000;
    const refreshExpiresAt = now + randomInt(3600, 30 * 24 * 3600) * 1000;
    return {
      accessToken: randomToken('access'),
      idToken: randomToken('id'),
      refreshToken: randomToken('refresh'),
      accessExpiresAt,
      refreshExpiresAt,
      email: `${randomToken('user')}@focus-garden.example`,
      displayName: pick(['', 'Ana', 'Benito', 'Chavela', 'Diego']),
    };
  };

  test('200 sesiones válidas: round-trip exacto y sin tocar jardin-movil:v1', () => {
    const gardenFixture = JSON.stringify({ v: 1, tasks: [{ id: 't1' }], rounds: [] });
    localStorage.setItem(GARDEN_KEY, gardenFixture);

    const isRoundTrip = (session) => {
      saveSession(session);
      const loaded = loadSession();
      if (loaded === null) return false;
      return JSON.stringify(loaded) === JSON.stringify(session);
    };
    forAll(200, makeValidSession, isRoundTrip);

    expect(localStorage.getItem(GARDEN_KEY)).toBe(gardenFixture);
  });
});

describe('Feature: accounts-auth, Property 10: La decisión de refresco cubre todas las expiraciones', () => {
  // Validates: Requirements 9.5, 9.6
  const expectedAction = (now, accessExp, refreshExp) => {
    if (now < accessExp) return 'ok';
    if (now < refreshExp) return 'refresh';
    return 'sign-in';
  };
  const NOW = 1_000_000;
  const POSITIONS = { before: NOW + 1, equal: NOW, after: NOW - 1 };
  const matchesRule = ({ now, accessExp, refreshExp }) =>
    sessionAction(now, accessExp, refreshExp) === expectedAction(now, accessExp, refreshExp);

  test('barrido exhaustivo de las 9 combinaciones de posición relativa', () => {
    for (const accessPos of Object.keys(POSITIONS)) {
      for (const refreshPos of Object.keys(POSITIONS)) {
        const triple = { now: NOW, accessExp: POSITIONS[accessPos], refreshExp: POSITIONS[refreshPos] };
        expect(matchesRule(triple), `access=${accessPos} refresh=${refreshPos}`).toBe(true);
      }
    }
  });

  test('200 tripletas aleatorias', () => {
    const randomMs = () => Math.floor(Math.random() * 10_000_000);
    forAll(200, () => ({ now: randomMs(), accessExp: randomMs(), refreshExp: randomMs() }), matchesRule);
  });
});

describe('Feature: accounts-auth, Property 11: El ID token se acepta solo con claims correctos', () => {
  // Validates: Requirements 9.7, 12.5
  const CFG = { region: 'us-east-1', userPoolId: 'us-east-1_TEST12345', clientId: 'test-client-abc123' };
  const EXPECTED_ISSUER = `https://cognito-idp.${CFG.region}.amazonaws.com/${CFG.userPoolId}`;
  const NOW_MS = 1_700_000_000_000;
  const nowSec = NOW_MS / 1000;

  const BAD_ISSUERS = [
    `https://cognito-idp.us-west-2.amazonaws.com/${CFG.userPoolId}`,
    `https://cognito-idp.${CFG.region}.amazonaws.com/us-east-1_OTHER9999`,
    `https://cognito-idp.${CFG.region}.amazonaws.com/${CFG.userPoolId}/`,
    `http://cognito-idp.${CFG.region}.amazonaws.com/${CFG.userPoolId}`,
    'https://accounts.google.com',
  ];
  const genIss = (valid) => (valid ? EXPECTED_ISSUER : BAD_ISSUERS[Math.floor(Math.random() * BAD_ISSUERS.length)]);
  const BAD_AUDS = ['test-client-ABC123', 'otro-client-999', `${CFG.clientId}x`, 'test-client-abc12'];
  const genAud = (valid) => (valid ? CFG.clientId : BAD_AUDS[Math.floor(Math.random() * BAD_AUDS.length)]);
  const genExp = (valid) => {
    const marginSec = 1 + Math.floor(Math.random() * 3600);
    return valid ? nowSec + marginSec : nowSec - marginSec;
  };

  test('200 combinaciones independientes de iss/aud/exp', () => {
    forAll(200, () => {
      const issValid = Math.random() < 0.5;
      const audValid = Math.random() < 0.5;
      const expValid = Math.random() < 0.5;
      const claims = { iss: genIss(issValid), aud: genAud(audValid), exp: genExp(expValid) };
      return { claims, allValid: issValid && audValid && expValid };
    }, ({ claims, allValid }) => validateIdClaims(claims, CFG, NOW_MS) === allValid);
  });

  test('casos límite: borde de exp, diferencias mínimas en iss/aud, claims vacío o nulo', () => {
    const base = { iss: EXPECTED_ISSUER, aud: CFG.clientId, exp: nowSec + 60 };
    const edgeCases = [
      [{ ...base, exp: NOW_MS / 1000 }, false],
      [{ ...base, exp: NOW_MS / 1000 + 0.001 }, true],
      [{ ...base, iss: `${EXPECTED_ISSUER}/` }, false],
      [{ ...base, aud: `${CFG.clientId}x` }, false],
      [{ ...base }, true],
      [null, false],
      [{}, false],
      [{ iss: EXPECTED_ISSUER, aud: CFG.clientId }, false],
      [{ ...base, exp: '9999999999' }, false],
    ];
    for (const [claims, expected] of edgeCases) {
      expect(validateIdClaims(claims, CFG, NOW_MS), JSON.stringify(claims)).toBe(expected);
    }
  });
});

describe('Feature: accounts-auth, Property 12: El modelo del Account_Slot refleja disponibilidad y sesión', () => {
  // Validates: Requirements 7.1, 7.2, 7.3, 10.1, 10.3
  const expectedLabel = (session) => {
    const displayName = session.displayName;
    if (displayName && displayName.trim()) return displayName;
    return session.email || '';
  };
  const modelHolds = (session, sdkReady) => {
    const model = accountSlotModel(session, sdkReady);
    if (!model || typeof model !== 'object') return false;
    if (!sdkReady) return model.enabled === false && model.mode === 'disabled' && model.canSignOut === false;
    if (!session) return model.enabled === true && model.mode === 'guest' && model.canSignOut === false;
    return model.enabled === true && model.mode === 'signed-in' && model.canSignOut === true && model.label === expectedLabel(session);
  };

  test('combinación exhaustiva: sdkReady x (sin sesión, con nombre, con solo correo)', () => {
    const sessions = [null, { displayName: 'Ana', email: 'ana@example.com' }, { email: 'sin-nombre@example.com' }];
    for (const sdkReady of [true, false]) {
      for (const session of sessions) {
        expect(modelHolds(session, sdkReady), `sdkReady=${sdkReady} session=${JSON.stringify(session)}`).toBe(true);
      }
    }
  });

  test('la etiqueta cae de Display_Name a correo en los casos límite', () => {
    const labelEdgeCases = [
      [{ displayName: 'Beto', email: 'beto@x.com' }, 'Beto'],
      [{ displayName: '', email: 'vacio@x.com' }, 'vacio@x.com'],
      [{ displayName: '   ', email: 'espacios@x.com' }, 'espacios@x.com'],
      [{ email: 'solo-correo@x.com' }, 'solo-correo@x.com'],
      [{ displayName: '', email: '' }, ''],
      [{}, ''],
    ];
    for (const [session, label] of labelEdgeCases) {
      expect(accountSlotModel(session, true).label).toBe(label);
    }
  });

  test('300 combinaciones aleatorias de sesión y sdkReady', () => {
    const randomInt0 = (max) => Math.floor(Math.random() * max);
    const randomText = (len = randomInt0(20)) => {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .@_-';
      let out = '';
      for (let i = 0; i < len; i++) out += alphabet[randomInt0(alphabet.length)];
      return out;
    };
    const maybeText = () => {
      const dice = Math.random();
      if (dice < 0.2) return undefined;
      if (dice < 0.35) return '';
      if (dice < 0.45) return '   ';
      return randomText();
    };
    forAll(300, () => {
      const sdkReady = Math.random() < 0.5;
      const session = Math.random() < 0.25 ? null : { displayName: maybeText(), email: maybeText() };
      return { session, sdkReady };
    }, ({ session, sdkReady }) => modelHolds(session, sdkReady));
  });
});

describe('Feature: accounts-auth, Property 13: Las reglas de contraseña incumplidas son exactas', () => {
  // Validates: Requirements 2.5
  const MSG_MIN_LENGTH = (minLength) => `Debe tener al menos ${minLength} caracteres`;
  const MSG_UPPERCASE = 'Debe incluir una letra mayúscula';
  const MSG_LOWERCASE = 'Debe incluir una letra minúscula';
  const MSG_NUMBER = 'Debe incluir un número';
  const MSG_SYMBOL = 'Debe incluir un símbolo';
  const SYMBOL_RE = /[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`+=\- ]/;
  const expectedUnmet = (password, policy) => {
    const minLength = policy.minLength ?? 8;
    const expected = [];
    if (password.length < minLength) expected.push(MSG_MIN_LENGTH(minLength));
    if (policy.requireUppercase && !/[A-Z]/.test(password)) expected.push(MSG_UPPERCASE);
    if (policy.requireLowercase && !/[a-z]/.test(password)) expected.push(MSG_LOWERCASE);
    if (policy.requireNumbers && !/[0-9]/.test(password)) expected.push(MSG_NUMBER);
    if (policy.requireSymbols && !SYMBOL_RE.test(password)) expected.push(MSG_SYMBOL);
    return expected;
  };
  const sameList = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const DIGITS = '0123456789';
  const SYMBOLS = '!@#$%^&*()-_=+.';
  const pickChar = (chars) => chars[Math.floor(Math.random() * chars.length)];
  const flip = () => Math.random() < 0.5;
  const randomPassword = () => {
    const length = Math.floor(Math.random() * 16);
    const pools = [];
    if (flip()) pools.push(UPPER);
    if (flip()) pools.push(LOWER);
    if (flip()) pools.push(DIGITS);
    if (flip()) pools.push(SYMBOLS);
    if (pools.length === 0) pools.push(LOWER);
    let password = '';
    for (let i = 0; i < length; i++) password += pickChar(pools[Math.floor(Math.random() * pools.length)]);
    return password;
  };
  const randomPolicy = () => ({
    minLength: 6 + Math.floor(Math.random() * 7),
    requireUppercase: flip(),
    requireLowercase: flip(),
    requireNumbers: flip(),
    requireSymbols: flip(),
  });
  const matchesOracle = ({ password, policy }) => {
    const actual = passwordUnmetRules(password, policy);
    const expected = expectedUnmet(password, policy);
    const noDuplicates = new Set(actual).size === actual.length;
    return Array.isArray(actual) && noDuplicates && sameList(actual, expected);
  };

  test('casos límite: vacía, cumple todo, no cumple nada, solo longitud', () => {
    const ALL_REQUIRED = { minLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSymbols: true };
    const ONLY_LENGTH = { minLength: 8, requireUppercase: false, requireLowercase: false, requireNumbers: false, requireSymbols: false };
    const edgeCases = [
      { password: '', policy: ALL_REQUIRED },
      { password: 'Abcdef1!', policy: ALL_REQUIRED },
      { password: 'abcdefgh', policy: ALL_REQUIRED },
      { password: 'abc', policy: ONLY_LENGTH },
      { password: 'abcdefghij', policy: ONLY_LENGTH },
    ];
    for (const edgeCase of edgeCases) expect(matchesOracle(edgeCase), JSON.stringify(edgeCase)).toBe(true);
  });

  test('500 pares aleatorios (password, policy) coinciden con el oráculo', () => {
    forAll(500, () => ({ password: randomPassword(), policy: randomPolicy() }), matchesOracle);
  });
});

describe('Feature: accounts-auth, Property 14: Los errores de autenticación mapean a mensajes seguros', () => {
  // Validates: Requirements 2.4, 3.3
  const KNOWN_ERROR_CODES = [
    'UsernameExistsException', 'InvalidPasswordException', 'InvalidParameterException',
    'CodeMismatchException', 'ExpiredCodeException', 'NotAuthorizedException',
    'UserNotFoundException', 'UserNotConfirmedException', 'LimitExceededException',
    'TooManyRequestsException', 'CodeDeliveryFailureException',
  ];
  const VALID_ACTIONS = new Set(['sign-in', 'fix-password', 'retry', 'resend-code', 'wait']);
  const isSafeResult = (result) =>
    Boolean(result) && typeof result.message === 'string' && result.message.trim().length > 0 &&
    typeof result.action === 'string' && VALID_ACTIONS.has(result.action);
  const randomUnknownCode = () => {
    const shapes = [
      () => '',
      () => Math.random().toString(36).slice(2),
      () => `${Math.random().toString(36).slice(2)}Exception`,
      () => `Fake${Math.floor(Math.random() * 1e6)}Exception`,
      () => String(Math.floor(Math.random() * 1e9)),
    ];
    const code = shapes[Math.floor(Math.random() * shapes.length)]();
    return KNOWN_ERROR_CODES.includes(code) ? `${code}_x` : code;
  };

  test('cada código conocido da un mensaje no vacío y una acción válida', () => {
    for (const code of KNOWN_ERROR_CODES) expect(isSafeResult(mapAuthError(code)), code).toBe(true);
  });

  test('NotAuthorizedException y UserNotFoundException comparten el mismo mensaje genérico', () => {
    expect(mapAuthError('NotAuthorizedException').message).toBe(mapAuthError('UserNotFoundException').message);
  });

  test('códigos desconocidos caen siempre en el mismo mensaje genérico, sin filtrar el código', () => {
    const fallbackMessage = mapAuthError('__definitivamente_desconocido__').message;
    forAll(200, randomUnknownCode, (code) => {
      const result = mapAuthError(code);
      if (!isSafeResult(result)) return false;
      if (code.length > 0 && result.message.includes(code)) return false;
      return result.message === fallbackMessage;
    });
  });
});
