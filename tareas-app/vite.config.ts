/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Configuración de Vite: React, Tailwind CSS y Vitest para las pruebas.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Pruebas de la lógica y de componentes en un entorno de navegador simulado.
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/configuracion-pruebas.ts'],
  },
})
