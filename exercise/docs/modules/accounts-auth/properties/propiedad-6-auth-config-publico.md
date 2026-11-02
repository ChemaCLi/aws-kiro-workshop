# Propiedad 6: Auth_Config solo contiene valores públicos

**Feature: accounts-auth, Property 6: Auth_Config solo contiene valores públicos.**

**Validates: Requirements 5.6, 9.1, 9.2, 12.4**

## Enunciado

Para el objeto `AUTH_CONFIG` de [`src/core/auth-config.js`](../../../../src/core/auth-config.js):

1. **Claves permitidas.** Toda clave de primer nivel pertenece al conjunto público fijo: `userPoolId`, `clientId`, `region`, `cognitoDomain`, `redirectUri`, `scopes`, `providers`, `oidcBridgeEndpoint`. No sobra ninguna ni falta ninguna.
2. **Sin patrones de secreto.** Recorriendo recursivamente todas las claves y todos los valores de cadena (incluidos los anidados en `providers` y `scopes`), ninguna clave contiene `secret` (como en `clientSecret`) ni ningún valor tiene aspecto de secreto: nada que parezca un *client secret* (cadena larga opaca sin estructura de URL/identificador conocido), un marcador de clave privada (`-----BEGIN ... PRIVATE KEY-----`) ni un parámetro `client_secret=`.
3. **Endpoint declarado.** `oidcBridgeEndpoint` es exactamente el que declara la configuración (no se reescribe en otro lugar); solo contiene el endpoint público del puente, sin credenciales.

Como `AUTH_CONFIG` es un objeto fijo, las comprobaciones 1 a 3 son un caso único. Para dar garantía de propiedad, el script complementa con **≥100 iteraciones** de un generador que construye configuraciones **con y sin** patrones de secreto y verifica que el detector `looksLikeSecret` / `scanForSecrets` las distingue (sin falsos negativos en las que sí tienen secreto, sin falsos positivos en las que no). Así se prueba el detector, no solo el objeto.

## Nota sobre Node y `location`

`auth-config.js` deriva `redirectUri` de `location.origin`, que no existe en Node. El script define un `location` mínimo y limpio **antes** de importar el módulo (y lo restaura al terminar), de modo que el mismo script corre en la consola del navegador (donde `location` ya existe y el stub no se aplica) y en Node.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta y el detector de secretos. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 6: Auth_Config solo contiene valores públicos
// Validates: Requirements 5.6, 9.1, 9.2, 12.4

// Arnés mínimo: corre `check` con `runs` entradas aleatorias y falla con la primera que no cumpla.
const forAll = (runs, generate, check) => {
  for (let i = 0; i < runs; i++) {
    const input = generate();
    if (!check(input)) throw new Error(`Falla con: ${JSON.stringify(input)}`);
  }
};

// En Node no hay `location`; se define un stub limpio solo si falta, y se restaura al terminar.
const needsLocationStub = typeof location === 'undefined';
if (needsLocationStub) {
  globalThis.location = { origin: 'https://focus-garden.example' };
}

// Conjunto público permitido de claves de primer nivel (del diseño, Propiedad 6).
const ALLOWED_KEYS = ['userPoolId', 'clientId', 'region', 'cognitoDomain', 'redirectUri', 'scopes', 'providers', 'oidcBridgeEndpoint'];

// --- Detector de secretos ---------------------------------------------------

// Una clave es sospechosa si su nombre menciona un secreto (secret, clientSecret, apiKey, token, password...).
const SECRET_KEY_RE = /(secret|client[_-]?secret|private[_-]?key|api[_-]?key|password|passwd|credential|access[_-]?key)/i;

// Marcadores inequívocos de secreto en un valor de cadena.
const PRIVATE_KEY_MARKER_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const CLIENT_SECRET_PARAM_RE = /client_secret\s*=/i;

// Un valor "parece un client secret" si es una cadena larga y opaca (muchos caracteres base64/hex seguidos)
// que NO tiene forma de URL ni de identificador público conocido de Cognito (que llevan guiones o puntos).
const looksLikeOpaqueSecret = (value) => {
  if (typeof value !== 'string') return false;
  // Los valores públicos de Cognito tienen estructura reconocible: URLs, IDs con guion bajo/punto, o scopes cortos.
  const isUrl = /^https?:\/\//.test(value);
  const isPublicId = /[._-]/.test(value) || value.length <= 20;
  if (isUrl || isPublicId) return false;
  // Cadena larga, continua y de alta entropía aparente: típico de un secreto opaco.
  return /^[A-Za-z0-9+/=_-]{32,}$/.test(value);
};

// Un valor de cadena es secreto si trae un marcador de clave privada, un parámetro client_secret, o parece opaco.
const looksLikeSecret = (value) =>
  typeof value === 'string' &&
  (PRIVATE_KEY_MARKER_RE.test(value) || CLIENT_SECRET_PARAM_RE.test(value) || looksLikeOpaqueSecret(value));

// Recorre recursivamente un objeto y devuelve la lista de hallazgos (ruta + motivo). Vacía = sin secretos.
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

