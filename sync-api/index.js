// Punto de entrada para Lambda Web Functions. El empaquetado de `aws lambda-web deploy` busca
// "index.js" como entrada preferida (vía el campo "main" de package.json); si no lo encuentra,
// genera su propio wrapper que hace `import './server.js'`, y entonces `import.meta.main`
// dentro de server.js da false (el módulo principal real es ese wrapper, no server.js), así
// que el server nunca llama a start() y Lambda nunca encuentra un servidor escuchando (mismo
// problema ya resuelto así en oidc-bridge/index.js). El desarrollo local (`npm start`,
// `npm run dev`) sigue usando server.js directamente, sin pasar por aquí.
import { start } from './server.js';

start();
