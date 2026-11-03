import { defineConfig } from 'vitest/config';

// jsdom da `window`, `document`, `location` y `localStorage` reales: core/store.js y
// core/auth.js los tocan al cargarse (p. ej. `window.__store`, `location.origin`), así que
// usarlo evita tener que stubbear esas globals a mano en cada prueba.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
    // 'tone' no declara extensiones en algunos imports internos; Node ESM puro no los resuelve,
    // pero el transform de Vite sí. Al "inline"-arlo, Vitest lo procesa con ese transform en vez
    // de dejarlo como import nativo de Node. Necesario para probar módulos que, en cadena,
    // importan vistas que tocan audio (p. ej. app-shell.js -> settings-view.js -> lofi.js).
    server: { deps: { inline: ['tone'] } },
  },
});
