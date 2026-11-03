// Pruebas del router de live-sync-api con dobles en memoria de DynamoDB y de la API de
// administración de conexiones (ApiGatewayManagementApi). No se prueba el authorizer aquí (ver
// authorizer.test.js): estos eventos ya traen `requestContext.authorizer.sub`, como los
// entregaría API Gateway después de que el authorizer corrió.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setDynamoClient } from '../lib/dynamo.js';
import { setApiGatewayClient } from '../lib/apigw.js';
import { handler } from '../router.js';

const CONNECTIONS_TABLE = 'focus-garden-connections';
const LIVE_TIMER_TABLE = 'focus-garden-live-timer';

process.env.CONNECTIONS_TABLE_NAME = CONNECTIONS_TABLE;
process.env.LIVE_TIMER_TABLE_NAME = LIVE_TIMER_TABLE;

function failConditional() {
  const error = new Error('ConditionalCheckFailedException');
  error.name = 'ConditionalCheckFailedException';
  throw error;
}

/**
 * Doble en memoria de DynamoDB que entiende las dos tablas y las dos condiciones exactas que
 * usa `lib/dynamo.js` (attribute_not_exists y masterConnectionId = :previous). Igual que los
 * demás dobles del proyecto (`setCodeStoreClient`, `setSyncStoreClient`): solo cubre los
 * comandos que el código real emite.
 */
function makeFakeDynamoClient() {
  const tables = { [CONNECTIONS_TABLE]: new Map(), [LIVE_TIMER_TABLE]: new Map() };
  const keyOf = (tableName, obj) => (tableName === CONNECTIONS_TABLE ? obj.connectionId : obj.sub);

  return {
    tables,
    async send(command) {
      const kind = command.constructor.name;
      const input = command.input;
      const table = tables[input.TableName];
      if (!table) throw new Error(`Tabla no reconocida en el doble: ${input.TableName}`);

      if (kind === 'PutCommand') {
        const key = keyOf(input.TableName, input.Item);
        const existing = table.get(key);
        if (input.ConditionExpression === 'attribute_not_exists(sub)' && existing) failConditional();
        if (input.ConditionExpression === 'masterConnectionId = :previous') {
          const expected = input.ExpressionAttributeValues[':previous'];
          if ((existing?.masterConnectionId ?? null) !== expected) failConditional();
        }
        table.set(key, input.Item);
        return {};
      }
      if (kind === 'GetCommand') {
        return { Item: table.get(keyOf(input.TableName, input.Key)) };
      }
      if (kind === 'DeleteCommand') {
        const key = keyOf(input.TableName, input.Key);
        const item = table.get(key);
        table.delete(key);
        return { Attributes: item ?? undefined };
      }
      if (kind === 'QueryCommand') {
        const sub = input.ExpressionAttributeValues[':sub'];
        return { Items: [...table.values()].filter((item) => item.sub === sub) };
      }
      if (kind === 'UpdateCommand') {
        const key = input.Key.sub;
        const existing = table.get(key) || { sub: key };
        table.set(key, { ...existing, timer: input.ExpressionAttributeValues[':timer'], updatedAt: input.ExpressionAttributeValues[':now'] });
        return {};
      }
      throw new Error(`Comando no soportado en el doble: ${kind}`);
    },
  };
}

function makeFakeApiGatewayClient() {
  const sent = [];
  return {
    sent,
    async send(command) {
      const kind = command.constructor.name;
      if (kind === 'PostToConnectionCommand') {
        sent.push({ connectionId: command.input.ConnectionId, message: JSON.parse(Buffer.from(command.input.Data).toString()) });
        return {};
      }
      if (kind === 'DeleteConnectionCommand') return {};
      throw new Error(`Comando no soportado en el doble: ${kind}`);
    },
  };
}

let dynamo;
let apigw;

beforeEach(() => {
  dynamo = makeFakeDynamoClient();
  apigw = makeFakeApiGatewayClient();
  setDynamoClient(dynamo);
  setApiGatewayClient(apigw);
});

const connectEvent = (connectionId, sub, deviceId = 'dispositivo-1') => ({
  requestContext: { routeKey: '$connect', connectionId, authorizer: { sub } },
  queryStringParameters: { deviceId },
});
const disconnectEvent = (connectionId) => ({ requestContext: { routeKey: '$disconnect', connectionId } });
const actionEvent = (connectionId, action, payload = {}) => ({
  requestContext: { routeKey: action, connectionId },
  body: JSON.stringify({ action, ...payload }),
});

const SAMPLE_TIMER = { taskId: 't-1', status: 'running', totalMs: 1500000, remainingMs: 1500000, endsAt: Date.now() + 1500000 };

test('$connect: la primera conexión de una persona queda como master', async () => {
  await handler(connectEvent('conn-a', 'persona-1'));
  assert.deepEqual(apigw.sent, [{ connectionId: 'conn-a', message: { type: 'init', role: 'master' } }]);
  assert.equal(dynamo.tables[LIVE_TIMER_TABLE].get('persona-1').masterConnectionId, 'conn-a');
});

