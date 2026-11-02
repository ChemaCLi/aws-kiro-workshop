// Servicio de autenticación con Amazon Cognito (registro, inicio, cierre, OAuth/PKCE).
// Responsabilidad: concentrar toda la lógica de OAuth 2.0 (authorization code + PKCE),
// tokens y sesión. No toca el store ni `jardin-movil:v1`; la sesión vive aparte en la
// clave `focus-garden:auth:v1`. `core` no importa de `components`, `ui` ni `three`.
//
// No usa DOM salvo `location.assign` para los redirects del Hosted UI y el puente OIDC.
// Las funciones puras de abajo (state y desafío PKCE) no dependen de nada del navegador
// más que WebCrypto, por lo que se pueden probar con el arnés `forAll`.

import { AUTH_CONFIG } from './auth-config.js';

// --- Disponibilidad y degradación (req. 10) ---

/**
 * Indica si en ESTE momento se puede autenticar, para que las vistas decidan al pintar
 * si habilitan o deshabilitan los controles de cuenta (req. 10.1, 10.2). Es deliberadamente
 * BARATA y SÍNCRONA: se llama en cada repintado, así que no hace red; un fetch bloqueante
 * aquí congelaría la interfaz. Comprueba las dos señales síncronas que de verdad bloquean
 * el flujo:
 *   - `navigator.onLine`: si el navegador se declara sin conexión, no hay nada que hacer
 *     contra Cognito. Se compara con `!== false` para que, cuando la API no exista
 *     (entornos sin `navigator`), no demos un falso negativo y asumamos que hay red.
 *   - `crypto.subtle`: PKCE necesita `SHA-256` (ver `pkceChallenge`), que solo existe en
 *     contextos seguros (HTTPS o localhost). Sin él no podemos iniciar el flujo social, así
 *     que lo tratamos como "no disponible" en vez de fallar a mitad del login.
 *
 * En la opción preferida (fetch + WebCrypto) el "Account_SDK" es el propio `auth.js`, por
 * eso no hay un script externo que verificar aquí; si algún día se usa la alternativa por
 * CDN (`amazon-cognito-identity-js`), esta función sumaría la comprobación de que el script
 * cargó. El alcance real de Cognito (su descubrimiento OIDC) se verifica aparte y de forma
 * async cuando haga falta, no en esta comprobación de pintado.
 *
 * @returns {boolean} true si hay red y WebCrypto para arrancar el flujo de cuenta.
 */
export function isAuthAvailable() {
  const online = typeof navigator === 'undefined' || navigator.onLine !== false;
  const hasWebCrypto = Boolean(typeof crypto !== 'undefined' && crypto.subtle);
  return online && hasWebCrypto;
}

/**
 * Suscribe `cb` a los cambios de disponibilidad para que la Auth_Page y el Account_Slot
 * se rehabiliten SIN recargar cuando vuelve la red (req. 10.4). Escucha los eventos
 * `online`/`offline` de `window` y, en cada uno, llama `cb(isAuthAvailable())` con el valor
 * ya resuelto para que la vista no tenga que recalcularlo.
 *
 * Degradación elegante: si no hay `window` (p. ej. al probar la lógica pura en Node), no
 * registra nada y devuelve una función de baja que no hace nada, de modo que quien la use
 * pueda llamarla sin condicionales.
 *
 * @param {(available: boolean) => void} cb se invoca en cada cambio con la disponibilidad.
 * @returns {() => void} función para desuscribir y quitar los listeners.
 */
export function onAvailabilityChange(cb) {
  if (typeof window === 'undefined') return () => {};

  const notify = () => cb(isAuthAvailable());
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}

/**
 * Codifica bytes en base64url: base64 estándar pero sin relleno `=`, con `-` en vez de
 * `+` y `_` en vez de `/`. Es el formato que exigen OAuth/OIDC para `state`, el verifier
 * y el desafío PKCE.
 */
function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Genera un `state` fresco y suficientemente aleatorio para cada intento de login.
 * Protege contra CSRF: al volver del proveedor se compara por igualdad estricta.
 * Usa `crypto.getRandomValues`, que existe también sin contexto seguro (HTTP en LAN).
 */
export function randomState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/**
 * Deriva el desafío PKCE del verificador: `base64url(SHA-256(verifier))`, con el método
 * `S256`. Es asíncrona porque `crypto.subtle.digest` lo es. `crypto.subtle` solo existe
 * en contextos seguros (HTTPS o localhost); si no está disponible, degrada devolviendo
 * `null` para que el flujo social se marque como no disponible en vez de romperse.
 */
export async function pkceChallenge(verifier) {
  if (!crypto?.subtle) return null;
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(new Uint8Array(digest));
}
/**
 * Construye la URL del Hosted UI de Cognito (`/oauth2/authorize`) para iniciar el flujo
 * de autorización con un proveedor. Es función pura: no toca el DOM ni guarda nada; solo
 * arma la cadena a partir de la config y los argumentos, para que la vista decida cuándo
 * navegar y las pruebas puedan inspeccionar el resultado.
 *
 * Fija el flujo seguro por diseño (req. 4.2, 12.1, 12.3): siempre `response_type=code`
 * (nunca el implícito `token`) y `code_challenge_method=S256` para PKCE. El `redirect_uri`
 * sale de la config, que solo declara URIs permitidas por el App Client; nunca se incluye
 * un secreto porque este flujo es público (PKCE sustituye al client secret).
 *
 * @param {{ provider: string, state: string, challenge: string }} args
 *   `provider` es una clave de `AUTH_CONFIG.providers` (p. ej. 'Google', 'GitHub');
 *   `state` protege contra CSRF; `challenge` es el desafío PKCE de `pkceChallenge`.
 * @returns {string} la URL absoluta de autorización, lista para `location.assign`.
 */
export function buildAuthorizeUrl({ provider, state, challenge }) {
  const url = new URL('/oauth2/authorize', AUTH_CONFIG.cognitoDomain);
  const params = url.searchParams;
  params.set('client_id', AUTH_CONFIG.clientId);
  params.set('response_type', 'code'); // nunca 'token': evitamos el flujo implícito
  params.set('scope', AUTH_CONFIG.scopes.join(' '));
  params.set('redirect_uri', AUTH_CONFIG.redirectUri);
  params.set('identity_provider', AUTH_CONFIG.providers[provider]);
  params.set('state', state);
  params.set('code_challenge', challenge);
  params.set('code_challenge_method', 'S256'); // PKCE: el verifier se envía al canjear
  return url.toString();
}

/**
 * Construye la petición para canjear el `code` por tokens en `/oauth2/token`. No ejecuta
 * el `fetch`: devuelve la forma `{ url, body }` que `handleRedirect` consumirá con
 * `fetch(url, { method: 'POST', headers, body })`, para mantener esta lógica pura y
 * verificable sin red.
 *
 * El `body` es un `URLSearchParams` porque el endpoint de token espera un formulario
 * `application/x-www-form-urlencoded`. Incluye SIEMPRE `code_verifier` (así PKCE prueba
 * que quien canjea es quien inició) y NUNCA `client_secret`: el App Client es público y
 * la seguridad recae en PKCE (req. 9.3, 12.1).
 *
 * @param {{ code: string, verifier: string }} args
 *   `code` es el código de autorización devuelto por Cognito; `verifier` es el verificador
 *   PKCE original guardado antes del redirect.
 * @returns {{ url: string, body: URLSearchParams }}
 */
