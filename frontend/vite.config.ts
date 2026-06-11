import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Адрес backend по умолчанию; переопределяется переменной BACKEND_URL.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    // Запросы /api/* проксируются на Python backend — фронтенду не нужно
    // знать его адрес и не возникает проблем с CORS.
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
