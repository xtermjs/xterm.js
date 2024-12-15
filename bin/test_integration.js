/**
 * Copyright (c) 2019 The xterm.js authors. All rights reserved.
 * @license MIT
 */

// @ts-check

const cp = require('child_process');
const path = require('path');

let argv = process.argv.slice(2);
let suiteFilter = undefined;
while (argv.some(e => e.startsWith('--suite='))) {
  const i = argv.findIndex(e => e.startsWith('--suite='));
  const match = argv[i].match(/--suite=(?<suitename>.+)/)
  suiteFilter = match?.groups?.suitename ?? undefined;
  argv.splice(i, 1);
}

let configs = [
  { name: 'core', path: 'out-esbuild-test/playwright/playwright.config.js' }
];
const addons = [
  'attach',
  'clipboard',
  'fit',
  'image',
  'progress',
  'search',
  'serialize',
  'unicode-graphemes',
  'unicode11',
  'web-links',
  'webgl',
];
for (const addon of addons) {
  configs.push({ name: `addon-${addon}`, path: `addons/addon-${addon}/out-esbuild-test/playwright.config.js` });
}

if (suiteFilter) {
  configs = configs.filter(e => e.name === suiteFilter);
}

function npmBinScript(script) {
  return path.resolve(__dirname, `../node_modules/.bin/` + (process.platform === 'win32' ?
    `${script}.cmd` : script));
}

async function run() {
  for (const config of configs) {
    const command = npmBinScript('playwright');
    const args = ['test', '-c', config.path, ...argv];
    console.log(`Running suite \x1b[1;34m${config.name}...\x1b[0m`);
    console.log(`\n\x1b[32m${command}\x1b[0m`, args);
    const run = cp.spawnSync(command, args, {
        cwd: path.resolve(__dirname, '..'),
        shell: true,
        stdio: 'inherit'
      }
    );

    if (run.error) {
      console.error(run.error);
      process.exit(run.status ?? -1);
    }

    process.exit(run.status);
  }
}
run();
