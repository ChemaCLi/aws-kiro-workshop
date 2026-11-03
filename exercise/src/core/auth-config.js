// Configuración PÚBLICA de la autenticación con Amazon Cognito.
// Responsabilidad: concentrar los valores que el frontend puede exponer sin riesgo
// (IDs, dominios, redirect, scopes y proveedores). Nunca contiene secretos: ni client
// secret, ni secreto de GitHub, ni secreto del App Client de Cognito. Esos viven en el
// puente OIDC o en AWS, nunca en el navegador. La Propiedad 6 fija esta forma.
//
// Los valores reales se inyectan en build-time con variables PUBLIC_* (ver
// exercise/.env.example), que es justo lo que motivó migrar a Astro: ver
// docs/decisions/0001-migrar-a-astro.md. Sin un .env, cada uno cae a un placeholder de
// ejemplo para que `npm run dev`/`npm run build` sigan funcionando sin infraestructura real
// (la cuenta queda deshabilitada o falla con un backend que no existe, pero el resto de la
// app no se ve afectada).
//
// El `issuer` esperado del ID token se DERIVA de `region` y `userPoolId`
// (`https://cognito-idp.{region}.amazonaws.com/{userPoolId}`); no se guarda aparte.

export const AUTH_CONFIG = {
  userPoolId: import.meta.env.PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
  clientId: import.meta.env.PUBLIC_COGNITO_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx', // App Client público, sin secreto
  region: 'us-east-1',
  cognitoDomain: import.meta.env.PUBLIC_COGNITO_DOMAIN || 'https://focus-garden.auth.us-east-1.amazoncognito.com',
  redirectUri: `${location.origin}/app.html`, // debe estar declarada en el App Client
  scopes: ['openid', 'email', 'profile'],
  providers: {
    // identity_provider tal como lo nombra Cognito
    Google: 'Google',
    Meta: 'Facebook',
    Amazon: 'LoginWithAmazon',
    GitHub: 'GitHubBridge',
  },
  oidcBridgeEndpoint: import.meta.env.PUBLIC_OIDC_BRIDGE_ENDPOINT || 'https://oidc-bridge.example.com',
  syncApiEndpoint: import.meta.env.PUBLIC_SYNC_API_ENDPOINT || 'https://sync-api.example.com',
};
