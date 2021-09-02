import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: '.',
  timeout: 30000,
  projects: [
    {
      name: 'Chrome Stable',
      use: {
        browserName: 'chromium',
        channel: 'chrome'
      }
    }
  ]
};
export default config;
