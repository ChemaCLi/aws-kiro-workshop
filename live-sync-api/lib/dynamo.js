// Acceso a las dos tablas de live-sync-api.
//
// `focus-garden-connections` (PK connectionId, GSI sub-index por sub): una fila por conexión
// WebSocket abierta ahora mismo. TTL a 2 h (el máximo de duración de una conexión de API
// Gateway) para limpiar huérfanas si se pierde $disconnect.
//
// `focus-garden-live-timer` (PK sub): un ítem por persona con quién es su dispositivo master
// ahora mismo (`masterConnectionId`) y el último `timer` que ese master mandó. Sin TTL: se
// sobrescribe, no expira (si nadie está conectado simplemente no se actualiza más).

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const CONNECTION_TTL_SECONDS = 2 * 60 * 60; // 2 h: el máximo de duración de una conexión de API Gateway

let documentClient = null;

function getClient() {
  documentClient ??= DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return documentClient;
}

/** Sustituye el cliente de DynamoDB (un doble en memoria en las pruebas). */
export function setDynamoClient(client) {
  documentClient = client;
}

function connectionsTable() {
  return process.env.CONNECTIONS_TABLE_NAME || 'focus-garden-connections';
}

function liveTimerTable() {
  return process.env.LIVE_TIMER_TABLE_NAME || 'focus-garden-live-timer';
}

function isConditionalCheckFailed(error) {
  return error?.name === 'ConditionalCheckFailedException';
}

export async function putConnection({ connectionId, sub, deviceId }) {
  await getClient().send(new PutCommand({
    TableName: connectionsTable(),
    Item: { connectionId, sub, deviceId, connectedAt: Date.now(), ttl: Math.floor(Date.now() / 1000) + CONNECTION_TTL_SECONDS },
  }));
}

/** Borra la conexión y devuelve el ítem borrado (o null si no existía), para saber su `sub`. */
export async function deleteConnection(connectionId) {
  const result = await getClient().send(new DeleteCommand({
    TableName: connectionsTable(),
    Key: { connectionId },
    ReturnValues: 'ALL_OLD',
  }));
  return result.Attributes ?? null;
}

export async function getConnection(connectionId) {
  const result = await getClient().send(new GetCommand({ TableName: connectionsTable(), Key: { connectionId } }));
  return result.Item ?? null;
}

/** Todas las conexiones abiertas ahora mismo para una persona (para transmitir o para elegir master). */
export async function listConnectionsForSub(sub) {
  const result = await getClient().send(new QueryCommand({
    TableName: connectionsTable(),
    IndexName: 'sub-index',
    KeyConditionExpression: 'sub = :sub',
    ExpressionAttributeValues: { ':sub': sub },
  }));
  return result.Items ?? [];
}

export async function getLiveTimer(sub) {
  const result = await getClient().send(new GetCommand({ TableName: liveTimerTable(), Key: { sub } }));
  return result.Item ?? null;
}

/**
 * Intenta que `connectionId` se convierta en el master de `sub`. Tiene éxito si:
 *   - nadie es master todavía para esta persona, o
 *   - quien figura como master ya no tiene una conexión abierta (huérfano: se perdió su
 *     $disconnect, o el TTL todavía no lo limpió).
 * Es un "último en reclamar gana" con una condición atómica en cada escritura, para que dos
 * reclamos simultáneos nunca dejen el ítem en un estado inconsistente (uno de los dos pierde la
 * condición y recibe `false`).
 *
 * @param {{ sub: string, connectionId: string }} args
 * @returns {Promise<boolean>} true si esta conexión quedó como master.
 */
export async function claimMaster({ sub, connectionId }) {
  const now = Date.now();
  try {
    await getClient().send(new PutCommand({
      TableName: liveTimerTable(),
      Item: { sub, masterConnectionId: connectionId, timer: null, updatedAt: now },
      ConditionExpression: 'attribute_not_exists(sub)',
    }));
    return true;
  } catch (error) {
    if (!isConditionalCheckFailed(error)) throw error;
  }

  const existing = await getLiveTimer(sub);
  const previousMaster = existing?.masterConnectionId ?? null;
  if (previousMaster) {
    const stillConnected = await getConnection(previousMaster);
    if (stillConnected) return false; // hay un master vivo de verdad: no se reclama
  }

  try {
    await getClient().send(new PutCommand({
      TableName: liveTimerTable(),
      Item: { sub, masterConnectionId: connectionId, timer: existing?.timer ?? null, updatedAt: now },
      ConditionExpression: 'masterConnectionId = :previous',
      ExpressionAttributeValues: { ':previous': previousMaster },
    }));
    return true;
  } catch (error) {
    if (isConditionalCheckFailed(error)) return false; // alguien más ganó la carrera justo antes
    throw error;
  }
}

/** Actualiza el timer conocido de una persona. Quien llama ya validó que es el master registrado. */
export async function updateLiveTimer({ sub, timer }) {
  await getClient().send(new UpdateCommand({
    TableName: liveTimerTable(),
    Key: { sub },
    UpdateExpression: 'SET #timer = :timer, updatedAt = :now',
    ExpressionAttributeNames: { '#timer': 'timer' },
    ExpressionAttributeValues: { ':timer': timer, ':now': Date.now() },
  }));
}
