import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Адрес backend по умолчанию; переопределяется переменной BACKEND_URL.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    // Запросы /api/* проксируются на backend (заготовка для будущих функций:
    // проекты, учётные записи, ИИ). Симуляция в сервере не нуждается.
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
