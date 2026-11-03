// Lambda que maneja TODAS las rutas del WebSocket: $connect, $disconnect, $default y las
// rutas propias (state-update, claim-master, ping). Una sola función, despachando por
// `event.requestContext.routeKey`, en vez de una función por ruta — el volumen de cada una no
// justifica separarlas y así comparten los mismos imports fríos.
import { claimMaster, deleteConnection, getConnection, getLiveTimer, listConnectionsForSub, putConnection, updateLiveTimer } from './lib/dynamo.js';
import { postToConnection } from './lib/apigw.js';

const OK = { statusCode: 200, body: '' };

/** $connect: registra la conexión y decide si queda como master o como slave. */
async function handleConnect(event, connectionId) {
  const sub = event.requestContext.authorizer?.sub;
  if (!sub) return { statusCode: 401, body: 'falta sub' }; // no debería pasar: el authorizer ya lo exige
  const deviceId = event.queryStringParameters?.deviceId || 'desconocido';

  await putConnection({ connectionId, sub, deviceId });
  const isMaster = await claimMaster({ sub, connectionId });

  if (isMaster) {
    await postToConnection(connectionId, { type: 'init', role: 'master' });
  } else {
    const live = await getLiveTimer(sub);
    await postToConnection(connectionId, { type: 'init', role: 'slave', timer: live?.timer ?? null });
  }
  return OK;
}

/** $disconnect: limpia la conexión y, si era la master, avisa a quien quede para que pueda reanudar. */
async function handleDisconnect(connectionId) {
  const deleted = await deleteConnection(connectionId);
  if (!deleted) return OK;

  const live = await getLiveTimer(deleted.sub);
  if (live?.masterConnectionId !== connectionId) return OK; // no era la master: nada más que hacer

  const remaining = await listConnectionsForSub(deleted.sub);
  await Promise.all(remaining.map((c) => postToConnection(c.connectionId, { type: 'master-disconnected' })));
  return OK;
}

/** Transmite el timer SOLO si quien lo manda es el master registrado ahora mismo para su `sub`. */
async function handleStateUpdate(connectionId, timer) {
  const connection = await getConnection(connectionId);
  if (!connection) return OK;
  const live = await getLiveTimer(connection.sub);
  if (live?.masterConnectionId !== connectionId) return OK; // no es el master: se ignora, sin error

  await updateLiveTimer({ sub: connection.sub, timer });
  const others = (await listConnectionsForSub(connection.sub)).filter((c) => c.connectionId !== connectionId);
  await Promise.all(others.map((c) => postToConnection(c.connectionId, { type: 'state-update', timer })));
  return OK;
}

/** Intenta reclamar el rol de master (p. ej. tras aceptar "¿quieres reanudar?") y avisa el resultado. */
async function handleClaimMaster(connectionId) {
  const connection = await getConnection(connectionId);
  if (!connection) return OK;
  const success = await claimMaster({ sub: connection.sub, connectionId });
  await postToConnection(connectionId, { type: 'claim-master-result', success });
  return OK;
}

export async function handler(event) {
  const routeKey = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId;

  if (routeKey === '$connect') return handleConnect(event, connectionId);
  if (routeKey === '$disconnect') return handleDisconnect(connectionId);

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return OK; // cuerpo que no es JSON: se ignora, no rompe la conexión
  }

  if (body.action === 'state-update') return handleStateUpdate(connectionId, body.timer);
  if (body.action === 'claim-master') return handleClaimMaster(connectionId);
  // 'ping' y cualquier acción desconocida: no-op. Recibir el mensaje ya resetea el timeout de
  // inactividad de API Gateway (10 min), que es todo lo que 'ping' necesita lograr.
  return OK;
}
