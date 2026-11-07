import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration for AOA 77 Document Management System
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  workers: 1, // Sequential execution prevents concurrent database collisions
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 25 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: [
    {
      command: 'node dist/src/main.js',
      cwd: './backend',
      url: 'http://127.0.0.1:3000/api/v1/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'test',
        PORT: '3000',
        API_PREFIX: 'api/v1',
      },
    },
    {
      command: 'npm.cmd run dev:web -- --host 127.0.0.1 --port 5173',
      cwd: './frontend',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
      env: {
        VITE_API_URL: 'http://127.0.0.1:3000/api/v1',
        VITE_API_BASE_URL: 'http://127.0.0.1:3000/api/v1',
      },
    },
  ],
});
