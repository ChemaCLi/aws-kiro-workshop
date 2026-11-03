import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Sitio estático: igual que hoy, se publican archivos (ver skill deploy-to-aws).
export default defineConfig({
  output: 'static',
  // 'file' conserva las URLs de hoy (index.html, app.html) en vez de index/ y app/:
  // el redirectUri de Cognito en auth-config.js apunta a /app.html y no debe cambiar.
  build: { format: 'file' },
  vite: {
    plugins: [tailwindcss()],
  },
});
