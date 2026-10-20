import { defineConfig, devices } from '@playwright/test';
import { DB_FILE } from './e2e/global-setup';

const DATABASE_URL = `file:${DB_FILE}`;

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev --prefix server',
      url: 'http://localhost:3000/api/health',
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        DATABASE_URL,
        PORT: '3000',
        JWT_SECRET: 'e2e-secret',
      },
    },
    {
      command: 'npm run dev --prefix client',
      url: 'http://localhost:5173',
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
