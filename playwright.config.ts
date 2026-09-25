import { defineConfig, devices } from '@playwright/test'

const baseURL =
  process.env.WIKI_E2E_BASE_URL || 'https://justserver3.vercel.app'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 8_000
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7']
      }
    }
  ]
})
