import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: '.',
  timeout: 10000,
  projects: [
    {
      name: 'ChromeStable',
      use: {
        browserName: 'chromium',
        channel: 'chrome'
      }
    },
    {
      name: 'FirefoxStable',
      use: {
        browserName: 'firefox'
      }
    },
    {
      name: 'WebKit',
      use: {
        browserName: 'webkit'
      }
    }
  ],
  reporter: 'list',
  webServer: {
    command: 'npm run start',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: !process.env.CI
  }
};
export default config;
