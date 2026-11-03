// Ruta /state de sync-api: el contrato completo del servicio son estos dos verbos.
// GET  /state → lo último que esta persona guardó en la nube (o 204 si nunca guardó nada).
// PUT  /state → reemplaza lo guardado con el estado que manda el cliente (last-write-wins).
import { Router } from 'express';
import { verifyAccessToken } from '../lib/cognito-jwt.js';
import { getState, putState } from '../lib/sync-store.js';

// Límite defensivo de tamaño: cualquier app real de este tipo está muy por debajo. Evita que
// un cliente con un bug (o malicioso, aunque ya autenticado) escriba un ítem desproporcionado.
const MAX_ITEMS = 2000;

/**
 * Lee el access token del header Authorization (`Bearer <token>`).
 *
 * @param {import('express').Request} req
 * @returns {string} el token, o '' si no viene en el formato esperado.
 */
function readBearerToken(req) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

/**
 * Valida el Bearer token de la petición y responde 401 si falta o no es válido.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<string | null>} el `sub` validado, o `null` si ya se respondió con 401.
 */
async function requireSub(req, res) {
  const token = readBearerToken(req);
  if (token === '') {
    res.status(401).json({ error: 'falta_token' });
    return null;
  }
  try {
    return await verifyAccessToken(token);
  } catch {
    res.status(401).json({ error: 'token_invalido' });
    return null;
  }
}

/**
 * Forma mínima válida del estado que el cliente puede pushear: el mismo shape que
 * `exercise/src/core/store.js` persiste (`tasks`, `rounds`, `timer`, `settings`).
 *
 * @param {unknown} body
 * @returns {boolean}
 */
function isValidStatePayload(body) {
  return Boolean(body) && typeof body === 'object' &&
    Array.isArray(body.tasks) && body.tasks.length <= MAX_ITEMS &&
    Array.isArray(body.rounds) && body.rounds.length <= MAX_ITEMS &&
    Boolean(body.timer) && typeof body.timer === 'object' &&
    Boolean(body.settings) && typeof body.settings === 'object';
}

export function createStateRouter() {
  const router = Router();

  router.get('/state', async (req, res, next) => {
    try {
      const sub = await requireSub(req, res);
      if (sub === null) return;
      const state = await getState(sub);
      if (!state) {
        res.status(204).end();
        return;
      }
      res.json(state);
    } catch (error) {
      next(error);
    }
  });

  router.put('/state', async (req, res, next) => {
    try {
      const sub = await requireSub(req, res);
      if (sub === null) return;
      if (!isValidStatePayload(req.body)) {
        res.status(413).json({ error: 'payload_invalido' });
        return;
      }
      // El reloj del servidor es la fuente de verdad de "cuándo se guardó", no el del cliente
      // (cuyo reloj puede estar desfasado): el valor que venga en el cuerpo se ignora.
      const { tasks, rounds, timer, settings } = req.body;
      const updatedAt = Date.now();
      await putState(sub, { tasks, rounds, timer, settings, updatedAt });
      res.json({ updatedAt });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