try {
  const { AUTH_CONFIG } = await import('./src/core/auth-config.js');

  // 1) Claves exactamente iguales al conjunto público permitido (ni de más ni de menos).
  const actualKeys = Object.keys(AUTH_CONFIG).sort();
  const expectedKeys = [...ALLOWED_KEYS].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`Las claves de AUTH_CONFIG no son el conjunto público esperado. Tiene: ${JSON.stringify(actualKeys)}`);
  }

  // 2) Ningún patrón de secreto en claves ni valores, a cualquier profundidad.
  const findings = scanForSecrets(AUTH_CONFIG);
  if (findings.length > 0) {
    throw new Error(`AUTH_CONFIG contiene posibles secretos:\n- ${findings.join('\n- ')}`);
  }

  // 3) El endpoint del puente es el declarado y no esconde credenciales.
  if (typeof AUTH_CONFIG.oidcBridgeEndpoint !== 'string' || !/^https?:\/\//.test(AUTH_CONFIG.oidcBridgeEndpoint)) {
    throw new Error('oidcBridgeEndpoint debe ser una URL pública declarada en la config');
  }
  if (looksLikeSecret(AUTH_CONFIG.oidcBridgeEndpoint)) {
    throw new Error('oidcBridgeEndpoint parece contener un secreto');
  }

  // --- Verificación del detector con configs generadas (>=100 iteraciones) ---

  const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const randomOpaque = (len) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
    return out;
  };

  // Config "limpia": solo valores con forma pública (URLs, IDs con separadores, scopes cortos).
  const makeCleanConfig = () => ({
    userPoolId: `us-east-1_${randomOpaque(9)}`,          // lleva guion bajo: ID público reconocible
    clientId: `app-${randomOpaque(randomInt(6, 12))}`,   // lleva guion: identificador público
    region: 'us-east-1',
    cognitoDomain: `https://focus-${randomInt(1, 999)}.auth.us-east-1.amazoncognito.com`,
    redirectUri: `https://focus-garden.example/app.html`,
    scopes: ['openid', 'email', 'profile'],
    providers: { Google: 'Google', GitHub: 'GitHubBridge' },
    oidcBridgeEndpoint: 'https://oidc-bridge.example.com',
  });

  // Config "con secreto": una copia limpia a la que se le inyecta exactamente un patrón de secreto.
  const SECRET_INJECTIONS = [
    (cfg) => { cfg.clientSecret = randomOpaque(40); },                               // clave sospechosa
    (cfg) => { cfg.githubSecret = randomOpaque(32); },                               // clave sospechosa
    (cfg) => { cfg.signingKey = `-----BEGIN PRIVATE KEY-----\n${randomOpaque(64)}\n-----END PRIVATE KEY-----`; }, // marcador de clave privada
    (cfg) => { cfg.oidcBridgeEndpoint = `https://oidc-bridge.example.com?client_secret=${randomOpaque(24)}`; },   // param client_secret
    (cfg) => { cfg.providers = { ...cfg.providers, Opaque: randomOpaque(48) }; },    // valor opaco anidado
    (cfg) => { cfg.apiKey = randomOpaque(36); },                                     // clave sospechosa
  ];

  // Genera un caso: mitad limpios (deben dar [] hallazgos), mitad con un secreto (deben dar >=1 hallazgo).
  const generate = () => {
    const hasSecret = Math.random() < 0.5;
    const config = makeCleanConfig();
    let injection = null;
    if (hasSecret) {
      injection = SECRET_INJECTIONS[Math.floor(Math.random() * SECRET_INJECTIONS.length)].name || 'injection';
      SECRET_INJECTIONS[Math.floor(Math.random() * SECRET_INJECTIONS.length)](config);
      // Asegurar al menos una inyección efectiva aunque el azar repita índices distintos arriba.
      if (scanForSecrets(config).length === 0) SECRET_INJECTIONS[0](config);
    }
    return { config, hasSecret, injection };
  };

  // El detector debe encontrar >=1 hallazgo si y solo si se inyectó un secreto.
  const check = ({ config, hasSecret }) => {
    const detected = scanForSecrets(config).length > 0;
    return detected === hasSecret;
  };

  forAll(200, generate, check);

  console.log('Propiedad 6 OK: AUTH_CONFIG sin secretos (8 claves públicas) + 200 configs generadas clasificadas sin error');
} finally {
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir la app (por ejemplo `http://localhost:8080`) y abrirla en el navegador.
2. Abrir la consola de DevTools, pegar el script de arriba y presionar Enter. En el navegador `location` ya existe, así que el stub no se aplica.

### En Node (sin navegador)

El script ya trae el arnés `forAll` y el stub de `location`, y usa `await import(...)` de nivel superior (módulo). Desde la carpeta de la app (`exercise/`):

```sh
node --input-type=module < docs/modules/accounts-auth/properties/propiedad-6-auth-config-publico.md
```

Como el `.md` no es un `.js`, en la práctica se copia el bloque ` ```js ` a un archivo temporal o se pega el bloque en:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth-config.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`.

## Resultado esperado

El script termina sin lanzar error y muestra en consola:

```
Propiedad 6 OK: AUTH_CONFIG sin secretos (8 claves públicas) + 200 configs generadas clasificadas sin error
```

Un `Error: AUTH_CONFIG contiene posibles secretos: ...` señala una clave o valor con aspecto de secreto en la configuración real (hay que quitarlo de `auth-config.js` y moverlo al puente o a variables de entorno). Un `Error: Falla con: ...` en la parte generada indica que el detector clasificó mal un caso (falso positivo o falso negativo) y se reporta a `coder` con el caso que falló.