export function buildTokenRequest({ code, verifier }) {
  const url = new URL('/oauth2/token', AUTH_CONFIG.cognitoDomain).toString();
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', AUTH_CONFIG.clientId);
  body.set('code', code);
  body.set('code_verifier', verifier); // PKCE: prueba de posesión, reemplaza al secreto
  body.set('redirect_uri', AUTH_CONFIG.redirectUri);
  return { url, body };
}

// --- Ruteo derivado y sesión (lógica pura + persistencia, req. 3.5, 4.7, 6, 9) ---

// Clave DEDICADA de la sesión en localStorage. Deliberadamente separada de
// `jardin-movil:v1` (los datos del jardín): perder, borrar o expirar tokens nunca
// debe tocar tareas, rondas ni ajustes. La Propiedad 8 fija esta no interferencia.
const SESSION_KEY = 'focus-garden:auth:v1';

// Copia en memoria de la sesión activa. `getSession()` la devuelve sin volver a leer
// `localStorage`, y `saveSession`/`signOut` la mantienen sincronizada con el disco.
let currentSession = null;

/**
 * Decide a dónde llevar al usuario justo después de iniciar sesión. Función pura: la
 * vista no decide la ruta, solo la aplica. El destino depende SOLO de la Display_Name
 * (req. 3.5, 4.7, 6.1): si falta o está vacía hay que pedirla con el Name_Prompt; si ya
 * existe, se va directo a Tareas. La Propiedad 7 fija este "si y solo si".
 *
 * @param {{ displayName?: string }} session sesión recién abierta.
 * @returns {'name-prompt' | 'tasks'}
 */
export function postSignInRoute(session) {
  const hasDisplayName = Boolean(session && session.displayName);
  return hasDisplayName ? 'tasks' : 'name-prompt';
}

/**
 * Decide qué hacer con la sesión según las expiraciones, cubriendo TODAS las
 * combinaciones de un dominio finito (Propiedad 10). Función pura, sin leer el reloj:
 * `now` llega como argumento para poder probarla. La regla es jerárquica:
 *   - `'ok'`: el access token sigue vigente, no hace falta nada.
 *   - `'refresh'`: el access token caducó pero el refresh token aún sirve para renovar.
 *   - `'sign-in'`: el refresh token también caducó, hay que volver a iniciar sesión.
 *
 * Un token está vigente mientras `now` no haya alcanzado su expiración (`now < exp`);
 * al llegar justo a la expiración se considera caducado.
 *
 * @param {number} now epoch ms actual.
 * @param {number} accessExp epoch ms en que caduca el access token.
 * @param {number} refreshExp epoch ms en que caduca el refresh token.
 * @returns {'ok' | 'refresh' | 'sign-in'}
 */
export function sessionAction(now, accessExp, refreshExp) {
  const accessValid = now < accessExp;
  if (accessValid) return 'ok';
  const refreshValid = now < refreshExp;
  if (refreshValid) return 'refresh';
  return 'sign-in';
}

/**
 * Deriva el `issuer` que Cognito pone en el ID token. No se guarda aparte (ver
 * `auth-config.js`): se arma siempre a partir de `region` y `userPoolId` para que no
 * puedan quedar desalineados. Formato fijo del User Pool de Cognito.
 */
function expectedIssuer(cfg) {
  return `https://cognito-idp.${cfg.region}.amazonaws.com/${cfg.userPoolId}`;
}

/**
 * Valida los claims del ID token antes de confiar en la identidad que trae (correo,
 * Display_Name). Función pura: recibe `now` y `cfg` en vez de leerlos, para poder
 * probarla. Acepta si y SOLO si (Propiedad 11, req. 9.7, 12.5):
 *   - `iss` es el issuer esperado de este User Pool,
 *   - `aud` es el `clientId` de nuestro App Client (el token es para nosotros),
 *   - `exp` todavía no vence respecto a `now`.
 *
 * Unidades: `exp` del JWT viene en SEGUNDOS epoch (estándar OIDC), mientras que `now`
 * es epoch en MILISEGUNDOS (como `Date.now()`); por eso se compara `exp * 1000 > now`.
 * Verificar la firma contra el JWKS es aparte (`verifyIdSignature`); aquí solo claims.
 *
 * @param {{ iss?: string, aud?: string, exp?: number }} claims claims del ID token.
 * @param {{ region: string, userPoolId: string, clientId: string }} cfg config pública.
 * @param {number} now epoch ms actual.
 * @returns {boolean}
 */
export function validateIdClaims(claims, cfg, now) {
  if (!claims) return false;
  const issuerMatches = claims.iss === expectedIssuer(cfg);
  const audienceMatches = claims.aud === cfg.clientId;
  const notExpired = typeof claims.exp === 'number' && claims.exp * 1000 > now;
  return issuerMatches && audienceMatches && notExpired;
}

/**
 * Guarda la Session en su clave dedicada de `localStorage` y en la copia en memoria.
 * No toca `jardin-movil:v1` (Propiedad 8). Hace round-trip con `loadSession`
 * (Propiedad 9): lo que se guarda aquí es lo que vuelve allá.
 *
 * @param {object} session tokens, expiraciones, email y Display_Name.
 */
export function saveSession(session) {
  currentSession = session;
  // Si localStorage no está disponible (modo privado estricto), la sesión igual vive en
  // memoria para esta pestaña; no rompemos el flujo por no poder persistir.
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Seguro de ignorar: sin persistencia, getSession() sigue funcionando en memoria.
  }
}

/**
 * Carga la Session desde `localStorage`. Devuelve `null` si no hay nada guardado, si el
 * contenido está corrupto, o si la sesión ya no es utilizable: cuando `sessionAction`
 * indica `'sign-in'` (access y refresh caducados) se descarta y se devuelve `null`
 * (Propiedad 9). Una sesión con solo el access caducado pero refresh vigente sí se
 * devuelve: renovarla es responsabilidad de `refreshIfNeeded`, no de la carga.
 *
 * Mantiene la copia en memoria sincronizada con lo que realmente se devuelve.
 *
 * @returns {object | null}
 */
export function loadSession() {
  let raw = null;
  try {
    raw = localStorage.getItem(SESSION_KEY);
  } catch {
    // Seguro de ignorar: sin acceso a localStorage tratamos como "sin sesión".
    return null;
  }
  if (!raw) return null;

  let session;
  try {
    session = JSON.parse(raw);
  } catch {
    // Dato corrupto: lo tratamos como si no hubiera sesión en vez de romper el arranque.
    return null;
  }

  const action = sessionAction(Date.now(), session.accessExpiresAt, session.refreshExpiresAt);
  if (action === 'sign-in') {
    // Expiró sin refresh válido: no sirve para nada, se descarta.
    currentSession = null;
    return null;
  }

  currentSession = session;
  return session;
}

/**
 * Devuelve la sesión activa en memoria sin volver a tocar `localStorage`. La usan las
 * vistas para pintar el estado de la cuenta en cada repintado. `null` si no hay sesión.
 *
 * @returns {object | null}
 */
