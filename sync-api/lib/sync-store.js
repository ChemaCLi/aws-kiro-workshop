// Almacén del progreso sincronizado, en DynamoDB. Un ítem por persona (clave `sub`, el id
// estable de Cognito), con el mismo shape que el store del frontend: tasks, rounds, timer,
// settings, updatedAt. A diferencia del code-store de oidc-bridge (efímero, con TTL), esto es
// dato durable: no tiene TTL.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

let documentClient = null;

function getClient() {
  documentClient ??= DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return documentClient;
}

/**
 * Sustituye el cliente de DynamoDB (un doble en memoria en las pruebas), igual que
 * `setCodeStoreClient` en oidc-bridge. Nunca se llama en producción: ahí `getClient()` crea el
 * cliente real en el primer uso.
 *
 * @param {{ send: (command: unknown) => Promise<unknown> }} client
 */
export function setSyncStoreClient(client) {
  documentClient = client;
}

function tableName() {
  return process.env.SYNC_TABLE_NAME || 'focus-garden-cloud-sync';
}

/**
 * Lee el estado guardado de una persona. `null` si todavía no tiene nada guardado.
 *
 * @param {string} sub el id estable de Cognito.
 * @returns {Promise<{ tasks: unknown[], rounds: unknown[], timer: object, settings: object, updatedAt: number } | null>}
 */
export async function getState(sub) {
  const result = await getClient().send(new GetCommand({ TableName: tableName(), Key: { sub } }));
  if (!result.Item) return null;
  const { sub: _sub, ...state } = result.Item;
  return state;
}

/**
 * Reemplaza el estado guardado de una persona (last-write-wins: sin lectura previa ni
 * condición, el cliente ya decidió que le toca pushear antes de llamar aquí).
 *
 * @param {string} sub el id estable de Cognito.
 * @param {{ tasks: unknown[], rounds: unknown[], timer: object, settings: object, updatedAt: number }} state
 */
export async function putState(sub, state) {
  await getClient().send(new PutCommand({ TableName: tableName(), Item: { sub, ...state } }));
}
