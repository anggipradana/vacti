import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `next dev apps/web -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    cwd: process.cwd(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://vacti:vacti@localhost:5432/vacti_e2e',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? '',
      SESSION_SECRET: process.env.SESSION_SECRET ?? '',
      NODE_ENV: 'development',
    },
  },
});