export function getSession() {
  return currentSession;
}

// --- Modelo del Account_Slot y utilidades de error/contraseña (lógica pura, req. 2, 3, 7, 10) ---

/**
 * Deriva el modelo del Account_Slot de Ajustes a partir de la sesión y de si el
 * Account_SDK está listo. Función pura: no toca el DOM ni lee disponibilidad por su
 * cuenta, recibe `sdkReady` como argumento para poder probarla y para que la vista
 * decida cuándo recalcular. La forma `{ enabled, mode, label, canSignOut }` la fija la
 * Propiedad 12 y cubre las tres situaciones de la tabla de `settings-view.js`:
 *   - Sin SDK (`!sdkReady`): deshabilitado con aviso; el resto de Ajustes no se rompe
 *     (req. 10.1, 10.3). No se ofrece cerrar sesión aunque hubiera tokens: sin red no
 *     hay nada que hacer con la cuenta.
 *   - Con SDK y sin sesión: control de invitado que lleva a la Auth_Page (req. 7.3).
 *   - Con SDK y con sesión: muestra la Display_Name, o el correo si falta, y expone el
 *     control de cerrar sesión (req. 7.1, 7.2).
 *
 * @param {{ displayName?: string, email?: string } | null} session sesión activa o null.
 * @param {boolean} sdkReady si el Account_SDK está disponible (red + Cognito alcanzable).
 * @returns {{ enabled: boolean, mode: 'disabled' | 'guest' | 'signed-in', label: string, canSignOut: boolean }}
 */
export function accountSlotModel(session, sdkReady) {
  if (!sdkReady) {
    return {
      enabled: false,
      mode: 'disabled',
      label: 'Necesitas conexión para usar tu cuenta',
      canSignOut: false,
    };
  }

  if (!session) {
    return {
      enabled: true,
      mode: 'guest',
      label: 'Crear cuenta o iniciar sesión',
      canSignOut: false,
    };
  }

  // Con sesión: la Display_Name es la etiqueta; si falta o está vacía, cae al correo.
  const displayName = session.displayName;
  const label = displayName && displayName.trim() ? displayName : (session.email || '');
  return {
    enabled: true,
    mode: 'signed-in',
    label,
    canSignOut: true,
  };
}

