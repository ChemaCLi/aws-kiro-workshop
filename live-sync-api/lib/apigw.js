// Envía mensajes a conexiones WebSocket abiertas, vía la API de administración de conexiones
// de API Gateway (`@aws-sdk/client-apigatewaymanagementapi`). El endpoint no es el `wss://` al
// que se conecta el navegador: es `https://{api-id}.execute-api.{region}.amazonaws.com/{stage}`,
// fijado en APIGW_MANAGEMENT_ENDPOINT al desplegar (solo se conoce una vez creada la API).

import { ApiGatewayManagementApiClient, PostToConnectionCommand, DeleteConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

let managementClient = null;

function getClient() {
  managementClient ??= new ApiGatewayManagementApiClient({ endpoint: process.env.APIGW_MANAGEMENT_ENDPOINT });
  return managementClient;
}

/** Sustituye el cliente de administración de conexiones (un doble en memoria en las pruebas). */
export function setApiGatewayClient(client) {
  managementClient = client;
}

/**
 * Manda un mensaje JSON a una conexión. Si la conexión ya se cerró del lado del cliente
 * (`GoneException`, HTTP 410), se ignora en silencio: se limpiará en el próximo `$disconnect`
 * real o, como respaldo, cuando expire su TTL en `focus-garden-connections`.
 *
 * @param {string} connectionId
 * @param {object} data el mensaje, se manda como `JSON.stringify(data)`.
 */
export async function postToConnection(connectionId, data) {
  try {
    await getClient().send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(data)),
    }));
  } catch (error) {
    if (error?.name === 'GoneException' || error?.$metadata?.httpStatusCode === 410) return;
    throw error;
  }
}

/** Fuerza el cierre de una conexión (para cuando exista el cierre remoto de "Mis sesiones"). */
export async function closeConnection(connectionId) {
  try {
    await getClient().send(new DeleteConnectionCommand({ ConnectionId: connectionId }));
  } catch (error) {
    if (error?.name === 'GoneException' || error?.$metadata?.httpStatusCode === 410) return;
    throw error;
  }
}