test('$connect: una segunda conexión de la misma persona queda como slave y recibe el último timer', async () => {
  await handler(connectEvent('conn-a', 'persona-1'));
  await handler(actionEvent('conn-a', 'state-update', { timer: SAMPLE_TIMER }));
  apigw.sent.length = 0;

  await handler(connectEvent('conn-b', 'persona-1'));
  assert.deepEqual(apigw.sent, [{ connectionId: 'conn-b', message: { type: 'init', role: 'slave', timer: SAMPLE_TIMER } }]);
});

test('personas distintas nunca interfieren entre sí', async () => {
  await handler(connectEvent('conn-a', 'persona-1'));
  await handler(connectEvent('conn-b', 'persona-2'));
  assert.equal(apigw.sent.find((m) => m.connectionId === 'conn-b').message.role, 'master');
});

test('state-update: se transmite a las demás conexiones de la persona, nunca a la propia', async () => {
  await handler(connectEvent('conn-a', 'persona-1')); // master
  await handler(connectEvent('conn-b', 'persona-1')); // slave
  await handler(connectEvent('conn-c', 'persona-1')); // slave
  apigw.sent.length = 0;

  await handler(actionEvent('conn-a', 'state-update', { timer: SAMPLE_TIMER }));

  assert.deepEqual(
    apigw.sent.sort((a, b) => a.connectionId.localeCompare(b.connectionId)),
    [
      { connectionId: 'conn-b', message: { type: 'state-update', timer: SAMPLE_TIMER } },
      { connectionId: 'conn-c', message: { type: 'state-update', timer: SAMPLE_TIMER } },
    ],
  );
  assert.deepEqual(dynamo.tables[LIVE_TIMER_TABLE].get('persona-1').timer, SAMPLE_TIMER);
});

test('state-update: se ignora en silencio si no viene del master registrado', async () => {
  await handler(connectEvent('conn-a', 'persona-1')); // master
  await handler(connectEvent('conn-b', 'persona-1')); // slave
  apigw.sent.length = 0;

  const result = await handler(actionEvent('conn-b', 'state-update', { timer: SAMPLE_TIMER }));

  assert.equal(result.statusCode, 200);
  assert.deepEqual(apigw.sent, []); // nadie recibe nada
  assert.equal(dynamo.tables[LIVE_TIMER_TABLE].get('persona-1').timer, null); // no se corrompió el estado
});

test('$disconnect: si el que se va era el master, transmite master-disconnected a los demás', async () => {
  await handler(connectEvent('conn-a', 'persona-1')); // master
  await handler(connectEvent('conn-b', 'persona-1')); // slave
  apigw.sent.length = 0;

  await handler(disconnectEvent('conn-a'));

  assert.deepEqual(apigw.sent, [{ connectionId: 'conn-b', message: { type: 'master-disconnected' } }]);
  assert.equal(dynamo.tables[CONNECTIONS_TABLE].has('conn-a'), false);
});

test('$disconnect: si el que se va NO era el master, no transmite nada', async () => {
  await handler(connectEvent('conn-a', 'persona-1')); // master
  await handler(connectEvent('conn-b', 'persona-1')); // slave
  apigw.sent.length = 0;

  await handler(disconnectEvent('conn-b'));

  assert.deepEqual(apigw.sent, []);
});

test('claim-master: un slave puede reclamar si el master anterior ya no está conectado (huérfano)', async () => {
  await handler(connectEvent('conn-a', 'persona-1')); // master
  await handler(connectEvent('conn-b', 'persona-1')); // slave
  await handler(disconnectEvent('conn-a')); // el master se cae sin que conn-b reclame todavía
  apigw.sent.length = 0;

  await handler(actionEvent('conn-b', 'claim-master'));

  assert.deepEqual(apigw.sent, [{ connectionId: 'conn-b', message: { type: 'claim-master-result', success: true } }]);
  assert.equal(dynamo.tables[LIVE_TIMER_TABLE].get('persona-1').masterConnectionId, 'conn-b');
});

test('claim-master: falla si el master registrado sigue conectado de verdad', async () => {
  await handler(connectEvent('conn-a', 'persona-1')); // master, sigue conectado
  await handler(connectEvent('conn-b', 'persona-1')); // slave
  apigw.sent.length = 0;

  await handler(actionEvent('conn-b', 'claim-master'));

  assert.deepEqual(apigw.sent, [{ connectionId: 'conn-b', message: { type: 'claim-master-result', success: false } }]);
  assert.equal(dynamo.tables[LIVE_TIMER_TABLE].get('persona-1').masterConnectionId, 'conn-a');
});

test('ping y una acción desconocida son no-op (200, sin transmitir nada)', async () => {
  await handler(connectEvent('conn-a', 'persona-1'));
  apigw.sent.length = 0;

  const pingResult = await handler(actionEvent('conn-a', 'ping'));
  const unknownResult = await handler(actionEvent('conn-a', 'algo-que-no-existe'));

  assert.equal(pingResult.statusCode, 200);
  assert.equal(unknownResult.statusCode, 200);
  assert.deepEqual(apigw.sent, []);
});
