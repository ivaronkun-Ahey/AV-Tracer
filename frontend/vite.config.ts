import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import securityHeaders from './securityHeaders.json';

// Адрес backend по умолчанию; переопределяется переменной BACKEND_URL.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Dev-сервер слушает только localhost. В Docker адрес задаётся явно
    // (npm run dev -- --host), чтобы сервер разработки не открывался в сеть случайно.
    // Запросы /api/* проксируются на backend (заготовка для будущих функций:
    // проекты, учётные записи, ИИ). Симуляция в сервере не нуждается.
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
  // Предпросмотр сборки — с теми же заголовками безопасности, что и в nginx
  // (frontend/nginx.conf): браузерные тесты проверяют приложение под этой политикой.
  preview: {
    port: 4173,
    headers: securityHeaders,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
