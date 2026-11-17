import { defineConfig, devices } from '@playwright/test';
import { env } from './e2e/config/env';
import { DB_FILE } from './e2e/global-setup';

const DATABASE_URL = `file:${DB_FILE}`;

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/global-setup.ts',
  // Un solo worker: API, frontend y SQLite son compartidos por toda la suite (ver ADR-001 §2.9).
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'results/junit.xml' }]],
  use: {
    baseURL: env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // BUG-03 solo se ve al oeste de UTC: navegador y servidor en America/Montevideo.
      use: { ...devices['Desktop Chrome'], timezoneId: env.TIMEZONE },
    },
  ],
  webServer: [
    {
      command: 'npm run dev --prefix server',
      url: `${env.API_URL}/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL,
        PORT: '3000',
        JWT_SECRET: 'e2e-secret',
        TZ: env.TIMEZONE,
      },
    },
    {
      command: 'npm run dev --prefix client',
      url: env.BASE_URL,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
