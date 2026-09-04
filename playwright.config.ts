import { randomBytes, scryptSync } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 3100)
const TEST_CONTROL_PASSWORD = 'test-device-control-password'
const TEST_CONTROL_SALT = randomBytes(16)
const TEST_CONTROL_PASSWORD_HASH = [
  'scrypt',
  '16384',
  '8',
  '1',
  TEST_CONTROL_SALT.toString('base64url'),
  scryptSync(TEST_CONTROL_PASSWORD, TEST_CONTROL_SALT, 64, { N: 16_384, r: 8, p: 1 }).toString('base64url'),
].join('$')
const TEST_CONTROL_SECRET = randomBytes(48).toString('hex')
const TEST_RELAY_TOKEN = randomBytes(32).toString('hex')

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      CONTROL_AUTH_PASSWORD_HASH: process.env.CONTROL_AUTH_PASSWORD_HASH || TEST_CONTROL_PASSWORD_HASH,
      CONTROL_AUTH_SECRET: process.env.CONTROL_AUTH_SECRET || TEST_CONTROL_SECRET,
      V3_DEVICE_CONTROL_RELAY_TOKEN: process.env.V3_DEVICE_CONTROL_RELAY_TOKEN || TEST_RELAY_TOKEN,
    },
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7'],
        isMobile: true,
      },
    },
  ],
})
