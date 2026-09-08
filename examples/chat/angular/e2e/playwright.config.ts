import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  testIgnore: ['aimock-runner.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  globalSetup: process.env.STAGE_LOCAL_SERVER ? undefined : './global-setup.ts',
  globalTeardown: process.env.STAGE_LOCAL_SERVER ? undefined : './global-teardown.ts',
});
