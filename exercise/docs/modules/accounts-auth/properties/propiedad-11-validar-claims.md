# Propiedad 11: El ID token se acepta solo con claims correctos

**Feature: accounts-auth, Property 11: El ID token se acepta solo con claims correctos.**

**Validates: Requirements 9.7, 12.5**

## Enunciado

Para cualquier conjunto de claims, `validateIdClaims(claims, cfg, now)` de [`src/core/auth.js`](../../../../src/core/auth.js) acepta (devuelve `true`) si y SOLO si los tres claims son correctos a la vez:

1. **Issuer esperado.** `claims.iss` es exactamente el issuer que Cognito pone en el ID token, derivado de la config: `https://cognito-idp.{region}.amazonaws.com/{userPoolId}`. Cualquier otra cadena (región o User Pool distintos, una barra de más, mayúsculas cambiadas) lo rechaza.
2. **Audiencia esperada.** `claims.aud` es exactamente el `cfg.clientId`: el token fue emitido para nuestro App Client y no para otro.
3. **Vigente.** `claims.exp` todavía no vence respecto a `now`. Aquí importan las **unidades**: `exp` del JWT viene en SEGUNDOS epoch (estándar OIDC), mientras que `now` es epoch en MILISEGUNDOS (como `Date.now()`); por eso la condición real es `claims.exp * 1000 > now`. Justo en el borde (`exp * 1000 === now`) el token se considera **vencido** (la comparación es estricta).

Si falla cualquiera de los tres (issuer distinto, audiencia distinta, o vencido), el resultado es `false`. También es `false` cuando `claims` es `null`/`undefined`, cuando falta alguno de los campos, o cuando `exp` no es un número.

Para dar garantía de propiedad, el script corre **≥100 iteraciones** de un generador que varía cada uno de los tres campos entre válido e inválido **de forma independiente** (2×2×2 combinaciones), y afirma que `validateIdClaims` devuelve `true` exactamente en la combinación donde los tres son válidos. Como oráculo usa una versión independiente de la regla (`expectedByRule`), de modo que la prueba no repite la implementación sino que la contrasta. Además incluye **casos límite** fijos: `exp` justo en el borde, `iss`/`aud` con diferencias pequeñas, y `claims` nulo o sin campos.

## Nota sobre Node y `location`

`auth.js` importa `auth-config.js`, que deriva `redirectUri` de `location.origin`, el cual no existe en Node. El script define un `location` mínimo y limpio **antes** de importar el módulo (y lo restaura al terminar), igual que en las Propiedades 5 y 6, de modo que el mismo script corre en la consola del navegador (donde `location` ya existe y el stub no se aplica) y en Node. La prueba usa un `cfg` propio de prueba, así que no depende de los valores de `AUTH_CONFIG`.

## Script

Script autocontenido: incluye el arnés `forAll`, la etiqueta exacta, el stub de `location` y el `cfg` de prueba. Pegarlo en la consola de DevTools con la app abierta, o correrlo en Node (ver más abajo).

```js
// Feature: accounts-auth, Property 11: El ID token se acepta solo con claims correctos
// Validates: Requirements 9.7, 12.5

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

// Config PÚBLICA de prueba: valores propios para no depender de los de AUTH_CONFIG.
// El issuer esperado se deriva de region + userPoolId, igual que en auth.js.
const CFG = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_TEST12345',
  clientId: 'test-client-abc123',
};
const EXPECTED_ISSUER = `https://cognito-idp.${CFG.region}.amazonaws.com/${CFG.userPoolId}`;

// `now` fijo de referencia (epoch ms) para todas las iteraciones.
const NOW_MS = 1_700_000_000_000;

// Oráculo independiente de la regla, NO reutiliza la implementación: acepta si y solo si
// iss, aud y exp son los correctos. Ojo a las unidades: exp en SEGUNDOS, now en MS.
const expectedByRule = (claims, cfg, now) => {
  if (!claims) return false;
  const issOk = claims.iss === `https://cognito-idp.${cfg.region}.amazonaws.com/${cfg.userPoolId}`;
  const audOk = claims.aud === cfg.clientId;
  const expOk = typeof claims.exp === 'number' && claims.exp * 1000 > now;
  return issOk && audOk && expOk;
};

