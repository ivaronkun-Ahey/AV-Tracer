import { defineConfig, devices } from '@playwright/test';

/**
 * Браузерные смоук-тесты: собранное приложение в режиме предпросмотра
 * с теми же заголовками безопасности (CSP), что и в продакшене.
 *   npm run test:e2e
 * Проверка уже запущенного сервера (например, продакшен-образа):
 *   E2E_BASE_URL=http://localhost:8080 npm run test:e2e
 */
const externalUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    baseURL: externalUrl ?? 'http://localhost:4173',
    viewport: { width: 1600, height: 900 },
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } } }],
  webServer: externalUrl
    ? undefined
    : {
        command: 'npm run build && npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
