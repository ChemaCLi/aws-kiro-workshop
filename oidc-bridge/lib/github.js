// Intercambio con GitHub para el puente OIDC.
// Dos pasos del flujo OAuth de GitHub: canjear el authorization code por un
// access token (usando el client secret que vive en variables de entorno) y
// leer el perfil del usuario. Devuelve una identidad normalizada que las rutas
// del puente convierten luego en un ID token OIDC para Cognito.
// Usa el fetch nativo de Node 20+; no agrega dependencias.

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

// User-Agent requerido por la API de GitHub; sin él responde 403.
const USER_AGENT = 'focus-garden-oidc-bridge';

/**
 * Lee las credenciales de GitHub de las variables de entorno.
 * Se resuelven en cada llamada (no al importar) para que el servidor pueda
 * fallar con un mensaje claro si falta configuración, sin romper el import.
 *
 * @returns {{ clientId: string, clientSecret: string }}
 */
function readGithubCredentials() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Faltan GITHUB_CLIENT_ID o GITHUB_CLIENT_SECRET en el entorno.');
  }
  return { clientId, clientSecret };
}

/**
 * Canjea el authorization code de GitHub por un access token.
 * El client secret viaja solo en esta petición servidor-a-servidor, nunca al
 * frontend. Se pide la respuesta en JSON con Accept para no tener que parsear
 * el formato por defecto (urlencoded).
 *
 * @param {string} code - El authorization code que GitHub devolvió al callback.
 * @param {string} [redirectUri] - La misma redirect_uri usada al autorizar, si aplica.
 * @returns {Promise<string>} El access token de GitHub.
 */
export async function exchangeCodeForToken(code, redirectUri) {
  if (typeof code !== 'string' || code === '') {
    throw new Error('El authorization code de GitHub es obligatorio.');
  }
  const { clientId, clientSecret } = readGithubCredentials();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });
  if (redirectUri) body.set('redirect_uri', redirectUri);

  let response;
  try {
    response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: body.toString(),
    });
  } catch (cause) {
    // Error de red: GitHub no respondió. Se traduce a un error de dominio
    // para que la ruta lo reporte como "GitHub no disponible".
    throw new Error('No se pudo contactar a GitHub para canjear el code.', { cause });
  }

  if (!response.ok) {
    throw new Error(`GitHub rechazó el canje del code (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  // GitHub responde 200 incluso con errores de OAuth; el error va en el cuerpo.
  if (payload.error) {
    throw new Error(`GitHub devolvió un error de OAuth: ${payload.error}.`);
  }
  if (!payload.access_token) {
    throw new Error('La respuesta de GitHub no incluyó un access token.');
  }
  return payload.access_token;
}

/**
 * Lee el perfil del usuario con el access token y lo normaliza.
 * Combina /user (perfil básico) con /user/emails para obtener el correo
 * principal verificado, que el perfil básico omite cuando es privado.
 *
 * La identidad normalizada usa el id numérico de GitHub como `sub` (estable y
 * único), el correo principal verificado como `email`, y el nombre real o,
 * si falta, el login como `name`.
 *
 * @param {string} accessToken - El access token obtenido en el canje.
 * @returns {Promise<{ sub: string, email: string, name: string, login: string }>}
 */
export async function fetchGithubIdentity(accessToken) {
  if (typeof accessToken !== 'string' || accessToken === '') {
    throw new Error('El access token de GitHub es obligatorio.');
  }

  const profile = await getJson(GITHUB_USER_URL, accessToken);
  const emails = await getJson(GITHUB_EMAILS_URL, accessToken);
  const email = pickPrimaryEmail(emails);

  return {
    sub: String(profile.id),
    email,
    name: profile.name || profile.login,
    login: profile.login,
  };
}

/**
 * GET autenticado contra la API de GitHub que espera JSON de vuelta.
 * Centraliza las cabeceras y el manejo de errores de red y de respuestas no-ok.
 *
 * @param {string} url - El endpoint de la API de GitHub.
 * @param {string} accessToken - El access token para la cabecera Authorization.
 * @returns {Promise<any>} El cuerpo JSON parseado.
 */
async function getJson(url, accessToken) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': USER_AGENT,
      },
    });
  } catch (cause) {
    throw new Error(`No se pudo contactar a GitHub (${url}).`, { cause });
  }

  if (!response.ok) {
    throw new Error(`GitHub respondió con error al leer el perfil (HTTP ${response.status}).`);
  }
  return response.json();
}

/**
 * Elige el correo principal verificado de la lista de /user/emails.
 * Prefiere el marcado como `primary` y `verified`; si no hay, cae al primero
 * verificado. Devuelve cadena vacía si ninguno está verificado, para que la
 * ruta decida si eso es aceptable.
 *
 * @param {Array<{ email: string, primary: boolean, verified: boolean }>} emails
 * @returns {string} El correo elegido, o '' si no hay uno verificado.
 */
function pickPrimaryEmail(emails) {
  if (!Array.isArray(emails)) return '';
  const primary = emails.find((entry) => entry.primary && entry.verified);
  if (primary) return primary.email;
  const anyVerified = emails.find((entry) => entry.verified);
  return anyVerified ? anyVerified.email : '';
}