try {
  const { validateIdClaims } = await import('./src/core/auth.js');

  // --- Generadores de cada campo entre válido e inválido, de forma independiente ---

  // iss válido = issuer esperado; inválido = una de varias variantes verosímiles pero distintas.
  const BAD_ISSUERS = [
    `https://cognito-idp.us-west-2.amazonaws.com/${CFG.userPoolId}`,        // región distinta
    `https://cognito-idp.${CFG.region}.amazonaws.com/us-east-1_OTHER9999`,  // User Pool distinto
    `https://cognito-idp.${CFG.region}.amazonaws.com/${CFG.userPoolId}/`,   // barra de más al final
    `http://cognito-idp.${CFG.region}.amazonaws.com/${CFG.userPoolId}`,     // http en vez de https
    'https://accounts.google.com',                                         // otro emisor por completo
  ];
  const genIss = (valid) =>
    valid ? EXPECTED_ISSUER : BAD_ISSUERS[Math.floor(Math.random() * BAD_ISSUERS.length)];

  // aud válido = clientId; inválido = otro client id verosímil.
  const BAD_AUDS = ['test-client-ABC123', 'otro-client-999', `${CFG.clientId}x`, 'test-client-abc12'];
  const genAud = (valid) =>
    valid ? CFG.clientId : BAD_AUDS[Math.floor(Math.random() * BAD_AUDS.length)];

  // exp válido = en el futuro respecto a NOW_MS (en SEGUNDOS); inválido = en el pasado o en el borde.
  // NOW_MS en segundos es NOW_MS/1000; sumamos/restamos un margen aleatorio de 1..3600 s.
  const nowSec = NOW_MS / 1000;
  const genExp = (valid) => {
    const marginSec = 1 + Math.floor(Math.random() * 3600);
    return valid ? nowSec + marginSec : nowSec - marginSec;
  };

  // Un caso: tres banderas de validez independientes + los claims construidos con ellas.
  const generate = () => {
    const issValid = Math.random() < 0.5;
    const audValid = Math.random() < 0.5;
    const expValid = Math.random() < 0.5;
    const claims = { iss: genIss(issValid), aud: genAud(audValid), exp: genExp(expValid) };
    return { claims, allValid: issValid && audValid && expValid };
  };

  // La propiedad: validateIdClaims acepta si y solo si los tres campos son válidos,
  // y coincide con el oráculo independiente en cada caso.
  const check = ({ claims, allValid }) => {
    const result = validateIdClaims(claims, CFG, NOW_MS);
    return result === allValid && result === expectedByRule(claims, CFG, NOW_MS);
  };

  forAll(200, generate, check);

  // --- Casos límite fijos ---------------------------------------------------

  const base = { iss: EXPECTED_ISSUER, aud: CFG.clientId, exp: nowSec + 60 };

  const edgeCases = [
    // exp justo en el borde: exp*1000 === NOW_MS -> vencido (comparación estricta), debe rechazar.
    { claims: { ...base, exp: NOW_MS / 1000 }, expected: false, nota: 'exp justo en el borde' },
    // exp un milisegundo "después" del borde (en segundos, apenas por encima) -> aceptar.
    { claims: { ...base, exp: NOW_MS / 1000 + 0.001 }, expected: true, nota: 'exp un pelo por encima del borde' },
    // iss con diferencia mínima (barra final) -> rechazar.
    { claims: { ...base, iss: `${EXPECTED_ISSUER}/` }, expected: false, nota: 'iss con barra de más' },
    // aud con diferencia mínima (un carácter) -> rechazar.
    { claims: { ...base, aud: `${CFG.clientId}x` }, expected: false, nota: 'aud con un carácter de más' },
    // Todos correctos -> aceptar.
    { claims: { ...base }, expected: true, nota: 'los tres correctos' },
    // claims null -> rechazar sin romper.
    { claims: null, expected: false, nota: 'claims null' },
    // claims sin campos -> rechazar.
    { claims: {}, expected: false, nota: 'claims vacío' },
    // exp ausente -> rechazar.
    { claims: { iss: EXPECTED_ISSUER, aud: CFG.clientId }, expected: false, nota: 'sin exp' },
    // exp no numérico -> rechazar.
    { claims: { ...base, exp: '9999999999' }, expected: false, nota: 'exp como cadena' },
  ];

  for (const { claims, expected, nota } of edgeCases) {
    const result = validateIdClaims(claims, CFG, NOW_MS);
    if (result !== expected) {
      throw new Error(`Caso límite falló (${nota}): esperaba ${expected}, obtuvo ${result} con ${JSON.stringify(claims)}`);
    }
  }

  console.log('Feature: accounts-auth, Property 11: OK (200 combinaciones iss/aud/exp + 9 casos límite)');
} finally {
  if (needsLocationStub) delete globalThis.location;
}
```

## Cómo ejecutarlo

### En el navegador

1. Servir `exercise/` con un servidor estático (por ejemplo `npx serve exercise` o `python3 -m http.server 8080` dentro de `exercise/`) y abrir `http://localhost:8080`.
2. Abrir la consola de DevTools, pegar el script completo y presionar Enter. En el navegador `location` ya existe, así que el stub no se aplica. El `await import('./src/core/auth.js')` resuelve la ruta relativa a la URL de la página.