// Reglas de la política de contraseña de Cognito. Cada una sabe si la cumple una
// contraseña y qué texto en español mostrar cuando no se cumple. El orden de esta lista
// es el orden en que se muestran las reglas incumplidas. Se recorre entera en
// `passwordUnmetRules`; así agregar una regla nueva es añadir una entrada aquí.
const PASSWORD_RULES = [
  {
    // `minLength` por defecto 8, el mínimo que Cognito permite configurar.
    satisfies: (password, policy) => password.length >= (policy.minLength ?? 8),
    message: (policy) => `Debe tener al menos ${policy.minLength ?? 8} caracteres`,
    requiredBy: (policy) => true, // la longitud mínima siempre aplica
  },
  {
    satisfies: (password) => /[A-Z]/.test(password),
    message: () => 'Debe incluir una letra mayúscula',
    requiredBy: (policy) => Boolean(policy.requireUppercase),
  },
  {
    satisfies: (password) => /[a-z]/.test(password),
    message: () => 'Debe incluir una letra minúscula',
    requiredBy: (policy) => Boolean(policy.requireLowercase),
  },
  {
    satisfies: (password) => /[0-9]/.test(password),
    message: () => 'Debe incluir un número',
    requiredBy: (policy) => Boolean(policy.requireNumbers),
  },
  {
    // Símbolos permitidos por Cognito: el conjunto que documenta su política de contraseña.
    satisfies: (password) => /[\^$*.[\]{}()?"!@#%&/\\,><':;|_~`+=\- ]/.test(password),
    message: () => 'Debe incluir un símbolo',
    requiredBy: (policy) => Boolean(policy.requireSymbols),
  },
];

/**
 * Devuelve la lista de mensajes de las reglas de la política de contraseña que la
 * contraseña NO cumple, para mostrarlas ANTES de llamar a Cognito (req. 2.5). Función
 * pura. La Propiedad 13 fija el "si y solo si": la lista está vacía exactamente cuando la
 * contraseña cumple todas las reglas que la política exige, y cada regla incumplida
 * aparece una sola vez, sin incluir reglas que sí se cumplen.
 *
 * Una regla entra en la lista solo si la política la exige (`requiredBy`) y la contraseña
 * no la satisface (`satisfies`); así desactivar un requisito en la política lo saca de la
 * validación en vez de reportarlo como incumplido.
 *
 * @param {string} password contraseña candidata.
 * @param {{ minLength?: number, requireUppercase?: boolean, requireLowercase?: boolean, requireNumbers?: boolean, requireSymbols?: boolean }} policy política del User Pool.
 * @returns {string[]} mensajes en español de las reglas incumplidas, en orden.
 */
export function passwordUnmetRules(password, policy) {
  const text = typeof password === 'string' ? password : '';
  const rules = policy || {};
  const unmet = [];
  for (const rule of PASSWORD_RULES) {
    if (rule.requiredBy(rules) && !rule.satisfies(text, rules)) {
      unmet.push(rule.message(rules));
    }
  }
  return unmet;
}

// Mensaje genérico para credenciales incorrectas. Es DELIBERADAMENTE único: no revela si
// falló el correo o la contraseña, para no dar pistas a quien intenta adivinar cuentas
// (req. 3.3). `NotAuthorizedException` y `UserNotFoundException` comparten este mensaje.
const INVALID_CREDENTIALS_MESSAGE = 'El correo o la contraseña no son correctos';

// Mensaje y acción por defecto para cualquier código de error desconocido. Nunca filtra
// detalles internos de Cognito: solo pide reintentar.
const UNKNOWN_ERROR = { message: 'Algo salió mal. Inténtalo de nuevo.', action: 'retry' };

// Mapa del dominio finito de códigos de error de Cognito a mensajes seguros en español y
// una acción sugerida que la vista usa para decidir qué ofrecer (p. ej. reenviar código,
// ir a iniciar sesión). Los dos códigos de credenciales comparten el mismo mensaje
// genérico a propósito; el resto describe el problema sin exponer detalles sensibles.
const AUTH_ERROR_MESSAGES = {
  // Registro: correo ya en uso → se ofrece iniciar sesión (req. 2.4).
  UsernameExistsException: { message: 'Ese correo ya tiene cuenta', action: 'sign-in' },
  // Política de contraseña rechazada por Cognito (respaldo de `passwordUnmetRules`).
  InvalidPasswordException: { message: 'La contraseña no cumple los requisitos', action: 'fix-password' },
  InvalidParameterException: { message: 'Revisa los datos e inténtalo de nuevo', action: 'retry' },
  // Confirmación de código (req. 2.6).
  CodeMismatchException: { message: 'El código no es correcto', action: 'resend-code' },
  ExpiredCodeException: { message: 'El código expiró', action: 'resend-code' },
  // Inicio de sesión: credenciales incorrectas, un único mensaje genérico (req. 3.3).
  NotAuthorizedException: { message: INVALID_CREDENTIALS_MESSAGE, action: 'retry' },
  UserNotFoundException: { message: INVALID_CREDENTIALS_MESSAGE, action: 'retry' },
  // Cuenta sin confirmar al iniciar → se ofrece reenviar el código (req. 3.4).
  UserNotConfirmedException: { message: 'Tu cuenta aún no está confirmada', action: 'resend-code' },
  // Límite de intentos: pedir esperar, sin revelar más.
  LimitExceededException: { message: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.', action: 'wait' },
  TooManyRequestsException: { message: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.', action: 'wait' },
  CodeDeliveryFailureException: { message: 'No pudimos enviar el código. Inténtalo de nuevo.', action: 'retry' },
};

/**
 * Mapea un código de error de Cognito a un mensaje seguro en español y una acción
 * sugerida. Función pura. La Propiedad 14 fija su contrato: para cualquier código conocido
 * devuelve un mensaje no vacío y una acción válida, y el mensaje de credenciales
 * incorrectas (`NotAuthorizedException`/`UserNotFoundException`) es un único mensaje
 * genérico que NO revela si falló el correo o la contraseña (req. 3.3). Un código
 * desconocido cae en un mensaje genérico seguro, sin filtrar detalles internos.
 *
 * @param {string} code código de excepción de Cognito (p. ej. 'CodeMismatchException').
 * @returns {{ message: string, action: string }}
 */
export function mapAuthError(code) {
  return AUTH_ERROR_MESSAGES[code] || UNKNOWN_ERROR;
}

// --- Flujos de registro e inicio por contraseña con la API JSON de Cognito (req. 2, 3) ---

// Prefijo del servicio que exige la cabecera `X-Amz-Target` de la API JSON de Cognito
// Identity Provider. La acción completa es `${TARGET_PREFIX}.${Accion}`, p. ej.
// `AWSCognitoIdentityProviderService.SignUp`.
const COGNITO_TARGET_PREFIX = 'AWSCognitoIdentityProviderService';

// Content-Type propio del protocolo JSON 1.1 de AWS; distinto del `application/json`
// habitual. Sin él, Cognito rechaza la petición.
const COGNITO_CONTENT_TYPE = 'application/x-amz-json-1.1';

/**
 * Deriva el endpoint regional de Cognito Identity Provider a partir de la región pública.
 * Todas las acciones JSON (`SignUp`, `InitiateAuth`, …) se hacen con POST a esta misma URL;
 * lo que cambia entre acciones es la cabecera `X-Amz-Target`, no la ruta.
 */
function cognitoEndpoint() {
  return `https://cognito-idp.${AUTH_CONFIG.region}.amazonaws.com/`;
}

/**
 * Extrae el código de error de Cognito de una respuesta de error de la API JSON. Cognito
 * lo pone en el campo `__type`, a veces con un prefijo de namespace (p. ej.
 * `com.amazonaws...#NotAuthorizedException`); nos quedamos con lo que va tras el `#` para
 * que coincida con las claves de `mapAuthError`. Si no hay cuerpo reconocible, devolvemos
 * `''` para que `mapAuthError` caiga en su mensaje genérico seguro.
 *
 * @param {any} body cuerpo JSON ya parseado de la respuesta de error (o null).
 * @returns {string} el nombre de la excepción de Cognito, sin namespace.
 */
function cognitoErrorCode(body) {
  const rawType = body && typeof body.__type === 'string' ? body.__type : '';
  const hashIndex = rawType.lastIndexOf('#');
  return hashIndex >= 0 ? rawType.slice(hashIndex + 1) : rawType;
}

/**
 * Llama a una acción de la API JSON de Cognito con `fetch` y traduce cualquier fallo a un
 * error con mensaje seguro en español, para que las funciones de flujo de abajo no repitan
 * el manejo de red ni el de errores de Cognito.
 *
 * Distingue dos clases de fallo, ambas con el mismo contrato hacia arriba (lanza un `Error`
 * cuyo `.message` ya es apto para mostrar y cuyo `.code`/`.action` dejan decidir a la vista):
 *   - Error de Cognito (HTTP 4xx/5xx con `__type`): se mapea con `mapAuthError` para no
 *     filtrar detalles internos (req. 2.4, 3.3).
 *   - Fallo de red (fetch rechaza, sin conexión): degradación elegante con un mensaje claro
 *     de que no hubo conexión, sin exponer el error crudo del navegador (req. 10).
 *
 * @param {string} action nombre de la acción de Cognito (p. ej. 'SignUp').
 * @param {object} payload cuerpo de la petición, se serializa a JSON.
 * @returns {Promise<object>} el cuerpo JSON de la respuesta exitosa.
 */
async function callCognito(action, payload) {
  let response;
  try {
    response = await fetch(cognitoEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': COGNITO_CONTENT_TYPE,
        'X-Amz-Target': `${COGNITO_TARGET_PREFIX}.${action}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Fetch solo rechaza por fallo de red (sin conexión, DNS, CORS de transporte): no hubo
    // respuesta de Cognito, así que el usuario necesita reintentar con conexión.
    const networkError = new Error('No hay conexión. Revisa tu red e inténtalo de nuevo.');
    networkError.code = 'NetworkError';
    networkError.action = 'retry';
    throw networkError;
  }

  // Cognito devuelve el detalle del error en el cuerpo JSON incluso con HTTP de error; si el
  // cuerpo no es JSON (respuesta inesperada), lo tratamos como error desconocido seguro.
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Seguro de ignorar: sin cuerpo parseable caemos en el mensaje genérico de abajo.
  }

  if (!response.ok) {
    const code = cognitoErrorCode(body);
    const mapped = mapAuthError(code);
    const error = new Error(mapped.message);
    error.code = code;
    error.action = mapped.action;
    throw error;
  }

  return body || {};
}

/**
 * Registra una cuenta nueva en Cognito con correo y contraseña (`SignUp`). El correo va
 * tanto como `Username` como en los `UserAttributes`, porque el User Pool usa el correo como
 * identificador de inicio. No envía `SecretHash`: el App Client es público, sin secreto
 * (req. 9.2, 12.4). Tras un registro correcto, Cognito envía un código al correo y la cuenta
 * queda sin confirmar, por lo que devolvemos lo que la vista necesita para pasar al paso de
 * confirmación (req. 2.1, 2.2).
 *
 * Los errores (correo ya en uso, contraseña rechazada por la política) suben con el mensaje
 * seguro de `mapAuthError` para que la vista decida qué ofrecer (req. 2.4).
 *
 * @param {{ email: string, password: string }} credentials correo y contraseña del registro.
 * @returns {Promise<{ email: string, needsConfirmation: boolean, userConfirmed: boolean }>}
 */
export async function signUp({ email, password }) {
  const result = await callCognito('SignUp', {
    ClientId: AUTH_CONFIG.clientId,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
  });

  // `UserConfirmed` indica si Cognito dio la cuenta por confirmada de inmediato (poco común
  // con verificación por correo). Derivamos `needsConfirmation` para que la vista sepa si
  // tiene que mostrar el campo de código.
  const userConfirmed = Boolean(result.UserConfirmed);
  return { email, userConfirmed, needsConfirmation: !userConfirmed };
}

/**
 * Confirma una cuenta recién registrada con el código que Cognito envió al correo
 * (`ConfirmSignUp`). Sin `SecretHash` por ser cliente público. Si el código es incorrecto o
 * expiró, el error sube con la acción `resend-code` para que la vista ofrezca reenviarlo
 * (req. 2.3, 2.6).
 *
 * @param {{ email: string, code: string }} args correo y código de confirmación.
 * @returns {Promise<{ email: string, confirmed: boolean }>}
 */
export async function confirmSignUp({ email, code }) {
  await callCognito('ConfirmSignUp', {
    ClientId: AUTH_CONFIG.clientId,
    Username: email,
    ConfirmationCode: code,
  });
  return { email, confirmed: true };
}

/**
 * Reenvía el código de confirmación al correo (`ResendConfirmationCode`), para cuando el
 * código original expiró o no llegó (req. 2.6, 3.4). Sin `SecretHash` por ser cliente
 * público.
 *
 * @param {{ email: string }} args correo al que reenviar el código.
 * @returns {Promise<{ email: string, resent: boolean }>}
 */
export async function resendCode({ email }) {
  await callCognito('ResendConfirmationCode', {
    ClientId: AUTH_CONFIG.clientId,
    Username: email,
  });
  return { email, resent: true };
}

/**
 * Inicia sesión con correo y contraseña usando el flujo `USER_PASSWORD_AUTH` de
 * `InitiateAuth` (req. 3.1). De la respuesta exitosa (`AuthenticationResult`) construye la
 * Session y la persiste con `saveSession`, de modo que al volver la vista ya hay tokens. La
 * validación de firma y claims del ID token vive aparte (`verifyIdSignature`/`validateIdClaims`);
 * este flujo por contraseña confía en que Cognito emitió los tokens y solo deja la Session lista.
 *
 * Las expiraciones se derivan de `ExpiresIn` (segundos del access token, estándar de Cognito)
 * sumados a `Date.now()`. El refresh token de Cognito dura 30 días por defecto; usamos esa
 * ventana para `refreshExpiresAt` cuando la respuesta no trae una expiración explícita, que
 * es el caso normal de `InitiateAuth`.
 *
 * Devuelve la ruta que la vista debe aplicar (`postSignInRoute`): ir al Name_Prompt si falta
 * la Display_Name o directo a Tareas si ya existe (req. 3.5). Las credenciales incorrectas o
 * la cuenta sin confirmar suben con el mensaje seguro de `mapAuthError` (req. 3.3, 3.4).
 *
 * @param {{ email: string, password: string }} credentials correo y contraseña.
 * @returns {Promise<{ session: object, route: 'name-prompt' | 'tasks' }>}
 */
export async function signInWithPassword({ email, password }) {
  const result = await callCognito('InitiateAuth', {
    ClientId: AUTH_CONFIG.clientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });

  const session = sessionFromAuthResult(result.AuthenticationResult, email);
  saveSession(session);
  return { session, route: postSignInRoute(session) };
}

// Duración por defecto del refresh token de un App Client de Cognito: 30 días. `InitiateAuth`
// no devuelve cuándo caduca el refresh token, así que derivamos la ventana con este valor
// para que `sessionAction`/`loadSession` puedan decidir cuándo toca volver a iniciar sesión.
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Construye la Session persistible a partir del `AuthenticationResult` de Cognito. Traduce la
 * forma de la API (campos en PascalCase, `ExpiresIn` en segundos) a la forma interna que usan
 * `saveSession`/`loadSession` (epoch ms absolutos), siguiendo la regla del proyecto de guardar
 * expiraciones absolutas en vez de acumular tiempos relativos.
 *
 * La Display_Name no viene en esta respuesta (está en los claims del ID token, que se validan
 * aparte); se deja vacía para que `postSignInRoute` lleve al Name_Prompt hasta que se resuelva.
 *
 * @param {{ IdToken?: string, AccessToken?: string, RefreshToken?: string, ExpiresIn?: number }} authResult
 * @param {string} email correo con el que se inició sesión, para la etiqueta del Account_Slot.
 * @returns {object} la Session con la forma de `focus-garden:auth:v1`.
 */
function sessionFromAuthResult(authResult, email) {
  const result = authResult || {};
  const now = Date.now();
  const accessTtlMs = (typeof result.ExpiresIn === 'number' ? result.ExpiresIn : 0) * 1000;
  return {
    idToken: result.IdToken || '',
    accessToken: result.AccessToken || '',
    refreshToken: result.RefreshToken || '',
    accessExpiresAt: now + accessTtlMs,
    refreshExpiresAt: now + REFRESH_TOKEN_TTL_MS,
    displayName: '',
    email: email || '',
  };
}

// --- Inicio con proveedores y vuelta del redirect OAuth (req. 4, 5) ---

// Clave DEDICADA en sessionStorage donde viven el `state` y el `verifier` PKCE entre el
// redirect al proveedor y la vuelta. Va en sessionStorage (no localStorage) a propósito:
// es un dato efímero de UN intento de login, atado a la pestaña, que se borra al consumirse
// en `handleRedirect`. Separada de la sesión (`focus-garden:auth:v1`), que es persistente.
const PKCE_STORAGE_KEY = 'focus-garden:auth:pkce';

// Valor que GitHub pone en `error` cuando la persona cancela en la pantalla del proveedor.
// Cancelar NO es un fallo: se vuelve a la Auth_Page sin mensaje de error (req. 4.6).
const CANCEL_ERROR = 'access_denied';

/**
 * Genera un verificador PKCE fresco: 32 bytes aleatorios en base64url. Es el secreto de un
 * solo uso que se guarda antes del redirect y se envía al canjear el code; su hash (el
 * desafío) es lo único que viaja en la URL de autorización. Usa `crypto.getRandomValues`,
 * que existe también fuera de contexto seguro, para no depender de HTTPS solo para generarlo.
 */
function randomVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/**
 * Comprueba de forma barata si el puente OIDC de GitHub responde, para decidir si ofrecer
 * ese método sin tumbar los demás (req. 5.5). Hace una petición al descubrimiento OIDC del
 * puente (`/.well-known/openid-configuration`) con un timeout corto: si el puente no está
 * desplegado o no contesta, `fetch` rechaza o agota el tiempo y devolvemos `false` en vez de
 * dejar a la persona atascada en un redirect que nunca completaría.
 *
 * `mode: 'no-cors'` evita que la ausencia de cabeceras CORS cuente como fallo: solo nos
 * importa que el puente esté vivo, no leer su cuerpo. Un `AbortController` acota la espera
 * para no bloquear el toque del botón si el puente tarda.
 *
 * @returns {Promise<boolean>} true si el puente parece alcanzable.
 */
async function isBridgeReachable() {
  // Sin `fetch` (entornos sin red como Node al probar la lógica pura) no podemos sondear el
  // puente; lo tratamos como no disponible para degradar en vez de lanzar.
  if (typeof fetch === 'undefined') return false;

  const discoveryUrl = `${AUTH_CONFIG.oidcBridgeEndpoint}/.well-known/openid-configuration`;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 4000) : null;
  try {
    await fetch(discoveryUrl, {
      method: 'GET',
      mode: 'no-cors', // solo comprobamos vida, no leemos el cuerpo
      signal: controller ? controller.signal : undefined,
    });
    return true;
  } catch {
    // Fetch rechaza por red caída, DNS, timeout o puente apagado: GitHub no está disponible.
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * Inicia el flujo de autorización para un proveedor: prepara PKCE y el `state`, los guarda
 * para la vuelta y redirige al Hosted UI de Cognito (o, para GitHub, a Cognito con el puente
 * como identity provider). Es la única parte de este servicio que navega el navegador
 * (`location.assign`), siguiendo el flujo de código con PKCE de los req. 4.2 y 5.2.
 *
 * Degradación elegante (req. 5.5, 10): si NO se puede autenticar (sin red o sin WebCrypto),
 * o si `pkceChallenge` no puede derivar el desafío (falta `crypto.subtle` en HTTP sin
 * contexto seguro), o si el proveedor es GitHub y su puente no responde, NO navega y devuelve
 * `{ unavailable: true, reason }`. Así la vista muestra ese método como "no disponible" sin
 * tumbar los otros botones ni dejar la pantalla a medias.
 *
 * El `{ state, verifier, provider }` se guarda en sessionStorage bajo una clave dedicada; la
 * vuelta lo recupera en `handleRedirect` para validar el `state` y canjear con el `verifier`.
 *
 * @param {string} provider clave de `AUTH_CONFIG.providers` ('Google', 'Meta', 'Amazon', 'GitHub').
 * @returns {Promise<{ started: true } | { unavailable: true, reason: string }>}
 *   `started` cuando ya se lanzó el redirect; `unavailable` cuando el método no está disponible.
 */
export async function signInWithProvider(provider) {
  // Sin red o sin WebCrypto no hay forma de arrancar el flujo; lo marcamos no disponible en
  // vez de fallar a mitad del redirect (req. 10.1, 10.2).
  if (!isAuthAvailable()) {
    return { unavailable: true, reason: 'offline' };
  }

  const verifier = randomVerifier();
  const challenge = await pkceChallenge(verifier);
  // Sin `crypto.subtle` (HTTP sin contexto seguro) no hay desafío PKCE: degradamos el flujo
  // social a "no disponible" en vez de iniciar un login que Cognito rechazaría.
  if (!challenge) {
    return { unavailable: true, reason: 'no-webcrypto' };
  }

  // GitHub pasa por el puente OIDC: si no responde, ofrecemos "no disponible" y dejamos
  // intactos los demás métodos (req. 5.5). Los proveedores nativos de Cognito no se sondean.
  if (provider === 'GitHub') {
    const bridgeUp = await isBridgeReachable();
    if (!bridgeUp) {
      return { unavailable: true, reason: 'github-bridge' };
    }
  }

  const state = randomState();
  // Guardamos lo necesario para la vuelta: el `state` para la comprobación anti-CSRF, el
  // `verifier` para el canje PKCE y el `provider` por trazabilidad del intento.
  persistPkce({ state, verifier, provider });

  const url = buildAuthorizeUrl({ provider, state, challenge });
  // Única navegación del servicio: salimos de la app hacia el Hosted UI del proveedor.
  location.assign(url);
  return { started: true };
}

/**
 * Guarda el estado transitorio del redirect (state, verifier, provider) en sessionStorage.
 * Aislado en su propia función para no repetir el manejo de errores: si sessionStorage no
 * está disponible (modo privado estricto), no rompemos; el login simplemente no completará y
 * la vuelta lo detectará como "sin datos de intento".
 */
function persistPkce(data) {
  try {
    sessionStorage.setItem(PKCE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Seguro de ignorar: sin sessionStorage el canje fallará la comprobación de state y se
    // descartará de forma segura en `handleRedirect`, nunca abriendo una Session inválida.
  }
}

/**
 * Lee y BORRA el estado transitorio del redirect, para que un `state`/`verifier` se use una
 * sola vez (un intento no puede reutilizar los de otro). Devuelve `null` si no hay datos o si
 * están corruptos, de modo que `handleRedirect` trate ambos casos como "sin intento válido".
 */
function takePkce() {
  let raw = null;
  try {
    raw = sessionStorage.getItem(PKCE_STORAGE_KEY);
    sessionStorage.removeItem(PKCE_STORAGE_KEY);
  } catch {
    // Seguro de ignorar: sin sessionStorage no hay intento que recuperar.
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Dato corrupto: se trata como si no hubiera intento, sin abrir Session.
    return null;
  }
}

/**
 * Emite el evento `app:auth` en `document` para que `account-view` y `settings-view` sepan
 * que la sesión cambió, sin que una vista importe a otra (arquitectura de eventos). Degrada
 * en entornos sin DOM (p. ej. Node al probar la lógica): si no hay `document`, no emite nada.
 *
 * @param {object | null} session la sesión recién abierta (o null al cerrar).
 */
function emitAuthChange(session) {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent('app:auth', { detail: { session } }));
}

/**
 * Procesa la vuelta del proveedor: valida el `state`, canjea el `code` por tokens, valida el
 * ID token y abre la Session. Es el espejo de `signInWithProvider` y cierra el flujo de los
 * req. 4.3 a 4.7 y 5.4. Recibe los query params de la vuelta (un objeto plano o un
 * `URLSearchParams`), no los lee del DOM, para poder probarse con entradas controladas.
 *
 * Reglas, en orden:
 *   - Cancelación (`error=access_denied`): la persona canceló en el Hosted UI; se vuelve a la
 *     Auth_Page SIN mensaje de error (req. 4.6). Devuelve `{ cancelled: true }`.
 *   - Sin `state` guardado, o `state` recibido distinto del enviado (igualdad estricta): es un
 *     redirect falsificado o fuera de orden; se descarta sin abrir Session, con error
 *     (req. 4.5, 12.2). Devuelve `{ error: 'state-mismatch' }`.
 *   - Firma o claims del ID token inválidos (iss, aud, exp): tokens no confiables; se
 *     rechazan sin abrir Session (req. 9.7, 12.5). Devuelve `{ error: 'invalid-token' }`.
 *   - Todo correcto: guarda la Session, limpia el PKCE, emite `app:auth` y devuelve la ruta
 *     a aplicar (`postSignInRoute`) para que la vista navegue (req. 4.4, 4.7).
 *
 * La verificación de firma contra el JWKS (`verifyIdSignature`) y de los claims se concentra
 * en `isIdTokenTrustworthy`: se exigen AMBAS antes de abrir Session, así este flujo no confía
 * nunca en un ID token sin firma válida.
 *
 * @param {Record<string,string> | URLSearchParams} params query params de la vuelta.
 * @returns {Promise<
 *   { cancelled: true }
 *   | { error: 'state-mismatch' | 'invalid-token' | 'exchange-failed' }
 *   | { session: object, route: 'name-prompt' | 'tasks' }
 * >}
 */
export async function handleRedirect(params) {
  const get = paramGetter(params);

  // 1) Cancelación en el Hosted UI: volver sin ruido (req. 4.6).
  if (get('error') === CANCEL_ERROR) {
    takePkce(); // limpiamos el intento aunque no se complete
    return { cancelled: true };
  }

  // 2) Comprobación anti-CSRF: el `state` de la vuelta debe coincidir, por igualdad estricta,
  //    con el que guardamos antes del redirect (req. 4.5, 12.2).
  const sent = takePkce();
  const returnedState = get('state');
  const stateMatches = Boolean(sent) && sent.state === returnedState;
  if (!stateMatches) {
    return { error: 'state-mismatch' };
  }

  // 3) Canje del code por tokens contra `/oauth2/token`, enviando el verifier PKCE y nunca un
  //    secreto (req. 4.4, 9.3, 12.1). `buildTokenRequest` arma la petición; aquí la ejecutamos.
  const code = get('code');
  const { url, body } = buildTokenRequest({ code, verifier: sent.verifier });
  let tokens;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) return { error: 'exchange-failed' };
    tokens = await response.json();
  } catch {
    // Fallo de red o respuesta inesperada: no hubo canje, no se abre Session.
    return { error: 'exchange-failed' };
  }

  // 4) Validación del ID token antes de confiar en la identidad que trae (req. 9.7, 12.5).
  const idToken = tokens.id_token || '';
  const valid = await isIdTokenTrustworthy(idToken);
  if (!valid) {
    return { error: 'invalid-token' };
  }

  // 5) Identidad confiable: abrimos la Session con los tokens y los claims validados.
  const session = sessionFromTokens(tokens, idToken);
  saveSession(session);
  emitAuthChange(session);
  return { session, route: postSignInRoute(session) };
}

/**
 * Normaliza el acceso a los query params de la vuelta: admite tanto un `URLSearchParams` como
 * un objeto plano, para que la vista pase lo que tenga a mano. Devuelve una función
 * `get(name)` que entrega el valor o `undefined`.
 */
function paramGetter(params) {
  if (params && typeof params.get === 'function') {
    return (name) => params.get(name) ?? undefined;
  }
  const plain = params || {};
  return (name) => plain[name];
}

/**
 * Decide si un ID token es confiable: claims válidos (iss, aud, exp) Y firma RS256 válida
 * contra el JWKS de Cognito. Es el único punto por el que pasa un ID token antes de abrir una
 * Session, así que exige LAS DOS condiciones (req. 9.7, 12.5): primero los claims, que son
 * baratos y descartan la mayoría de los tokens falsos sin tocar la red, y solo si pasan,
 * la firma contra la clave pública del User Pool.
 *
 * @param {string} idToken el ID token JWT recibido en el canje.
 * @returns {Promise<boolean>}
 */
async function isIdTokenTrustworthy(idToken) {
  const claims = decodeJwtClaims(idToken);
  const claimsOk = validateIdClaims(claims, AUTH_CONFIG, Date.now());
  if (!claimsOk) return false;

  // Con los claims válidos, exigimos además que la firma valide contra el JWKS de Cognito
  // (req. 12.5). Cualquier fallo al obtener el JWKS o al verificar deja el token como no
  // confiable: preferimos no abrir sesión antes que confiar en una firma que no pudimos comprobar.
  try {
    const jwks = await fetchCognitoJwks();
    const signatureOk = await verifyIdSignature(idToken, jwks);
    return Boolean(signatureOk);
  } catch {
    // Si no se pudo validar la firma (JWKS inalcanzable o error), no confiamos en el token.
    return false;
  }
}

/**
 * Decodifica (sin verificar la firma) los claims del payload de un JWT. Solo sirve para leer
 * `iss`, `aud` y `exp` y pasarlos a `validateIdClaims`; la confianza real la da la validación
 * de firma aparte. Devuelve `null` si el token no tiene la forma de tres segmentos o si el
 * payload no es base64url/JSON válido, para que el llamador lo trate como no confiable.
 *
 * @param {string} jwt un JWT con la forma header.payload.signature.
 * @returns {object | null} los claims del payload, o null si no se puede decodificar.
 */
function decodeJwtClaims(jwt) {
  if (typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function'
      ? atob(payload)
      : Buffer.from(payload, 'base64').toString('binary');
    return JSON.parse(json);
  } catch {
    // Payload corrupto: se trata como token sin claims válidos.
    return null;
  }
}

// Caché en memoria del JWKS de Cognito. Se descarga una vez y se reutiliza mientras viva la
// pestaña: las claves públicas de firma cambian muy rara vez y así evitamos una red por login.
let cachedJwks = null;

/**
 * Descarga (y cachea) el JSON Web Key Set público de Cognito, con el que `verifyIdSignature`
 * comprueba la firma del ID token. Ruta estándar del User Pool. No persiste: vive en memoria
 * mientras dura la pestaña.
 *
 * @returns {Promise<object>} el JWKS `{ keys: [...] }` de Cognito.
 */
async function fetchCognitoJwks() {
  if (cachedJwks) return cachedJwks;
  const jwksUrl = `${expectedIssuer(AUTH_CONFIG)}/.well-known/jwks.json`;
  const response = await fetch(jwksUrl);
  cachedJwks = await response.json();
  return cachedJwks;
}

/**
 * Construye la Session persistible a partir de la respuesta del endpoint de token del flujo
 * OAuth (`/oauth2/token`, campos en snake_case) y de los claims ya decodificados del ID token.
 * A diferencia de `sessionFromAuthResult` (que viene de la API JSON de Cognito, PascalCase),
 * aquí el correo y la Display_Name sí llegan en los claims del ID token validado (`email`,
 * `name`), así que se copian para que `postSignInRoute` pueda decidir el destino.
 *
 * Las expiraciones se derivan de `expires_in` (segundos del access token) sumados a
 * `Date.now()`, siguiendo la regla de guardar expiraciones absolutas. La ventana del refresh
 * token usa el TTL por defecto de Cognito cuando la respuesta no trae una expiración explícita.
 *
 * @param {{ id_token?: string, access_token?: string, refresh_token?: string, expires_in?: number }} tokens
 * @param {string} idToken el ID token del que ya validamos firma y claims.
 * @returns {object} la Session con la forma de `focus-garden:auth:v1`.
 */
function sessionFromTokens(tokens, idToken) {
  const claims = decodeJwtClaims(idToken) || {};
  const now = Date.now();
  const accessTtlMs = (typeof tokens.expires_in === 'number' ? tokens.expires_in : 0) * 1000;
  return {
    idToken,
    accessToken: tokens.access_token || '',
    refreshToken: tokens.refresh_token || '',
    accessExpiresAt: now + accessTtlMs,
    refreshExpiresAt: now + REFRESH_TOKEN_TTL_MS,
    // La Display_Name y el correo vienen de los claims del ID token ya validado.
    displayName: typeof claims.name === 'string' ? claims.name : '',
    email: typeof claims.email === 'string' ? claims.email : '',
  };
}

// --- Validación de firma, refresco de tokens y atributos de cuenta (req. 6.2, 7.4, 9.5, 9.6, 9.7, 12.5) ---

/**
 * Decodifica una cadena base64url (el formato de los JWT: `-`/`_` en vez de `+`/`/` y sin
 * relleno `=`) a los bytes crudos que representa. Es la inversa de `base64url`. La usa
 * `verifyIdSignature` para pasar de la firma y los segmentos del token a los `Uint8Array`
 * que espera WebCrypto.
 *
 * @param {string} value cadena en base64url.
 * @returns {Uint8Array} los bytes decodificados.
 */
function base64urlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  // atob espera base64 estándar con relleno; lo restauramos a múltiplo de 4.
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = typeof atob === 'function'
    ? atob(padded)
    : Buffer.from(padded, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Verifica la firma RS256 de un ID token contra la clave pública correspondiente del JWKS de
 * Cognito (req. 9.7, 12.5). Es el paso que convierte un token "con claims correctos" en un
 * token de verdad confiable: sin esta comprobación, cualquiera podría forjar claims válidos.
 *
 * Elige la clave por el `kid` del header del token (un JWKS trae varias) y la importa con
 * `crypto.subtle.importKey('jwk', ...)` como clave pública `RSASSA-PKCS1-v1_5` + `SHA-256`,
 * que es exactamente el algoritmo que Cognito anuncia como `RS256`. Verifica la firma sobre
 * `header.payload` tal cual viajó en ASCII (los dos primeros segmentos, sin decodificar),
 * contra la firma del tercer segmento convertida de base64url a bytes.
 *
 * Degradación elegante (devuelve `false`, nunca lanza): si no hay `crypto.subtle` (HTTP sin
 * contexto seguro), si el token no tiene tres segmentos, si el JWKS no trae una clave con ese
 * `kid`, o si la importación/verificación falla. Así `isIdTokenTrustworthy` simplemente no
 * abre Session en vez de romperse.
 *
 * @param {string} idToken el ID token JWT (header.payload.signature).
 * @param {{ keys?: Array<object> }} jwks el JWKS de Cognito con las claves públicas.
 * @returns {Promise<boolean>} true solo si la firma es válida para la clave del `kid`.
 */
export async function verifyIdSignature(idToken, jwks) {
  // Sin WebCrypto no podemos verificar nada; degradamos a "no confiable" (false).
  if (!crypto?.subtle) return false;
  if (typeof idToken !== 'string') return false;

  const parts = idToken.split('.');
  if (parts.length !== 3) return false;
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  // El header trae el `kid` que identifica con qué clave del JWKS se firmó este token.
  let header;
  try {
    const headerJson = new TextDecoder().decode(base64urlToBytes(headerSegment));
    header = JSON.parse(headerJson);
  } catch {
    // Header corrupto: no se puede elegir clave, el token no es verificable.
    return false;
  }

  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  const jwk = keys.find((key) => key && key.kid === header.kid);
  // Sin una clave con ese `kid` no hay con qué verificar: token no confiable.
  if (!jwk) return false;

  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    // Lo firmado es la cadena ASCII `header.payload` tal como viajó, no su contenido decodificado.
    const signedData = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
    const signature = base64urlToBytes(signatureSegment);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signedData);
  } catch {
    // Clave inválida para el algoritmo o error de WebCrypto: tratamos el token como no confiable.
    return false;
  }
}

/**
 * Renueva la Session cuando el access token caducó pero el refresh token sigue vigente, y la
 * cierra cuando ya no hay forma de renovar (req. 9.5, 9.6). La decisión de QUÉ hacer la toma
 * la función pura `sessionAction`; aquí solo se ejecuta el efecto correspondiente:
 *   - `'ok'`: el access token sigue válido, no se toca nada y se devuelve la sesión actual.
 *   - `'refresh'`: se llama `InitiateAuth` con `REFRESH_TOKEN_AUTH` para obtener tokens nuevos,
 *     se actualizan en la sesión y se persisten. Si Cognito rechaza el refresh (token revocado
 *     o expirado antes de tiempo), se cierra la sesión y se devuelve `null`.
 *   - `'sign-in'`: ni access ni refresh sirven, se cierra la sesión y se devuelve `null`.
 *
 * El refresh token NO se reemplaza: `InitiateAuth` con `REFRESH_TOKEN_AUTH` no devuelve uno
 * nuevo, así que se conserva el actual y solo se actualizan id/access token y su expiración.
 *
 * @returns {Promise<object | null>} la sesión vigente (renovada o intacta), o `null` si se cerró.
 */
export async function refreshIfNeeded() {
  // Preferimos la copia en memoria; si no hay, intentamos cargarla de localStorage.
  const session = getSession() || loadSession();
  if (!session) return null;

  const action = sessionAction(Date.now(), session.accessExpiresAt, session.refreshExpiresAt);
  if (action === 'ok') return session;
  if (action === 'sign-in') {
    // Ni access ni refresh válidos: no hay nada que renovar, cerramos.
    signOut();
    return null;
  }

  // action === 'refresh': el access caducó pero el refresh sigue vigente.
  let result;
  try {
    result = await callCognito('InitiateAuth', {
      ClientId: AUTH_CONFIG.clientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: session.refreshToken },
    });
  } catch {
    // Cognito rechazó el refresh (token revocado/expirado) o falló la red: cerramos la sesión
    // para no quedarnos con tokens inservibles y forzar un nuevo inicio (req. 9.6).
    signOut();
    return null;
  }

  const auth = result.AuthenticationResult || {};
  const now = Date.now();
  const accessTtlMs = (typeof auth.ExpiresIn === 'number' ? auth.ExpiresIn : 0) * 1000;
  const refreshed = {
    ...session,
    // El refresh de Cognito no devuelve un refresh token nuevo: conservamos el actual.
    idToken: auth.IdToken || session.idToken,
    accessToken: auth.AccessToken || session.accessToken,
    accessExpiresAt: now + accessTtlMs,
  };
  saveSession(refreshed);
  return refreshed;
}

/**
 * Guarda la Display_Name del usuario en Cognito como el atributo estándar `name`
 * (`UpdateUserAttributes`) y la refleja en la sesión local (req. 6.2). La llamada usa el
 * access token de la sesión como credencial; no toca `jardin-movil:v1`.
 *
 * Tras una respuesta exitosa de Cognito, actualiza `displayName` en la copia en memoria y la
 * persiste con `saveSession`, de modo que `postSignInRoute`/`accountSlotModel` vean el nombre
 * nuevo sin volver a leer el ID token.
 *
 * @param {string} name la Display_Name a guardar.
 * @returns {Promise<object | null>} la sesión actualizada, o `null` si no hay sesión activa.
 */
export async function saveDisplayName(name) {
  const session = getSession() || loadSession();
  // Sin sesión no hay a quién actualizarle el atributo ni access token con que autenticar.
  if (!session) return null;

  await callCognito('UpdateUserAttributes', {
    AccessToken: session.accessToken,
    UserAttributes: [{ Name: 'name', Value: name }],
  });

  const updated = { ...session, displayName: name };
  saveSession(updated);
  return updated;
}

/**
 * Cierra la sesión: borra la clave dedicada `focus-garden:auth:v1` de `localStorage`, limpia
 * la copia en memoria y avisa a las vistas con `app:auth` (session null) para que repinten el
 * Account_Slot y la Auth_Page sin recargar (req. 7.4). Es síncrona a propósito: cerrar sesión
 * es un efecto local, no una llamada a Cognito.
 *
 * NO toca `jardin-movil:v1` (Propiedad 8): perder la cuenta jamás borra tareas, rondas ni
 * ajustes del jardín.
 */
export function signOut() {
  currentSession = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Seguro de ignorar: sin localStorage no hay nada persistido que borrar; la sesión en
    // memoria ya quedó limpia arriba.
  }
  emitAuthChange(null);
}
