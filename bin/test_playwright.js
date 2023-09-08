/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// @ts-check

const cp = require('child_process');
const path = require('path');

const configs = [
  { name: 'core', path: 'out-test/playwright/playwright.config.js' },
  { name: 'xterm-addon-webgl', path: 'addons/xterm-addon-webgl/out-test/playwright.config.js' }
];

function npmBinScript(script) {
  return path.resolve(__dirname, `../node_modules/.bin/` + (process.platform === 'win32' ?
    `${script}.cmd` : script));
}

for (const config of configs) {
  const command = npmBinScript('playwright');
  const args = ['test', '-c', config.path, ...process.argv.slice(2)];
  console.log(`Running suite \x1b[1;34m${config.name}...\x1b[0m`);
  console.log(`\n\x1b[32m${command}\x1b[0m`, args);
  const run = cp.spawnSync(command, args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    }
  );
  if (run.status) {
    process.exit(run.status);
  }
}
