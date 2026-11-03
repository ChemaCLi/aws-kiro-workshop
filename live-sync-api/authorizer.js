// Lambda authorizer (REQUEST) de la ruta $connect. El navegador no puede mandar cabeceras
// propias al abrir un WebSocket, así que el access token viaja en la query string
// (?token=...); este es el único punto donde se valida — los mensajes posteriores en la misma
// conexión ya no pasan por un authorizer, por eso router.js identifica al remitente por su
// `connectionId` guardado en DynamoDB en $connect, no por un token en cada mensaje.
import { verifyAccessToken } from './lib/cognito-jwt.js';

/**
 * @param {{ methodArn: string, queryStringParameters?: Record<string,string> }} event
 * @returns {Promise<{ principalId: string, policyDocument: object, context: { sub: string } }>}
 */
export async function handler(event) {
  const token = event.queryStringParameters?.token;
  if (!token) throw new Error('Unauthorized'); // API Gateway traduce este mensaje exacto a 401

  let sub;
  try {
    sub = await verifyAccessToken(token);
  } catch {
    throw new Error('Unauthorized');
  }

  return {
    principalId: sub,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{ Action: 'execute-api:Invoke', Effect: 'Allow', Resource: event.methodArn }],
    },
    // Queda disponible como event.requestContext.authorizer.sub en el handler de $connect.
    context: { sub },
  };
}
