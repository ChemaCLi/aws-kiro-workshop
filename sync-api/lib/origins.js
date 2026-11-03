// Lógica pura de la allowlist de orígenes de sync-api. Idéntica a la de oidc-bridge/lib/origins.js
// (duplicada a propósito: no hay un paquete compartido entre los dos servicios).
// Decide si un origen (la cabecera Origin de una petición) está permitido. Se usa para CORS.
// Sin dependencias ni efectos: solo compara contra la lista configurada.

/**
 * Decide si un origen es miembro exacto de la allowlist.
 * La comparación es por igualdad estricta de cadena: así un subdominio
 * ("https://evil.example.com") o un prefijo/sufijo nunca cuela como si fuera
 * un origen permitido ("https://example.com"). Entradas vacías o no válidas
 * devuelven false para fallar del lado seguro.
 *
 * @param {string} origin - El origen a verificar (p.ej. "https://app.example.com").
 * @param {string[]} allowlist - Orígenes permitidos, exactos.
 * @returns {boolean} true solo si `origin` aparece tal cual en `allowlist`.
 */
export function isAllowedOrigin(origin, allowlist) {
  if (typeof origin !== 'string' || origin === '') return false;
  if (!Array.isArray(allowlist)) return false;
  return allowlist.includes(origin);
}
