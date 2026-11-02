// Almacén en memoria de los authorization code efímeros del puente.
// Entre `/callback` (donde el puente ya conoce la identidad de GitHub) y
// `/token` (donde Cognito canjea el code por el ID token firmado) hay que
// recordar a qué identidad corresponde cada code. Se guarda en memoria del
// proceso, no en disco ni en localStorage: el code vive segundos y es de un
// solo uso, así que un Map con expiración basta y evita arrastrar estado.
//
// Decisión de seguridad (simple y segura): el code es aleatorio y largo, se
// borra en el primer canje (un solo uso) y caduca a los pocos minutos aunque
// nadie lo canjee, para que un code filtrado no sirva indefinidamente.

import { randomBytes } from 'node:crypto';

// Vida del code antes de caducar por tiempo. Corta: Cognito canjea de inmediato.
const CODE_TTL_MS = 5 * 60 * 1000;

// code -> { identity, redirectUri, expiresAt }
const codes = new Map();

/**
 * Genera un authorization code aleatorio e imposible de adivinar.
 * 32 bytes en base64url dan suficiente entropía para que no se pueda forzar.
 *
 * @returns {string} El code recién generado.
 */
function generateCode() {
  return randomBytes(32).toString('base64url');
}

/**
 * Guarda la identidad de GitHub bajo un code nuevo y lo devuelve.
 * El code queda asociado a la identidad y a la redirect_uri del cliente, con
 * un instante de caducidad. Es lo que `/callback` entrega a Cognito.
 *
 * @param {Object} identity - Identidad normalizada de GitHub (sub, email, ...).
 * @param {string} [redirectUri] - La redirect_uri del cliente, si se necesita validar.
 * @returns {string} El authorization code efímero.
 */
export function issueCode(identity, redirectUri) {
  const code = generateCode();
  codes.set(code, { identity, redirectUri, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/**
 * Canjea un code: devuelve su identidad y lo invalida (un solo uso).
 * Si el code no existe o ya caducó, devuelve null para que `/token` responda
 * con un error de grant inválido. Borrar antes de devolver garantiza que un
 * segundo canje del mismo code falle.
 *
 * @param {string} code - El code que Cognito presenta en `/token`.
 * @returns {{ identity: Object, redirectUri?: string } | null}
 */
export function consumeCode(code) {
  if (typeof code !== 'string' || code === '') return null;
  const entry = codes.get(code);
  if (!entry) return null;
  codes.delete(code);
  if (entry.expiresAt < Date.now()) return null;
  return { identity: entry.identity, redirectUri: entry.redirectUri };
}