### En Node (sin navegador)

El script ya trae el arnés `forAll`, el stub de `location` y usa `await import(...)` de nivel superior (módulo). Desde la carpeta de la app (`exercise/`), se copia el bloque ` ```js ` a la entrada de Node:

```sh
node --input-type=module
```

(pegando el contenido del bloque y cerrando con Ctrl-D). El `await import('./src/core/auth.js')` resuelve la ruta relativa a la carpeta desde la que se ejecuta Node, por eso se corre desde `exercise/`. No se crea ningún archivo temporal.

## Resultado esperado

El script termina sin lanzar error e imprime:

```
Feature: accounts-auth, Property 11: OK (200 combinaciones iss/aud/exp + 9 casos límite)
```

Un `Error: Falla con: ...` señala una combinación de claims donde `validateIdClaims` no coincidió con la regla (por ejemplo, aceptó con un issuer distinto, o rechazó claims correctos, o se equivocó en las unidades de `exp`). Un `Error: Caso límite falló (...)` indica que un borde conocido (el `exp` justo en el límite, una diferencia mínima en `iss`/`aud`, o `claims` nulo/sin campos) no se comportó como exige la propiedad. En ambos casos se reporta a `coder` con el caso que falló.

## Última ejecución

La lógica de la propiedad se corrió con Node 24 sobre 200 combinaciones aleatorias de `iss`/`aud`/`exp` (cada campo variado entre válido e inválido de forma independiente) más los 9 casos límite: todos coincidieron con el oráculo independiente `expectedByRule` y con la implementación real de `validateIdClaims` (copiada tal cual de `src/core/auth.js`, incluida la comparación estricta `exp * 1000 > now` entre segundos y milisegundos). Por separado se verificó que `await import('./src/core/auth.js')` resuelve con el stub de `location` y que el `validateIdClaims` importado del módulo real acepta los claims correctos y rechaza una audiencia distinta. La salida fue `Feature: accounts-auth, Property 11: OK (200 combinaciones iss/aud/exp + 9 casos limite)`.

Nota del entorno: igual que se documentó en la Propiedad 5, en esta sandbox la combinación `node --input-type=module` leyendo por stdin (y `--eval` con top-level `await import`) puede quedarse colgada; para ejecutar el script tal como está documentado, usar la consola de DevTools con la app servida, o pegar el bloque en `node --input-type=module` por stdin y cerrar con Ctrl-D. Ambos resuelven el `import` sin ese cuelgue.
