// Configuración PÚBLICA de la autenticación con Amazon Cognito.
// Responsabilidad: concentrar los valores que el frontend puede exponer sin riesgo
// (IDs, dominios, redirect, scopes y proveedores). Nunca contiene secretos: ni client
// secret, ni secreto de GitHub, ni secreto del App Client de Cognito. Esos viven en el
// puente OIDC o en AWS, nunca en el navegador. La Propiedad 6 fija esta forma.
//
// Los valores de abajo son placeholders de ejemplo; los reales se configuran a mano en
// Amazon Cognito y en el despliegue del puente, no en el código.
//
// El `issuer` esperado del ID token se DERIVA de `region` y `userPoolId`
// (`https://cognito-idp.{region}.amazonaws.com/{userPoolId}`); no se guarda aparte.

export const AUTH_CONFIG = {
  userPoolId: 'us-east-1_XXXXXXXXX',
  clientId: 'xxxxxxxxxxxxxxxxxxxxxxxxxx', // App Client público, sin secreto
  region: 'us-east-1',
  cognitoDomain: 'https://focus-garden.auth.us-east-1.amazoncognito.com',
  redirectUri: `${location.origin}/app.html`, // debe estar declarada en el App Client
  scopes: ['openid', 'email', 'profile'],
  providers: {
    // identity_provider tal como lo nombra Cognito
    Google: 'Google',
    Meta: 'Facebook',
    Amazon: 'LoginWithAmazon',
    GitHub: 'GitHubBridge',
  },
  oidcBridgeEndpoint: 'https://oidc-bridge.example.com', // solo el endpoint público del puente
};
