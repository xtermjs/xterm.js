/**
 * Copyright (c) 2020 The xterm.js authors. All rights reserved.
 * @license MIT
 */

const playwright = require('playwright-core');
const fs = require('fs');

// Default to chromium
let browserType = playwright['chromium'];
const index = process.argv.indexOf('--browser');
if (index !== -1 && process.argv.length > index + 1 && typeof process.argv[index + 1] === 'string') {
  const string = process.argv[index + 1];
  if (string === 'firefox' || string === 'webkit') {
    browserType = playwright[string];
  }
}

const exists = fs.existsSync(browserType.executablePath());
if (!exists) {
  console.log(`Downloading ${browserType.name()}`);
  browserType.downloadBrowserIfNeeded().then(() => process.exit(0));
}
