// Almacén de los authorization code efímeros del puente, en DynamoDB.
// Entre `/callback` (donde el puente ya conoce la identidad de GitHub) y `/token` (donde
// Cognito canjea el code por el ID token firmado) hay que recordar a qué identidad
// corresponde cada code. No puede vivir en memoria del proceso: en Lambda cada entorno de
// ejecución tiene su propia memoria, y `/callback` y `/token` pueden caer en instancias
// distintas de la función. DynamoDB es la única fuente compartida entre todas.
//
// Decisión de seguridad (la misma de siempre): el code es aleatorio y largo, se borra en el
// primer canje (un solo uso, con un DeleteItem que además devuelve el valor borrado en la
// misma operación atómica) y caduca a los pocos minutos aunque nadie lo canjee. El atributo
// TTL de DynamoDB limpia los que nadie canjeó, pero no es instantáneo (puede tardar hasta
// 48 h en efectuarse), así que `consumeCode` igual valida `expiresAt` a mano, sin confiar
// solo en el TTL.

import { randomBytes } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// Vida del code antes de caducar por tiempo. Corta: Cognito canjea de inmediato.
const CODE_TTL_MS = 5 * 60 * 1000;

let documentClient = null;

function getClient() {
  documentClient ??= DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return documentClient;
}

/**
 * Sustituye el cliente de DynamoDB (por ejemplo, por un doble en memoria en las pruebas, que
 * mockean todo lo externo igual que ya hace `test/server.test.js` con `fetch` de GitHub).
 * Nunca se llama en producción: ahí `getClient()` crea el cliente real en el primer uso.
 *
 * @param {{ send: (command: unknown) => Promise<unknown> }} client
 */
export function setCodeStoreClient(client) {
  documentClient = client;
}

function tableName() {
  return process.env.CODE_STORE_TABLE_NAME || 'focus-garden-oidc-bridge-codes';
}

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
 * El code queda asociado a la identidad y a la redirect_uri del cliente, con un instante de
 * caducidad (`expiresAt`, epoch ms, para la validación exacta) y el atributo `ttl` (epoch
 * segundos, el formato que exige DynamoDB) para el borrado automático de respaldo. Es lo que
 * `/callback` entrega a Cognito.
 *
 * @param {Object} identity - Identidad normalizada de GitHub (sub, email, ...).
 * @param {string} [redirectUri] - La redirect_uri del cliente, si se necesita validar.
 * @returns {Promise<string>} El authorization code efímero.
 */
export async function issueCode(identity, redirectUri) {
  const code = generateCode();
  const expiresAt = Date.now() + CODE_TTL_MS;
  await getClient().send(new PutCommand({
    TableName: tableName(),
    Item: {
      code,
      identity,
      redirectUri: redirectUri ?? null,
      expiresAt,
      ttl: Math.floor(expiresAt / 1000),
    },
  }));
  return code;
}

/**
 * Canjea un code: devuelve su identidad y lo invalida (un solo uso).
 * Si el code no existe o ya caducó, devuelve null para que `/token` responda con un error de
 * grant inválido. El DeleteItem con `ReturnValues: 'ALL_OLD'` borra y lee en una sola
 * operación atómica, así que un segundo canje del mismo code ya no encuentra nada.
 *
 * @param {string} code - El code que Cognito presenta en `/token`.
 * @returns {Promise<{ identity: Object, redirectUri?: string } | null>}
 */
export async function consumeCode(code) {
  if (typeof code !== 'string' || code === '') return null;
  const result = await getClient().send(new DeleteCommand({
    TableName: tableName(),
    Key: { code },
    ReturnValues: 'ALL_OLD',
  }));
  const entry = result.Attributes;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) return null;
  return { identity: entry.identity, redirectUri: entry.redirectUri ?? undefined };
}
